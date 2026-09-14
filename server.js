const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '15mb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const DEFAULT_FILE = path.join(__dirname, 'default-content.json');
const FOTOS_DIR = path.join(__dirname, 'public', 'fotos');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cambiame123';
const PORT = process.env.PORT || 3000;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(FOTOS_DIR, { recursive: true });

function loadDefault() {
  return JSON.parse(fs.readFileSync(DEFAULT_FILE, 'utf8'));
}

function loadContent() {
  if (!fs.existsSync(CONTENT_FILE)) {
    const def = loadDefault();
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(def, null, 2));
    return def;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    // asegurar estructura completa por si el archivo es antiguo/incompleto
    const def = loadDefault();
    return {
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      photoExperiences: { ...(def.photoExperiences || {}), ...(parsed.photoExperiences || {}) },
      theme: { ...def.theme, ...(parsed.theme || {}) },
      experiences: { ...def.experiences, ...(parsed.experiences || {}) }
    };
  } catch (e) {
    return loadDefault();
  }
}

function saveContent(c) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(c, null, 2));
}

let content = loadContent();

// Ordena "foto2" antes que "foto10" (orden natural, no alfabético estricto)
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Fotos que viven dentro del proyecto (carpeta public/fotos), permanentes,
// se agregan/cambian subiéndolas al repositorio de git.
function scanFotosFolder() {
  let files = [];
  try {
    files = fs.readdirSync(FOTOS_DIR).filter(f => IMAGE_EXT.test(f));
  } catch (e) {
    files = [];
  }
  files.sort(naturalCompare);
  return files.map(filename => ({
    id: 'git:' + filename,
    filename,
    url: `/fotos/${encodeURIComponent(filename)}`,
    experience: content.photoExperiences[filename] || 'aleatoria',
    source: 'git'
  }));
}

function getAllPhotos() {
  const gitPhotos = scanFotosFolder();
  const uploadedPhotos = content.photos.map(p => ({ ...p, source: 'admin' }));
  return [...gitPhotos, ...uploadedPhotos];
}

function publicContent() {
  return {
    photos: getAllPhotos(),
    theme: content.theme,
    experiences: content.experiences
  };
}

// ---------------- Auth ----------------
const sessions = new Set();

function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && sessions.has(token)) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(24).toString('hex');
    sessions.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.post('/api/admin/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers['x-admin-token']);
  res.json({ ok: true });
});

app.get('/api/admin/check', requireAuth, (req, res) => res.json({ ok: true }));

// ---------------- Contenido público ----------------
app.get('/api/content', (req, res) => {
  res.json(publicContent());
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use('/fotos', express.static(FOTOS_DIR, { maxAge: '1d' }));

// ---------------- Admin: fotos permanentes (carpeta public/fotos) ----------------
app.patch('/api/admin/git-photos/:filename', requireAuth, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(FOTOS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Foto no encontrada en la carpeta fotos' });
  if (typeof req.body.experience === 'string') {
    content.photoExperiences[filename] = req.body.experience;
    saveContent(content);
  }
  res.json({ filename, experience: content.photoExperiences[filename] || 'aleatoria', source: 'git' });
});

// ---------------- Admin: fotos subidas desde el panel (temporales sin disco) ----------------
app.post('/api/admin/photos', requireAuth, (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'Imagen inválida' });
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Formato de imagen inválido' });
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'Imagen demasiado pesada' });

  const id = crypto.randomBytes(8).toString('hex');
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  const photo = { id, filename, url: `/uploads/${filename}`, experience: 'aleatoria' };
  content.photos.push(photo);
  saveContent(content);
  res.json({ ...photo, source: 'admin' });
});

app.patch('/api/admin/photos/:id', requireAuth, (req, res) => {
  const photo = content.photos.find(p => p.id === req.params.id);
  if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });
  if (typeof req.body.experience === 'string') photo.experience = req.body.experience;
  saveContent(content);
  res.json({ ...photo, source: 'admin' });
});

app.delete('/api/admin/photos/:id', requireAuth, (req, res) => {
  const idx = content.photos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Foto no encontrada' });
  const [photo] = content.photos.splice(idx, 1);
  const filePath = path.join(UPLOADS_DIR, photo.filename);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (e) {} }
  saveContent(content);
  res.json({ ok: true });
});

// ---------------- Admin: experiencias / tema ----------------
app.put('/api/admin/experiences', requireAuth, (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Datos inválidos' });
  content.experiences = req.body;
  saveContent(content);
  res.json(content.experiences);
});

app.put('/api/admin/theme', requireAuth, (req, res) => {
  content.theme = { ...content.theme, ...(req.body || {}) };
  saveContent(content);
  res.json(content.theme);
});

// ---------------- Admin: import / export / reset / wipe ----------------
app.get('/api/admin/export', requireAuth, (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="regalo-contenido.json"');
  res.json(content);
});

app.post('/api/admin/import', requireAuth, (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'JSON inválido' });
  const def = loadDefault();
  content = {
    photos: Array.isArray(incoming.photos) ? incoming.photos : [],
    photoExperiences: { ...(def.photoExperiences || {}), ...(incoming.photoExperiences || {}) },
    theme: { ...def.theme, ...(incoming.theme || {}) },
    experiences: { ...def.experiences, ...(incoming.experiences || {}) }
  };
  saveContent(content);
  res.json(publicContent());
});

app.post('/api/admin/reset-texts', requireAuth, (req, res) => {
  const def = loadDefault();
  content.experiences = def.experiences;
  saveContent(content);
  res.json(publicContent());
});

app.post('/api/admin/wipe', requireAuth, (req, res) => {
  content.photos.forEach(p => {
    const fp = path.join(UPLOADS_DIR, p.filename);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (e) {} }
  });
  content = loadDefault();
  saveContent(content);
  res.json(publicContent());
});

// ---------------- Frontend estático ----------------
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✔ Servidor del regalo interactivo escuchando en puerto ${PORT}`);
  console.log(`  Contraseña admin: ${ADMIN_PASSWORD === 'cambiame123' ? '(usando la de por defecto, cámbiala con ADMIN_PASSWORD)' : '(personalizada)'}`);
});
