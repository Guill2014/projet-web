const express = require('express');
const { run, get, all } = require('../db');
const { verifyToken } = require('../utils/auth');

const router = express.Router();
router.use(verifyToken);

function normalizeTask(row, currentUserId, shareUsers = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    priority: row.priority,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    completed: Boolean(row.completed),
    createdAt: row.createdAt,
    ownerId: row.ownerId,
    ownerUsername: row.ownerUsername,
    isOwner: row.ownerId === currentUserId,
    sharedWith: shareUsers,
  };
}

async function loadSharesForTasks(taskIds) {
  if (!taskIds.length) {
    return {};
  }

  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await all(
    `SELECT s.taskId, u.username FROM task_shares s JOIN users u ON u.id = s.userId WHERE s.taskId IN (${placeholders})`,
    taskIds
  );

  const shares = {};
  rows.forEach((row) => {
    shares[row.taskId] = shares[row.taskId] || [];
    shares[row.taskId].push(row.username);
  });

  return shares;
}

function taskShareUsernames(body) {
  if (!body.shareUsernames) {
    return [];
  }
  return Array.isArray(body.shareUsernames)
    ? body.shareUsernames.map((username) => username.trim()).filter(Boolean)
    : String(body.shareUsernames)
        .split(',')
        .map((username) => username.trim())
        .filter(Boolean);
}

router.get('/', async (req, res) => {
  try {
    const tasks = await all(
      `SELECT t.*, u.username AS ownerUsername FROM tasks t
       JOIN users u ON u.id = t.ownerId
       WHERE t.ownerId = ? OR t.id IN (SELECT taskId FROM task_shares WHERE userId = ?)
       ORDER BY completed, createdAt DESC`,
      [req.user.id, req.user.id]
    );

    const shareData = await loadSharesForTasks(tasks.map((task) => task.id));
    res.json({
      tasks: tasks.map((task) => normalizeTask(task, req.user.id, shareData[task.id] || [])),
    });
  } catch (error) {
    console.error('GET /api/tasks error', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tâches' });
  }
});

router.post('/', async (req, res) => {
  try {
    console.log('POST /api/tasks body', req.body, 'user', req.user.id);
    const { title, description, dueDate, priority, tags } = req.body;
    const shareUsernames = taskShareUsernames(req.body);

    if (!title) {
      return res.status(400).json({ error: 'Le titre de la tâche est requis' });
    }

    const tagsString = Array.isArray(tags) ? tags.filter(Boolean).join(',') : (tags || '');
    const result = await run(
      'INSERT INTO tasks (title, description, dueDate, priority, tags, ownerId) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', dueDate || '', priority || 'medium', tagsString, req.user.id]
    );

    if (shareUsernames.length) {
      const placeholders = shareUsernames.map(() => '?').join(',');
      const users = await all(`SELECT id, username FROM users WHERE username IN (${placeholders})`, shareUsernames);
      if (users.length !== shareUsernames.length) {
        return res.status(400).json({ error: 'Un ou plusieurs utilisateurs partagés n existent pas' });
      }

      for (const user of users) {
        if (user.id === req.user.id) continue;
        await run('INSERT OR IGNORE INTO task_shares (taskId, userId) VALUES (?, ?)', [result.id, user.id]);
      }
    }

    const taskId = result && result.id ? result.id : null;
    if (!taskId) {
      throw new Error('Impossible de récupérer l identifiant de la tâche créée');
    }

    const task = await get('SELECT t.*, u.username AS ownerUsername FROM tasks t JOIN users u ON u.id = t.ownerId WHERE t.id = ?', [taskId]);
    if (!task) {
      console.error('POST /api/tasks error: task not found after insert', { taskId, result });
      return res.status(500).json({ error: 'Tâche créée mais introuvable après insertion' });
    }

    const shareData = await loadSharesForTasks([taskId]);
    res.json({ task: normalizeTask(task, req.user.id, shareData[taskId] || []) });
  } catch (error) {
    console.error('POST /api/tasks error', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la création de la tâche' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, priority, completed } = req.body;
    const shareUsernames = taskShareUsernames(req.body);

    const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }

    const sharedRow = await get('SELECT id FROM task_shares WHERE taskId = ? AND userId = ?', [id, req.user.id]);
    const isOwner = task.ownerId === req.user.id;
    if (!isOwner && !sharedRow) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }

    if (!isOwner && shareUsernames.length) {
      return res.status(403).json({ error: 'Seul le propriétaire peut modifier le partage.' });
    }

    const tagsString = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean).join(',') : (req.body.tags || task.tags || '');
    await run(
      'UPDATE tasks SET title = ?, description = ?, dueDate = ?, priority = ?, tags = ?, completed = ? WHERE id = ?',
      [title || task.title, description || task.description, dueDate || task.dueDate, priority || task.priority, tagsString, completed ? 1 : 0, id]
    );

    const shareUsernamesProvided = Object.prototype.hasOwnProperty.call(req.body, 'shareUsernames');
    if (isOwner && shareUsernamesProvided) {
      await run('DELETE FROM task_shares WHERE taskId = ?', [id]);
      if (shareUsernames.length) {
        const placeholders = shareUsernames.map(() => '?').join(',');
        const users = await all(`SELECT id FROM users WHERE username IN (${placeholders})`, shareUsernames);
        for (const user of users) {
          if (user.id === req.user.id) continue;
          await run('INSERT OR IGNORE INTO task_shares (taskId, userId) VALUES (?, ?)', [id, user.id]);
        }
      }
    }

    const updatedTask = await get('SELECT t.*, u.username AS ownerUsername FROM tasks t JOIN users u ON u.id = t.ownerId WHERE t.id = ?', [id]);
    const shareData = await loadSharesForTasks([id]);
    res.json({ task: normalizeTask(updatedTask, req.user.id, shareData[id] || []) });
  } catch (error) {
    console.error('PUT /api/tasks/:id error', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la mise à jour de la tâche' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await get('SELECT id FROM tasks WHERE id = ? AND ownerId = ?', [id, req.user.id]);
    if (!task) {
      return res.status(404).json({ error: 'Tâche introuvable ou action non autorisée' });
    }

    await run('DELETE FROM tasks WHERE id = ? AND ownerId = ?', [id, req.user.id]);
    await run('DELETE FROM task_shares WHERE taskId = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/:id error', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la suppression de la tâche' });
  }
});

module.exports = router;
