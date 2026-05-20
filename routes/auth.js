const express = require('express');
const bcrypt = require('bcrypt');
const { run, get, all } = require('../db');
const { signToken, verifyToken } = require('../utils/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d utilisateur et mot de passe requis' });
    }

    const existingUser = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet utilisateur existe déjà' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (username, passwordHash) VALUES (?, ?)', [username, passwordHash]);
    const token = signToken({ id: result.id, username });

    res.json({ token, user: { id: result.id, username } });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d utilisateur et mot de passe requis' });
    }

    const user = await get('SELECT id, username, passwordHash FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }

    const token = signToken({ id: user.id, username: user.username });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await get('SELECT id, username FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

router.get('/users', verifyToken, async (req, res) => {
  try {
    const users = await all('SELECT id, username, id = ? AS isCurrent FROM users ORDER BY username', [req.user.id]);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

module.exports = router;
