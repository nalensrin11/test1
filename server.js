const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = Number(process.env.MAX_FILES_PER_REQUEST) || 10;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const METADATA_FILE = path.join(DATA_DIR, 'photos.json');
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
]);
const EXTENSIONS = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/heic': '.heic', 'image/heif': '.heif'
};

async function ensureStorage() {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try { await fsp.access(METADATA_FILE); } catch { await fsp.writeFile(METADATA_FILE, '[]\n', 'utf8'); }
}

let metadataQueue = Promise.resolve();
async function readPhotos() {
  try {
    const data = JSON.parse(await fsp.readFile(METADATA_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function updatePhotos(mutator) {
  const task = metadataQueue.then(async () => {
    const photos = await readPhotos();
    const result = await mutator(photos);
    const tempFile = `${METADATA_FILE}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(tempFile, `${JSON.stringify(photos, null, 2)}\n`, 'utf8');
    await fsp.rename(tempFile, METADATA_FILE);
    return result;
  });
  metadataQueue = task.catch(() => {});
  return task;
}
function safeName(filename) {
  return typeof filename === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,160}$/.test(filename)
    ? filename : null;
}
function publicPhoto(photo) {
  return { ...photo, url: `/uploads/${encodeURIComponent(photo.filename)}` };
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: false, maxAge: '1d' }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSIONS[file.mimetype] || '.img'}`)
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(new Error('Only JPG, PNG, WEBP, GIF, HEIC, and HEIF image files are allowed.'));
    cb(null, true);
  }
});

app.post('/api/photos', (req, res, next) => {
  upload.array('photos', MAX_FILES_PER_REQUEST)(req, res, async (err) => {
    if (err) return next(err);
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, error: 'Select at least one image to upload.' });
    try {
      const photos = req.files.map(file => ({
        filename: file.filename,
        originalName: path.basename(file.originalname).slice(0, 255),
        size: file.size,
        uploadedAt: new Date().toISOString()
      }));
      await updatePhotos(items => { items.push(...photos); });
      res.status(201).json({ success: true, count: photos.length, photos: photos.map(publicPhoto) });
    } catch (error) {
      await Promise.all(req.files.map(file => fsp.unlink(file.path).catch(() => {})));
      next(error);
    }
  });
});

app.get('/api/photos', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const photos = (await readPhotos()).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const total = photos.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const data = photos.slice((currentPage - 1) * limit, currentPage * limit).map(publicPhoto);
    res.json({ success: true, data, pagination: { page: currentPage, limit, total, totalPages } });
  } catch (error) { next(error); }
});

app.get('/api/photos/:filename/download', async (req, res, next) => {
  const filename = safeName(req.params.filename);
  if (!filename) return res.status(400).json({ success: false, error: 'Invalid filename.' });
  try {
    const photo = (await readPhotos()).find(item => item.filename === filename);
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found.' });
    const filePath = path.join(UPLOADS_DIR, filename);
    await fsp.access(filePath);
    res.download(filePath, photo.originalName);
  } catch (error) { next(error); }
});

app.delete('/api/photos/:filename', async (req, res, next) => {
  const filename = safeName(req.params.filename);
  if (!filename) return res.status(400).json({ success: false, error: 'Invalid filename.' });
  try {
    const photo = await updatePhotos(items => {
      const index = items.findIndex(item => item.filename === filename);
      if (index === -1) return null;
      return items.splice(index, 1)[0];
    });
    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found.' });
    await fsp.unlink(path.join(UPLOADS_DIR, filename)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    res.json({ success: true, message: 'Photo deleted.' });
  } catch (error) { next(error); }
});

app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.use((req, res) => res.status(404).json({ success: false, error: 'Not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: `Each image must be smaller than ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)} MB.` });
  if (error instanceof multer.MulterError) return res.status(400).json({ success: false, error: error.message });
  res.status(500).json({ success: false, error: error.message || 'Unexpected server error.' });
});

ensureStorage().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Photo Import running on http://0.0.0.0:${PORT}`))).catch(error => { console.error(error); process.exit(1); });
