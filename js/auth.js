const TOKEN_KEY = 'flashcue_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const DB_URL = "https://flashcue-backend.onrender.com"
  const res = await fetch(DB_URL + path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

async function fetchCurrentUser() {
  if (!getToken()) return null;
  try {
    const data = await api('/api/auth/me');
    console.log("Data received from api/auth/me:")
    console.log(data)
    return data.user;
  } catch {
    setToken('');
    return null;
  }
}

async function requireAuth() {
  const user = await fetchCurrentUser();
  if (!user) {
    // window.location.replace('/login.html');
    return null;
  }
  return user;
}

async function redirectIfAuthenticated() {
  const user = await fetchCurrentUser();
  if (user) window.location.replace('dashboard.html');
}

function populateUserSidebar(user) {
  const name = user?.name || 'Contributor';
  const role = user?.role || 'Lighting Designer';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const avatar = document.getElementById('avatar');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  if (avatar) avatar.textContent = initials || '--';
  if (userName) userName.textContent = name;
  if (userRole) userRole.textContent = role;
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function bindLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    setToken('');
    window.location.replace('/login.html');
  });
}
