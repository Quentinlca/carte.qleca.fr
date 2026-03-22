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
const usersDir = path.join(rootDir, 'data');
const usersFile = path.join(usersDir, 'users.json');
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
fs.mkdirSync(usersDir, { recursive: true });

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

function sanitizeProjectId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
}

function projectFilePathFromId(projectId) {
  return path.join(dataDir, `${sanitizeProjectId(projectId)}.json`);
}

function readProjectFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function generateProjectId() {
  const random = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : crypto.randomBytes(16).toString('hex');
  return `p_${random}`;
}

function sanitizeVisibility(value) {
  return value === 'private' ? 'private' : 'public';
}

function sanitizePublicAccess(value) {
  return value === 'view_only' ? 'view_only' : 'editable';
}

function normalizeProjectAccess(payload, fallbackOwner = '') {
  const ownerUsername = normalizeUsername(payload?.ownerUsername || fallbackOwner || '');
  const visibility = sanitizeVisibility(payload?.visibility);
  const publicAccess = sanitizePublicAccess(payload?.publicAccess);
  return { ownerUsername, visibility, publicAccess };
}

function normalizeProjectPayload(rawPayload, fallbackId, fallbackOwner = '') {
  const projectId = sanitizeProjectId(rawPayload?.projectId || fallbackId || generateProjectId());
  const projectName = sanitizeProjectName(rawPayload?.projectName || 'project');
  const createdAt = rawPayload?.createdAt || new Date().toISOString();
  const updatedAt = rawPayload?.updatedAt || createdAt;
  const access = normalizeProjectAccess(rawPayload, fallbackOwner);
  return {
    projectId,
    projectName,
    createdAt,
    updatedAt,
    ownerUsername: access.ownerUsername,
    visibility: access.visibility,
    publicAccess: access.publicAccess,
    image: rawPayload?.image || '',
    hotspots: Array.isArray(rawPayload?.hotspots) ? rawPayload.hotspots : []
  };
}

function listAllProjects() {
  const entries = fs.readdirSync(dataDir)
    .filter(fileName => fileName.toLowerCase().endsWith('.json'));

  return entries.map(fileName => {
    const filePath = path.join(dataDir, fileName);
    const fallbackId = sanitizeProjectId(fileName.replace(/\.json$/i, ''));
    try {
      const raw = readProjectFile(filePath);
      const fallbackOwner = raw?.ownerUsername || raw?.createdBy || '';
      const normalized = normalizeProjectPayload(raw, fallbackId, fallbackOwner);
      const serializedRaw = JSON.stringify(raw);
      const serializedNormalized = JSON.stringify(normalized);
      if (serializedRaw !== serializedNormalized) {
        fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
      }
      return { filePath, project: normalized };
    } catch (_err) {
      return null;
    }
  }).filter(Boolean);
}

function findProjectById(projectId) {
  const id = sanitizeProjectId(projectId);
  if (!id) {
    return null;
  }

  const directPath = projectFilePathFromId(id);
  if (fs.existsSync(directPath)) {
    try {
      const raw = readProjectFile(directPath);
      const fallbackOwner = raw?.ownerUsername || raw?.createdBy || '';
      const normalized = normalizeProjectPayload(raw, id, fallbackOwner);
      if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
        fs.writeFileSync(directPath, JSON.stringify(normalized, null, 2), 'utf8');
      }
      return { filePath: directPath, project: normalized };
    } catch (_err) {
      return null;
    }
  }

  const match = listAllProjects().find(item => item.project.projectId === id);
  return match || null;
}

function isSameProjectName(left, right) {
  return sanitizeProjectName(left).toLowerCase() === sanitizeProjectName(right).toLowerCase();
}

function userOwnsProject(user, project) {
  return normalizeUsername(user?.username) === normalizeUsername(project?.ownerUsername);
}

function canManageProjectIdentity(user, project) {
  if (user?.role === 'viewer') {
    return false;
  }
  return userOwnsProject(user, project);
}

function hasOwnerNameConflict(allProjects, ownerUsername, projectName, excludeProjectId = '') {
  const normalizedOwner = normalizeUsername(ownerUsername);
  const excludedId = sanitizeProjectId(excludeProjectId);
  return allProjects.some(item => {
    const candidate = item.project;
    if (sanitizeProjectId(candidate.projectId) === excludedId) {
      return false;
    }
    if (normalizeUsername(candidate.ownerUsername) !== normalizedOwner) {
      return false;
    }
    return isSameProjectName(candidate.projectName, projectName);
  });
}

function hasPublicNameConflict(allProjects, projectName, excludeProjectId = '') {
  const excludedId = sanitizeProjectId(excludeProjectId);
  return allProjects.some(item => {
    const candidate = item.project;
    if (sanitizeProjectId(candidate.projectId) === excludedId) {
      return false;
    }
    if (sanitizeVisibility(candidate.visibility) !== 'public') {
      return false;
    }
    return isSameProjectName(candidate.projectName, projectName);
  });
}

function canViewProject(user, project) {
  const username = normalizeUsername(user?.username);
  const owner = normalizeUsername(project?.ownerUsername);
  const visibility = sanitizeVisibility(project?.visibility);
  if (visibility === 'private') {
    return !!username && username === owner;
  }
  return true;
}

function canEditProject(user, project) {
  if (user?.role === 'viewer') {
    return false;
  }

  const username = normalizeUsername(user?.username);
  const owner = normalizeUsername(project?.ownerUsername);
  const visibility = sanitizeVisibility(project?.visibility);
  if (visibility === 'private') {
    return !!username && username === owner;
  }

  const publicAccess = sanitizePublicAccess(project?.publicAccess);
  if (publicAccess === 'editable') {
    return true;
  }

  return !!username && username === owner;
}

function buildProjectSummary(payload) {
  const normalized = normalizeProjectPayload(payload, payload?.projectId || '', payload?.ownerUsername || '');
  return {
    projectId: normalized.projectId,
    projectName: normalized.projectName,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    ownerUsername: normalized.ownerUsername,
    visibility: normalized.visibility,
    publicAccess: normalized.publicAccess
  };
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

app.post('/save', requireAuth, (req, res) => {
  if (req.session.user?.role === 'viewer') {
    return res.status(403).json({ error: 'viewer cannot modify projects' });
  }

  const projectId = sanitizeProjectId(req.body?.projectId);
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  const existingEntry = findProjectById(projectId);
  if (!existingEntry) {
    return res.status(404).json({ error: 'project not found' });
  }

  const existingProject = existingEntry.project;
  if (!canEditProject(req.session.user, existingProject)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const now = new Date().toISOString();
  const payload = {
    ...existingProject,
    updatedAt: now,
    image: req.body?.image || '',
    hotspots: Array.isArray(req.body?.hotspots) ? req.body.hotspots : []
  };

  fs.writeFileSync(existingEntry.filePath, JSON.stringify(payload, null, 2), 'utf8');

  return res.json({
    ok: true,
    projectId: payload.projectId,
    projectName: payload.projectName,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    ownerUsername: payload.ownerUsername,
    visibility: payload.visibility,
    publicAccess: payload.publicAccess
  });
});

app.post('/project/create', requireAuth, (req, res) => {
  if (req.session.user?.role === 'viewer') {
    return res.status(403).json({ error: 'viewer cannot modify projects' });
  }

  const projectName = sanitizeProjectName(req.body?.projectName);
  const ownerUsername = normalizeUsername(req.session.user?.username);
  const visibility = sanitizeVisibility(req.body?.visibility);
  const publicAccess = sanitizePublicAccess(req.body?.publicAccess);
  const allProjects = listAllProjects();

  if (hasOwnerNameConflict(allProjects, ownerUsername, projectName)) {
    return res.status(409).json({ error: 'user already has a project with this name' });
  }

  if (visibility === 'public' && hasPublicNameConflict(allProjects, projectName)) {
    return res.status(409).json({ error: 'public project name already exists' });
  }

  const now = new Date().toISOString();
  let projectId = generateProjectId();
  while (fs.existsSync(projectFilePathFromId(projectId))) {
    projectId = generateProjectId();
  }

  const payload = {
    projectId,
    projectName,
    createdAt: now,
    updatedAt: now,
    ownerUsername,
    visibility,
    publicAccess,
    image: req.body?.image || '',
    hotspots: []
  };

  const filePath = projectFilePathFromId(projectId);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return res.json({ ok: true, projectId, projectName, project: payload });
});

app.get('/projects', requireAuth, (req, res) => {
  const username = normalizeUsername(req.session.user?.username);
  const records = listAllProjects()
    .map(item => item.project)
    .filter(project => canViewProject(req.session.user, project))
    .map(buildProjectSummary);

  const myProjects = records
    .filter(project => normalizeUsername(project.ownerUsername) === username)
    .sort((a, b) => a.projectName.localeCompare(b.projectName));

  const communityProjects = records
    .filter(project => normalizeUsername(project.ownerUsername) !== username)
    .filter(project => project.visibility === 'public')
    .sort((a, b) => a.projectName.localeCompare(b.projectName));

  return res.json({ myProjects, communityProjects });
});

app.get('/project/:id', requireAuth, (req, res) => {
  const projectId = sanitizeProjectId(req.params.id);
  const entry = findProjectById(projectId);
  if (!entry) {
    return res.status(404).json({ error: 'project not found' });
  }

  if (!canViewProject(req.session.user, entry.project)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  return res.json(entry.project);
});

app.post('/project/rename', requireAuth, (req, res) => {
  if (req.session.user?.role === 'viewer') {
    return res.status(403).json({ error: 'viewer cannot modify projects' });
  }

  const projectId = sanitizeProjectId(req.body?.projectId);
  const toName = sanitizeProjectName(req.body?.toName);

  const entry = findProjectById(projectId);
  if (!entry) {
    return res.status(404).json({ error: 'source project not found' });
  }

  const payload = entry.project;
  if (!canManageProjectIdentity(req.session.user, payload)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const allProjects = listAllProjects();
  if (hasOwnerNameConflict(allProjects, payload.ownerUsername, toName, payload.projectId)) {
    return res.status(409).json({ error: 'user already has a project with this name' });
  }

  if (payload.visibility === 'public' && hasPublicNameConflict(allProjects, toName, payload.projectId)) {
    return res.status(409).json({ error: 'public project name already exists' });
  }

  payload.projectName = toName;
  payload.updatedAt = new Date().toISOString();
  fs.writeFileSync(entry.filePath, JSON.stringify(payload, null, 2), 'utf8');

  return res.json({
    ok: true,
    projectId: payload.projectId,
    projectName: toName,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    ownerUsername: payload.ownerUsername,
    visibility: payload.visibility,
    publicAccess: payload.publicAccess
  });
});

app.post('/project/access', requireAuth, (req, res) => {
  if (req.session.user?.role === 'viewer') {
    return res.status(403).json({ error: 'viewer cannot modify projects' });
  }

  const projectId = sanitizeProjectId(req.body?.projectId);
  const entry = findProjectById(projectId);
  if (!entry) {
    return res.status(404).json({ error: 'project not found' });
  }

  const payload = entry.project;
  if (!canManageProjectIdentity(req.session.user, payload)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const nextVisibility = sanitizeVisibility(req.body?.visibility);
  const nextPublicAccess = sanitizePublicAccess(req.body?.publicAccess);
  const allProjects = listAllProjects();

  if (nextVisibility === 'public' && hasPublicNameConflict(allProjects, payload.projectName, payload.projectId)) {
    return res.status(409).json({ error: 'public project name already exists' });
  }

  payload.visibility = nextVisibility;
  payload.publicAccess = nextPublicAccess;
  payload.updatedAt = new Date().toISOString();
  fs.writeFileSync(entry.filePath, JSON.stringify(payload, null, 2), 'utf8');

  return res.json({ ok: true, project: buildProjectSummary(payload) });
});

app.post('/project/duplicate', requireAuth, (req, res) => {
  if (req.session.user?.role === 'viewer') {
    return res.status(403).json({ error: 'viewer cannot modify projects' });
  }

  const sourceId = sanitizeProjectId(req.body?.projectId);
  const sourceEntry = findProjectById(sourceId);
  if (!sourceEntry) {
    return res.status(404).json({ error: 'source project not found' });
  }

  const sourcePayload = sourceEntry.project;
  if (!canViewProject(req.session.user, sourcePayload)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const ownerUsername = normalizeUsername(req.session.user?.username);
  const allProjects = listAllProjects();
  let index = 1;
  let duplicatedName = sanitizeProjectName(`${sourcePayload.projectName}_copy`);
  while (
    hasOwnerNameConflict(allProjects, ownerUsername, duplicatedName) ||
    (sanitizeVisibility(sourcePayload.visibility) === 'public' && hasPublicNameConflict(allProjects, duplicatedName))
  ) {
    index += 1;
    duplicatedName = sanitizeProjectName(`${sourcePayload.projectName}_copy${index}`);
  }

  const now = new Date().toISOString();
  let duplicateId = generateProjectId();
  while (fs.existsSync(projectFilePathFromId(duplicateId))) {
    duplicateId = generateProjectId();
  }

  const duplicatePayload = {
    ...sourcePayload,
    projectId: duplicateId,
    projectName: duplicatedName,
    ownerUsername,
    visibility: sanitizeVisibility(sourcePayload.visibility),
    publicAccess: sanitizePublicAccess(sourcePayload.publicAccess),
    createdAt: now,
    updatedAt: now
  };
  const duplicateFile = projectFilePathFromId(duplicateId);
  fs.writeFileSync(duplicateFile, JSON.stringify(duplicatePayload, null, 2), 'utf8');

  return res.json({ ok: true, projectId: duplicateId, projectName: duplicatedName });
});

app.delete('/project/:id', requireAuth, (req, res) => {
  if (req.session.user?.role === 'viewer') {
    return res.status(403).json({ error: 'viewer cannot modify projects' });
  }

  const projectId = sanitizeProjectId(req.params.id);
  const entry = findProjectById(projectId);
  if (!entry) {
    return res.status(404).json({ error: 'project not found' });
  }

  if (!canManageProjectIdentity(req.session.user, entry.project)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  fs.unlinkSync(entry.filePath);
  return res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
