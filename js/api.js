const API_BASE = 'https://thistimebackendislattime.protfilio.workers.dev';

function getToken() {
  return sessionStorage.getItem('token');
}

function setToken(token) {
  sessionStorage.setItem('token', token);
}

function clearToken() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

function showToast(message, type = 'error') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'success' ? ' success' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, headers });
  } catch (err) {
    showToast('Network error. Check your connection.');
    throw err;
  }

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
      window.location.href = 'index.html';
    }
    throw new Error('Unauthorized');
  }

  return res;
}

async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  return await res.json();
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
}
