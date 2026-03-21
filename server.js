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
const projectFile = path.join(dataDir, 'project.json');
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

function signaturesMatch(expected, received) {
  if (!received || expected.length !== received.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
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

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  return res.send(buildPrivateImageUrl(req.file.filename));
});

app.post('/save', (req, res) => {
  fs.writeFileSync(projectFile, JSON.stringify(req.body, null, 2), 'utf8');
  return res.send('ok');
});

app.get('/project', (_req, res) => {
  if (!fs.existsSync(projectFile)) {
    return res.status(404).json({ error: 'project not found' });
  }
  return res.sendFile(projectFile);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
