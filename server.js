const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const uploadsDir = path.join(rootDir, 'uploads');
const dataDir = path.join(rootDir, 'saves');
const usersFile = path.join(dataDir, 'users.json');
const imageSigningSecret = process.env.IMAGE_SIGNING_SECRET || 'change-me-in-production';
const sessionSecret = process.env.SESSION_SECRET || 'change-this-session-secret';

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9_.-]{3,40}$/.test(value);
}

function sanitizeRole(value) {
  return value === 'admin' ? 'admin' : 'viewer';
}

function countAdmins(store) {
  return Object.values(store).filter(user => user?.role === 'admin').length;
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    createdAt: user.createdAt || null
  };
}

function readUsersStore() {
  if (!fs.existsSync(usersFile)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch (_err) {
    return {};
  }
}

function writeUsersStore(store) {
  fs.writeFileSync(usersFile, JSON.stringify(store, null, 2), 'utf8');
}

function createUserRecord(username, passwordHash, role) {
  return {
    username,
    passwordHash,
    role: sanitizeRole(role),
    createdAt: new Date().toISOString()
  };
}

function bootstrapUsersFromEnv(store) {
  let changed = false;

  const adminHash = process.env.ADMIN_PASSWORD_HASH || '';
  const viewerHash = process.env.VIEWER_PASSWORD_HASH || '';

  if (adminHash && !store.admin) {
    store.admin = createUserRecord('admin', adminHash, 'admin');
    changed = true;
  }

  if (viewerHash && !store.viewer) {
    store.viewer = createUserRecord('viewer', viewerHash, 'viewer');
    changed = true;
  }

  return changed;
}

async function verifyPassword(user, plainPassword) {
  if (!user || typeof plainPassword !== 'string' || !user.passwordHash) {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, user.passwordHash);
  } catch (_err) {
    return false;
  }
}

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const users = readUsersStore();
if (bootstrapUsersFromEnv(users)) {
  writeUsersStore(users);
}

const upload = multer({ dest: uploadsDir });

function signFilename(filename) {
  return crypto.createHmac('sha256', imageSigningSecret).update(filename).digest('hex');
}

function buildPrivateImageUrl(filename) {
  const encoded = encodeURIComponent(filename);
  const signature = signFilename(filename);
  return `/image/${encoded}?sig=${signature}`;
}

function extractFilenameFromSource(source) {
  if (!source || typeof source !== 'string') {
    return null;
  }

  if (source.startsWith('/image/')) {
    const pathname = source.split('?')[0];
    const encodedName = pathname.slice('/image/'.length);
    try {
      return path.basename(decodeURIComponent(encodedName));
    } catch (_err) {
      return path.basename(encodedName);
    }
  }

  const slashNormalized = source.replace(/\\/g, '/');
  const marker = '/uploads/';
  const markerIndex = slashNormalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex !== -1) {
    return path.basename(slashNormalized.slice(markerIndex + marker.length));
  }

  return path.basename(slashNormalized);
}

function signaturesMatch(expected, received) {
  if (!received || expected.length !== received.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function sanitizeProjectName(name) {
  const raw = typeof name === 'string' ? name.trim() : '';
  const withoutExt = raw.replace(/\.json$/i, '');
  const safe = withoutExt.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.+/g, '.').slice(0, 120).trim();
  return safe || 'project';
}

function projectFilePathFromName(name) {
  return path.join(dataDir, `${sanitizeProjectName(name)}.json`);
}

function projectNameFromFile(fileName) {
  return fileName.replace(/\.json$/i, '');
}

function readProjectFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

app.use(express.json({ limit: '50mb' }));
app.use(session({
  name: 'carte.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

function requireAuth(req, res, next) {
  if (req.session?.user) {
    return next();
  }
  return res.status(401).json({ error: 'unauthenticated' });
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'admin only' });
}

app.use(express.static(publicDir, { index: false }));

app.get('/login', (_req, res) => {
  if (_req.session?.user) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(publicDir, 'login.html'));
});

app.post('/auth/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = users[username];

  const valid = await verifyPassword(user, password);
  if (!valid) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  req.session.user = { username: user.username, role: user.role };
  return res.json({ ok: true, user: req.session.user });
});

app.post('/auth/users', requireAdmin, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'viewer' ? 'viewer' : null;

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'invalid username format' });
  }

  if (!role) {
    return res.status(400).json({ error: 'invalid role' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'password too short' });
  }

  if (users[username]) {
    return res.status(409).json({ error: 'user already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  users[username] = createUserRecord(username, passwordHash, role);
  writeUsersStore(users);

  return res.json({
    ok: true,
    user: publicUser(users[username])
  });
});

app.get('/auth/users', requireAdmin, (_req, res) => {
  const list = Object.values(users)
    .map(publicUser)
    .sort((a, b) => a.username.localeCompare(b.username));
  return res.json({ users: list });
});

app.patch('/auth/users/:username', requireAdmin, async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const user = users[username];
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  const nextRole = req.body?.role;
  const nextPassword = typeof req.body?.password === 'string' ? req.body.password : '';
  const roleProvided = typeof nextRole === 'string';
  const passwordProvided = nextPassword.length > 0;

  if (!roleProvided && !passwordProvided) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  if (roleProvided) {
    if (nextRole !== 'admin' && nextRole !== 'viewer') {
      return res.status(400).json({ error: 'invalid role' });
    }

    if (user.role === 'admin' && nextRole === 'viewer' && countAdmins(users) <= 1) {
      return res.status(400).json({ error: 'cannot demote last admin' });
    }

    user.role = nextRole;
  }

  if (passwordProvided) {
    if (nextPassword.length < 8) {
      return res.status(400).json({ error: 'password too short' });
    }
    user.passwordHash = await bcrypt.hash(nextPassword, 12);
  }

  writeUsersStore(users);

  if (req.session?.user?.username === username) {
    req.session.user.role = user.role;
  }

  return res.json({ ok: true, user: publicUser(user) });
});

app.delete('/auth/users/:username', requireAdmin, (req, res) => {
  const username = normalizeUsername(req.params.username);
  const user = users[username];
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  if (req.session?.user?.username === username) {
    return res.status(400).json({ error: 'cannot delete current user' });
  }

  if (user.role === 'admin' && countAdmins(users) <= 1) {
    return res.status(400).json({ error: 'cannot delete last admin' });
  }

  delete users[username];
  writeUsersStore(users);
  return res.json({ ok: true });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('carte.sid');
    return res.json({ ok: true });
  });
});

app.get('/auth/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  return res.json({ user: req.session.user });
});

app.get('/', (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/index.html', (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/image/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename) {
    return res.status(400).send('Invalid filename');
  }

  const expectedSig = signFilename(filename);
  const receivedSig = typeof req.query.sig === 'string' ? req.query.sig : '';
  if (!signaturesMatch(expectedSig, receivedSig)) {
    return res.status(403).send('Forbidden');
  }

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  return res.sendFile(filePath);
});

app.get('/image-url', requireAuth, (req, res) => {
  const source = typeof req.query.src === 'string' ? req.query.src : '';
  const filename = extractFilenameFromSource(source);
  if (!filename) {
    return res.status(400).send('Invalid source');
  }

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }

  return res.send(buildPrivateImageUrl(filename));
});

app.post('/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  return res.send(buildPrivateImageUrl(req.file.filename));
});

app.post('/save', requireAdmin, (req, res) => {
  const projectName = sanitizeProjectName(req.body?.projectName);
  const filePath = projectFilePathFromName(projectName);
  const now = new Date().toISOString();
  let existing = null;
  if (fs.existsSync(filePath)) {
    existing = readProjectFile(filePath);
  }

  const createdAt = existing?.createdAt || req.body?.createdAt || now;

  const payload = {
    projectName,
    createdAt,
    updatedAt: now,
    image: req.body?.image || '',
    hotspots: Array.isArray(req.body?.hotspots) ? req.body.hotspots : []
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

  return res.json({ ok: true, projectName, createdAt: payload.createdAt, updatedAt: payload.updatedAt });
});

app.post('/project/create', requireAdmin, (req, res) => {
  const projectName = sanitizeProjectName(req.body?.projectName);
  const filePath = projectFilePathFromName(projectName);
  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: 'project name already exists' });
  }

  const now = new Date().toISOString();
  const payload = {
    projectName,
    createdAt: now,
    updatedAt: now,
    image: req.body?.image || '',
    hotspots: []
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return res.json({ ok: true, projectName, project: payload });
});

app.get('/projects', requireAuth, (_req, res) => {
  const projects = fs.readdirSync(dataDir)
    .filter(fileName => fileName.toLowerCase().endsWith('.json'))
    .filter(fileName => fileName.toLowerCase() !== 'users.json')
    .map(projectNameFromFile)
    .sort((a, b) => a.localeCompare(b));
  return res.json({ projects });
});

app.get('/project/:name', requireAuth, (req, res) => {
  const projectName = sanitizeProjectName(req.params.name);
  const projectFile = projectFilePathFromName(projectName);
  if (!fs.existsSync(projectFile)) {
    return res.status(404).json({ error: 'project not found' });
  }
  return res.sendFile(projectFile);
});

app.post('/project/rename', requireAdmin, (req, res) => {
  const fromName = sanitizeProjectName(req.body?.fromName);
  const toName = sanitizeProjectName(req.body?.toName);
  const fromFile = projectFilePathFromName(fromName);
  const toFile = projectFilePathFromName(toName);

  if (!fs.existsSync(fromFile)) {
    return res.status(404).json({ error: 'source project not found' });
  }

  if (fromName !== toName && fs.existsSync(toFile)) {
    return res.status(409).json({ error: 'project name already exists' });
  }

  const payload = readProjectFile(fromFile);
  payload.projectName = toName;
  payload.updatedAt = new Date().toISOString();
  if (!payload.createdAt) {
    payload.createdAt = payload.updatedAt;
  }

  fs.writeFileSync(toFile, JSON.stringify(payload, null, 2), 'utf8');
  if (fromFile !== toFile && fs.existsSync(fromFile)) {
    fs.unlinkSync(fromFile);
  }

  return res.json({ ok: true, projectName: toName, createdAt: payload.createdAt, updatedAt: payload.updatedAt });
});

app.post('/project/duplicate', requireAdmin, (req, res) => {
  const sourceName = sanitizeProjectName(req.body?.name);
  const sourceFile = projectFilePathFromName(sourceName);
  if (!fs.existsSync(sourceFile)) {
    return res.status(404).json({ error: 'source project not found' });
  }

  const duplicatedName = sanitizeProjectName(`${sourceName}_copy`);
  const duplicateFile = projectFilePathFromName(duplicatedName);
  if (fs.existsSync(duplicateFile)) {
    return res.status(409).json({ error: 'duplicate project already exists' });
  }

  const sourcePayload = readProjectFile(sourceFile);
  const now = new Date().toISOString();
  const duplicatePayload = {
    ...sourcePayload,
    projectName: duplicatedName,
    createdAt: now,
    updatedAt: now
  };
  fs.writeFileSync(duplicateFile, JSON.stringify(duplicatePayload, null, 2), 'utf8');

  return res.json({ ok: true, projectName: duplicatedName });
});

app.delete('/project/:name', requireAdmin, (req, res) => {
  const projectName = sanitizeProjectName(req.params.name);
  const projectFile = projectFilePathFromName(projectName);
  if (!fs.existsSync(projectFile)) {
    return res.status(404).json({ error: 'project not found' });
  }
  fs.unlinkSync(projectFile);
  return res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
