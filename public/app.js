const state = { user: null };

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const whoEl = document.getElementById('who');
const pmDashboard = document.getElementById('pm-dashboard');
const teammateDashboard = document.getElementById('teammate-dashboard');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { status, data } = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200) {
    loginError.textContent = data.error || 'Login failed';
    return;
  }
  state.user = data;
  await loadDashboard();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  dashboardView.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
});

async function loadDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  whoEl.textContent = `${state.user.name} (${state.user.role.toUpperCase()}) — ${state.user.email}`;

  const { data } = await api('/api/projects');

  if (data.role === 'pm') {
    pmDashboard.hidden = false;
    teammateDashboard.hidden = true;
    renderPM(data);
  } else {
    pmDashboard.hidden = true;
    teammateDashboard.hidden = false;
    renderTeammate(data);
  }
}

function renderPM(data) {
  const companyList = document.getElementById('company-projects');
  const eligibleList = document.getElementById('pm-eligible-projects');
  companyList.innerHTML = '';
  eligibleList.innerHTML = '';

  data.companyProjects.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (owner: ${p.owner})`;
    companyList.appendChild(li);
  });

  data.eligibleProjects.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (owner: ${p.owner})`;
    eligibleList.appendChild(li);
  });

  const select = document.getElementById('share-project-select');
  select.innerHTML = '';
  data.eligibleProjects
    .filter((p) => p.owner === state.user.email)
    .forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
}

function renderTeammate(data) {
  const inviteList = document.getElementById('invites');
  const eligibleList = document.getElementById('teammate-eligible-projects');
  inviteList.innerHTML = '';
  eligibleList.innerHTML = '';

  if (data.invites.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No project invites yet.';
    inviteList.appendChild(li);
  }
  data.invites.forEach((inv) => {
    const li = document.createElement('li');
    li.textContent = `From ${inv.from}: ${inv.message}`;
    inviteList.appendChild(li);
  });

  if (data.eligibleProjects.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No eligible projects yet.';
    eligibleList.appendChild(li);
  }
  data.eligibleProjects.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (owner: ${p.owner})`;
    eligibleList.appendChild(li);
  });
}

document.getElementById('share-btn').addEventListener('click', async () => {
  const projectId = document.getElementById('share-project-select').value;
  const teammateEmail = document.getElementById('share-teammate-select').value;
  const resultEl = document.getElementById('share-result');
  const { status, data } = await api(`/api/projects/${projectId}/share`, {
    method: 'POST',
    body: JSON.stringify({ teammateEmail }),
  });
  if (status === 200) {
    resultEl.textContent = `Shared with ${teammateEmail}.`;
    resultEl.className = 'success';
    await loadDashboard();
  } else {
    resultEl.textContent = data.error || 'Share failed';
    resultEl.className = 'error';
  }
});

document.getElementById('direct-access-btn').addEventListener('click', async () => {
  const id = document.getElementById('direct-project-id').value.trim();
  const resultEl = document.getElementById('direct-access-result');
  const { status, data } = await api(`/api/projects/${id}`);
  if (status === 200) {
    resultEl.textContent = `200 OK — access granted: ${data.name}`;
    resultEl.className = 'success';
  } else {
    resultEl.textContent = `${status} — ${data.error}`;
    resultEl.className = 'error';
  }
});

(async function init() {
  const { status, data } = await api('/api/session');
  if (status === 200) {
    state.user = data;
    await loadDashboard();
  }
})();
