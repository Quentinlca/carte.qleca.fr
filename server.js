const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const uploadsDir = path.join(rootDir, 'uploads');
const dataDir = path.join(rootDir, 'data');
const projectFile = path.join(dataDir, 'project.json');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  return res.send(`/uploads/${req.file.filename}`);
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
