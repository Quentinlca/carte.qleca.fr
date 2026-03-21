const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const uploadsDir = path.join(rootDir, 'uploads');
const dataDir = path.join(rootDir, 'saves');
const imageSigningSecret = process.env.IMAGE_SIGNING_SECRET || 'change-me-in-production';

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

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
app.use(express.static(publicDir));

app.get('/image/:filename', (req, res) => {
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

app.get('/image-url', (req, res) => {
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

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  return res.send(buildPrivateImageUrl(req.file.filename));
});

app.post('/save', (req, res) => {
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

app.post('/project/create', (req, res) => {
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

app.get('/projects', (_req, res) => {
  const projects = fs.readdirSync(dataDir)
    .filter(fileName => fileName.toLowerCase().endsWith('.json'))
    .map(projectNameFromFile)
    .sort((a, b) => a.localeCompare(b));
  return res.json({ projects });
});

app.get('/project/:name', (req, res) => {
  const projectName = sanitizeProjectName(req.params.name);
  const projectFile = projectFilePathFromName(projectName);
  if (!fs.existsSync(projectFile)) {
    return res.status(404).json({ error: 'project not found' });
  }
  return res.sendFile(projectFile);
});

app.post('/project/rename', (req, res) => {
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

app.post('/project/duplicate', (req, res) => {
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

app.delete('/project/:name', (req, res) => {
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
