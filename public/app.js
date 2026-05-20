const authPanel = document.getElementById('authPanel');
const tasksPanel = document.getElementById('tasksPanel');
const taskFormPanel = document.getElementById('taskFormPanel');
const taskToolbar = document.getElementById('taskToolbar');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showLogin = document.getElementById('showLogin');
const showRegister = document.getElementById('showRegister');
const logoutBtn = document.getElementById('logoutBtn');
const authError = document.getElementById('authError');
const registerError = document.getElementById('registerError');
const ownedTasksList = document.getElementById('ownedTasksList');
const sharedTasksList = document.getElementById('sharedTasksList');
const newTaskBtn = document.getElementById('newTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const taskForm = document.getElementById('taskForm');
const taskFormTitle = document.getElementById('taskFormTitle');
const taskShareField = document.getElementById('taskShareField');
const taskShareUsers = document.getElementById('taskShareUsers');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');
const taskFormError = document.getElementById('taskFormError');
const usersPanel = document.getElementById('usersPanel');
const usersList = document.getElementById('usersList');
const filterPriority = document.getElementById('filterPriority');
const filterStatus = document.getElementById('filterStatus');

function cleanToken(token) {
  if (token === undefined || token === null) {
    return '';
  }
  const normalized = String(token).trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return '';
  }
  return normalized;
}

function getSavedToken() {
  return cleanToken(localStorage.getItem('tasksToken'));
}

let currentToken = getSavedToken();
let currentTaskId = null;
let tasks = [];
let availableUsers = [];

function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  } else if (path.startsWith('/api/')) {
    console.warn('apiFetch without current token for', path);
  }

  return fetch(path, {
    credentials: 'include',
    headers,
    ...options,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('API auth failure', path, response.status, data);
        throw new Error(data.error || 'Session expirée ou non autorisée');
      }
      throw new Error(data.error || 'Erreur API');
    }
    return data;
  });
}

function setAuthState(isAuthenticated) {
  authPanel.classList.toggle('hidden', isAuthenticated);
  tasksPanel.classList.toggle('hidden', !isAuthenticated);
  taskToolbar.classList.toggle('hidden', !isAuthenticated);
  usersPanel.classList.toggle('hidden', !isAuthenticated);
  logoutBtn.classList.toggle('hidden', !isAuthenticated);
  taskFormPanel.classList.add('hidden');
}

function showTaskForm(task = null) {
  taskForm.reset();
  taskFormError.textContent = '';
  currentTaskId = task ? task.id : null;
  taskFormTitle.textContent = task ? 'Modifier la tâche' : 'Nouvelle tâche';
  deleteTaskBtn.classList.toggle('hidden', !task);
  taskFormPanel.classList.remove('hidden');

  if (task) {
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    document.getElementById('taskTags').value = task.tags.join(', ');
    Array.from(taskShareUsers.options).forEach((option) => {
      option.selected = task.sharedWith.includes(option.value);
    });
    taskShareField.classList.toggle('hidden', !task.isOwner);
    taskShareUsers.disabled = !task.isOwner;
  } else {
    taskShareField.classList.remove('hidden');
    taskShareUsers.disabled = false;
    Array.from(taskShareUsers.options).forEach((option) => {
      option.selected = false;
    });
  }

  const titleInput = document.getElementById('taskTitle');
  if (titleInput) {
    titleInput.focus();
    taskFormPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function hideTaskForm() {
  taskFormPanel.classList.add('hidden');
}

function renderTaskList() {
  const priorityFilter = filterPriority.value;
  const statusFilter = filterStatus.value;

  const filtered = tasks.filter((task) => {
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false;
    }
    if (statusFilter === 'pending' && task.completed) {
      return false;
    }
    if (statusFilter === 'completed' && !task.completed) {
      return false;
    }
    return true;
  });

  const owned = filtered.filter((task) => task.isOwner);
  const shared = filtered.filter((task) => !task.isOwner);

  const renderTasks = (list) =>
    list
      .map(
        (task) => `
      <article class="task-card ${task.completed ? 'completed' : ''}">
        <div class="task-meta">
          <span class="badge ${task.priority}">${task.priority}</span>
          ${task.dueDate ? `<span>Échéance: ${task.dueDate}</span>` : ''}
          <span>${task.isOwner ? 'Propriétaire' : 'Collaborateur'}</span>
        </div>
        <h3>${task.title}</h3>
        <p>${task.description || 'Aucune description'}</p>
        <div class="tags">
          ${task.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="task-meta">
          ${task.sharedWith.length ? `<span>Partagé avec: ${task.sharedWith.join(', ')}</span>` : ''}
        </div>
        <div class="task-meta">
          <button class="secondary" data-action="edit" data-id="${task.id}">Modifier</button>
          <button class="secondary" data-action="toggle" data-id="${task.id}">${task.completed ? 'Marquer non terminé' : 'Marquer terminé'}</button>
        </div>
      </article>
    `
      )
      .join('');

  ownedTasksList.innerHTML = owned.length ? renderTasks(owned) : '<p>Aucune tâche créée pour le moment.</p>';
  sharedTasksList.innerHTML = shared.length ? renderTasks(shared) : '<p>Aucune tâche partagée pour le moment.</p>';
}

function loadTasks() {
  apiFetch('/api/tasks')
    .then((data) => {
      tasks = data.tasks;
      renderTaskList();
    })
    .catch((error) => {
      console.error(error);
    });
}

function renderUsersList() {
  usersList.innerHTML = availableUsers.length
    ? availableUsers
        .map(
          (user) => `
            <div class="user-card">
              <span>${user.username}</span>
              <span>${user.isCurrent ? 'Vous' : 'Collaborateur'}</span>
            </div>
          `
        )
        .join('')
    : '<p>Aucun collaborateur trouvé.</p>';
}

function loadUsers() {
  return apiFetch('/api/auth/users')
    .then((data) => {
      availableUsers = data.users;
      taskShareUsers.innerHTML = availableUsers
        .map((user) => `<option value="${user.username}">${user.username}</option>`)
        .join('');
      renderUsersList();
    })
    .catch((error) => {
      console.error(error);
    });
}

function showError(message, target) {
  target.textContent = message;
}

function clearErrors() {
  authError.textContent = '';
  registerError.textContent = '';
  taskFormError.textContent = '';
}

function loginUser(username, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

function registerUser(username, password) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

function saveToken(token) {
  currentToken = cleanToken(token);
  if (currentToken) {
    localStorage.setItem('tasksToken', currentToken);
  } else {
    clearToken();
  }
}

function clearToken() {
  currentToken = '';
  localStorage.removeItem('tasksToken');
}

function logout() {
  clearToken();
  setAuthState(false);
}

showLogin.addEventListener('click', () => {
  showLogin.classList.add('active');
  showRegister.classList.remove('active');
  loginForm.classList.add('active');
  registerForm.classList.remove('active');
  clearErrors();
});

showRegister.addEventListener('click', () => {
  showRegister.classList.add('active');
  showLogin.classList.remove('active');
  registerForm.classList.add('active');
  loginForm.classList.remove('active');
  clearErrors();
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const response = await loginUser(username, password);
    console.log('login response', response);
    saveToken(response.token);
    if (!currentToken) {
      console.warn('Login succeeded but token was empty', response);
    }
    setAuthState(true);
    await loadUsers().catch((err) => {
      console.warn('loadUsers failed after login', err);
    });
    loadTasks();
  } catch (error) {
    console.error('login error', error);
    showError(error.message, authError);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value.trim();

  try {
    const response = await registerUser(username, password);
    console.log('register response', response);
    saveToken(response.token);
    if (!currentToken) {
      console.warn('Register succeeded but token was empty', response);
    }
    setAuthState(true);
    await loadUsers().catch((err) => {
      console.warn('loadUsers failed after register', err);
    });
    loadTasks();
  } catch (error) {
    console.error('register error', error);
    showError(error.message, registerError);
  }
});

logoutBtn.addEventListener('click', () => {
  logout();
});

newTaskBtn.addEventListener('click', () => showTaskForm());
cancelTaskBtn.addEventListener('click', hideTaskForm);

filterPriority.addEventListener('change', renderTaskList);
filterStatus.addEventListener('change', renderTaskList);

const taskClickHandler = async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const task = tasks.find((item) => item.id === Number(id));
  if (!task) return;

  if (action === 'edit') {
    showTaskForm(task);
    return;
  }
  if (action === 'toggle') {
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...task, completed: !task.completed }),
      });
      loadTasks();
    } catch (error) {
      console.error(error);
    }
  }
};

ownedTasksList.addEventListener('click', taskClickHandler);
sharedTasksList.addEventListener('click', taskClickHandler);

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  taskFormError.textContent = '';

  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const dueDate = document.getElementById('taskDueDate').value;
  const priority = document.getElementById('taskPriority').value;
  const tags = document.getElementById('taskTags').value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!title) {
    showError('Le titre est requis.', taskFormError);
    return;
  }

  const shareUsernames = Array.from(taskShareUsers.selectedOptions).map((option) => option.value);

  const payload = { title, description, dueDate, priority, tags };
  if (!currentTaskId || !taskShareUsers.disabled) {
    payload.shareUsernames = shareUsernames;
  }

  try {
    console.log('task payload', payload, 'currentTaskId', currentTaskId);
    let response;
    if (currentTaskId) {
      response = await apiFetch(`/api/tasks/${currentTaskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      response = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    console.log('task save response', response);
    hideTaskForm();
    loadTasks();
    return false;
  } catch (error) {
    console.error('task save error', error);
    showError(error.message, taskFormError);
    return false;
  }
});

deleteTaskBtn.addEventListener('click', async () => {
  if (!currentTaskId) return;
  try {
    await apiFetch(`/api/tasks/${currentTaskId}`, { method: 'DELETE' });
    hideTaskForm();
    loadTasks();
  } catch (error) {
    showError(error.message, taskFormError);
  }
});

function initialize() {
  if (currentToken) {
    setAuthState(true);
    loadUsers()
      .catch((err) => {
        console.warn('loadUsers failed during initialize', err);
      })
      .finally(loadTasks);
  } else {
    setAuthState(false);
  }
}

initialize();
