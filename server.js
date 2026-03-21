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
  const previousProjectName = sanitizeProjectName(req.body?.previousProjectName || projectName);
  const filePath = projectFilePathFromName(projectName);
  const previousFilePath = projectFilePathFromName(previousProjectName);

  const payload = {
    projectName,
    image: req.body?.image || '',
    hotspots: Array.isArray(req.body?.hotspots) ? req.body.hotspots : []
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

  if (previousFilePath !== filePath && fs.existsSync(previousFilePath)) {
    fs.unlinkSync(previousFilePath);
  }

  return res.json({ ok: true, projectName });
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
