// @ts-check
// Minimal, dependency-free Node HTTP server implementing:
//  - login / logout / session (cookie-based)
//  - PM dashboard data:  Company Projects (Part 1) + Eligible Projects (Part 2)
//  - Teammate dashboard: Project Invites   (Part 1) + Eligible Projects (Part 2)
//  - Share action, restricted to the PM who owns the project
//  - Direct project access endpoint that enforces authorization (403 on denial)
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ---------------------------------------------------------------------------
// In-memory data (reset whenever the server restarts)
// ---------------------------------------------------------------------------
const users = {
  'pm1@elchai.com': { email: 'PM1@elchai.com', password: '123456', role: 'pm', name: 'PM1' },
  'pm2@elchai.com': { email: 'PM2@elchai.com', password: '123456', role: 'pm', name: 'PM2' },
  'teammate1@elchai.com': { email: 'teammate1@elchai.com', password: '123456', role: 'teammate', name: 'Teammate1' },
  'teammate2@elchai.com': { email: 'teammate2@elchai.com', password: '123456', role: 'teammate', name: 'Teammate2' },
};

/** @type {{id:string,name:string,owner:string,sharedWith:string[]}[]} */
let projects = [
  { id: 'p1', name: 'Project Apollo', owner: 'PM1@elchai.com', sharedWith: [] },
  { id: 'p2', name: 'Project Zeus', owner: 'PM2@elchai.com', sharedWith: [] },
];

/** @type {{id:string,projectId:string,projectName:string,from:string,to:string,message:string,timestamp:string}[]} */
let invites = [];

const sessions = new Map(); // token -> lowercase email

function findUser(email) {
  return users[String(email || '').toLowerCase()];
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function getSessionUser(req) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const email = sessions.get(token);
  if (!email) return null;
  return findUser(email);
}

function sendJSON(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function projectView(email) {
  const companyProjects = projects.map((p) => ({ id: p.id, name: p.name, owner: p.owner }));
  const eligibleProjects = projects
    .filter((p) => p.owner === email || p.sharedWith.includes(email))
    .map((p) => ({ id: p.id, name: p.name, owner: p.owner }));
  return { companyProjects, eligibleProjects };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/health') {
    sendJSON(res, 200, { status: 'ok' });
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const user = findUser(body.email);
    if (!user || user.password !== body.password) {
      sendJSON(res, 401, { error: 'Invalid email or password' });
      return;
    }
    const token = newToken();
    sessions.set(token, user.email.toLowerCase());
    sendJSON(res, 200, { email: user.email, role: user.role, name: user.name }, {
      'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax`,
    });
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies.session) sessions.delete(cookies.session);
    sendJSON(res, 200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0' });
    return;
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
    sendJSON(res, 200, { email: user.email, role: user.role, name: user.name });
    return;
  }

  // Dashboard data: role-aware, two-partition payload
  if (pathname === '/api/projects' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
    const view = projectView(user.email);
    if (user.role === 'teammate') {
      const myInvites = invites.filter((i) => i.to.toLowerCase() === user.email.toLowerCase());
      sendJSON(res, 200, { role: 'teammate', invites: myInvites, eligibleProjects: view.eligibleProjects });
    } else {
      sendJSON(res, 200, { role: 'pm', companyProjects: view.companyProjects, eligibleProjects: view.eligibleProjects });
    }
    return;
  }

  // Direct project access -- THIS is the authorization check the security test exercises
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
    const project = projects.find((p) => p.id === projectMatch[1]);
    if (!project) return sendJSON(res, 404, { error: 'Project not found' });
    const hasAccess = project.owner === user.email || project.sharedWith.includes(user.email);
    if (!hasAccess) {
      sendJSON(res, 403, { error: 'Access denied' });
      return;
    }
    sendJSON(res, 200, project);
    return;
  }

  // Share a project -- PM only, owner only
  const shareMatch = pathname.match(/^\/api\/projects\/([^/]+)\/share$/);
  if (shareMatch && req.method === 'POST') {
    const user = getSessionUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
    if (user.role !== 'pm') {
      sendJSON(res, 403, { error: 'Only project managers can share projects' });
      return;
    }
    const project = projects.find((p) => p.id === shareMatch[1]);
    if (!project) return sendJSON(res, 404, { error: 'Project not found' });
    if (project.owner !== user.email) {
      sendJSON(res, 403, { error: 'You can only share projects you own' });
      return;
    }
    const body = await readBody(req);
    const teammate = findUser(body.teammateEmail);
    if (!teammate || teammate.role !== 'teammate') {
      sendJSON(res, 400, { error: 'Invalid teammate email' });
      return;
    }
    if (!project.sharedWith.includes(teammate.email)) {
      project.sharedWith.push(teammate.email);
    }
    const invite = {
      id: crypto.randomBytes(8).toString('hex'),
      projectId: project.id,
      projectName: project.name,
      from: user.email,
      to: teammate.email,
      message: `${user.name} shared "${project.name}" with you.`,
      timestamp: new Date().toISOString(),
    };
    invites.push(invite);
    sendJSON(res, 200, { ok: true, project, invite });
    return;
  }

  // Test-only helper: reset in-memory state between Playwright runs
  if (pathname === '/api/__reset' && req.method === 'POST') {
    projects = [
      { id: 'p1', name: 'Project Apollo', owner: 'PM1@elchai.com', sharedWith: [] },
      { id: 'p2', name: 'Project Zeus', owner: 'PM2@elchai.com', sharedWith: [] },
    ];
    invites = [];
    sessions.clear();
    sendJSON(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res, pathname);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
  });
}

module.exports = server;
