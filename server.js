const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const SESSION_SECRET = process.env.SESSION_SECRET || 'wildlife-gallery-secret';
const COOKIE_NAME = 'wildlight_admin';

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PHOTOS_FILE = path.join(DATA_DIR, 'photos.json');
const PRINT_REQUESTS_FILE = path.join(DATA_DIR, 'print-requests.json');

const ALLOWED_SEASONS = ['winter', 'spring', 'summer', 'autumn'];

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, 'public')));

function compareSecrets(input, expected) {
  const left = Buffer.from(String(input || ''));
  const right = Buffer.from(String(expected || ''));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function isAuthed(req) {
  return req.signedCookies[COOKIE_NAME] === '1';
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(PHOTOS_FILE);
  } catch {
    await fs.writeFile(
      PHOTOS_FILE,
      JSON.stringify(
        [
          {
            id: crypto.randomUUID(),
            title: 'Fox at First Frost',
            season: 'winter',
            year: 2025,
            dateTaken: '2025-01-16',
            location: 'Northern Forest Edge',
            blurb:
              'A red fox paused as dawn snow settled over the grassline. The scene felt almost monochrome except for its coat.',
            likes: 14,
            imageUrl:
              'https://images.unsplash.com/photo-1516934024742-b461fba47600?auto=format&fit=crop&w=1200&q=80',
            createdAt: new Date().toISOString()
          },
          {
            id: crypto.randomUUID(),
            title: 'Heron at Meltwater',
            season: 'spring',
            year: 2024,
            dateTaken: '2024-04-03',
            location: 'Lowland Marsh',
            blurb:
              'The marsh had just opened after a long winter. The heron stood perfectly still while wind moved only the reeds.',
            likes: 22,
            imageUrl:
              'https://images.unsplash.com/photo-1520808663317-647b476a81b9?auto=format&fit=crop&w=1200&q=80',
            createdAt: new Date().toISOString()
          },
          {
            id: crypto.randomUUID(),
            title: 'Elk in Evening Dust',
            season: 'summer',
            year: 2024,
            dateTaken: '2024-07-19',
            location: 'High Basin Trail',
            blurb:
              'Backlit dust gave the valley a bronze haze. The elk moved through it in slow, deliberate steps.',
            likes: 31,
            imageUrl:
              'https://images.unsplash.com/photo-1536514498073-50e69d39c6cf?auto=format&fit=crop&w=1200&q=80',
            createdAt: new Date().toISOString()
          },
          {
            id: crypto.randomUUID(),
            title: 'Owlet in Birch Hollow',
            season: 'autumn',
            year: 2023,
            dateTaken: '2023-10-09',
            location: 'Birch Creek Reserve',
            blurb:
              'Leaves were already copper, and the owlet watched from a split trunk as light broke through fog.',
            likes: 19,
            imageUrl:
              'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=1200&q=80',
            createdAt: new Date().toISOString()
          }
        ],
        null,
        2
      )
    );
  }

  try {
    await fs.access(PRINT_REQUESTS_FILE);
  } catch {
    await fs.writeFile(PRINT_REQUESTS_FILE, '[]');
  }
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

function seasonOrder(season) {
  const index = ALLOWED_SEASONS.indexOf(String(season || '').toLowerCase());
  return index === -1 ? 999 : index;
}

function toTitleCase(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/(^|\s)\w/g, (m) => m.toUpperCase());
}

function safeTimestamp(value) {
  const time = Date.parse(value || '');
  return Number.isNaN(time) ? 0 : time;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Only image uploads are supported.'));
  }
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: isAuthed(req) });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!compareSecrets(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Invalid password.' });
  }

  res.cookie(COOKIE_NAME, '1', {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/photos', async (req, res) => {
  const seasonFilter = String(req.query.season || '').toLowerCase();
  const yearFilter = Number.parseInt(req.query.year, 10);
  const photos = await readJson(PHOTOS_FILE, []);

  let filtered = [...photos];
  if (seasonFilter) {
    filtered = filtered.filter((item) => String(item.season).toLowerCase() === seasonFilter);
  }
  if (!Number.isNaN(yearFilter)) {
    filtered = filtered.filter((item) => Number(item.year) === yearFilter);
  }

  filtered.sort((a, b) => safeTimestamp(b.dateTaken || b.createdAt) - safeTimestamp(a.dateTaken || a.createdAt));
  res.json(filtered);
});

app.get('/api/photos/:id', async (req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const photo = photos.find((item) => item.id === req.params.id);

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  return res.json(photo);
});

app.get('/api/seasons', async (_req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const map = new Map();

  for (const item of photos) {
    const season = String(item.season || '').toLowerCase();
    const year = Number(item.year);
    if (!ALLOWED_SEASONS.includes(season) || Number.isNaN(year)) {
      continue;
    }

    const key = `${season}-${year}`;
    if (!map.has(key)) {
      map.set(key, {
        season,
        seasonLabel: toTitleCase(season),
        year,
        count: 0,
        coverImage: item.imageUrl
      });
    }

    const current = map.get(key);
    current.count += 1;
    if (!current.coverImage) {
      current.coverImage = item.imageUrl;
    }
  }

  const seasons = [...map.values()].sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    return seasonOrder(a.season) - seasonOrder(b.season);
  });

  res.json(seasons);
});

app.post('/api/photos/:id/like', async (req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const index = photos.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  photos[index].likes = Number(photos[index].likes || 0) + 1;
  await writeJson(PHOTOS_FILE, photos);

  return res.json({ likes: photos[index].likes });
});

app.post('/api/photos/:id/request-print', async (req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const photo = photos.find((item) => item.id === req.params.id);

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  const { name, email, note } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const requests = await readJson(PRINT_REQUESTS_FILE, []);
  requests.push({
    id: crypto.randomUUID(),
    photoId: photo.id,
    photoTitle: photo.title,
    name: String(name).slice(0, 80),
    email: String(email).slice(0, 120),
    note: String(note || '').slice(0, 800),
    createdAt: new Date().toISOString()
  });

  await writeJson(PRINT_REQUESTS_FILE, requests);

  return res.json({ ok: true });
});

app.post('/api/photos', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { title, season, year, dateTaken, blurb, location } = req.body || {};
    const normalizedSeason = String(season || '').toLowerCase();
    const normalizedYear = Number.parseInt(year, 10);

    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required.' });
    }

    if (!title || !ALLOWED_SEASONS.includes(normalizedSeason) || Number.isNaN(normalizedYear)) {
      return res.status(400).json({ error: 'Title, season, and year are required.' });
    }

    const photos = await readJson(PHOTOS_FILE, []);

    const record = {
      id: crypto.randomUUID(),
      title: String(title).slice(0, 120),
      season: normalizedSeason,
      year: normalizedYear,
      dateTaken: String(dateTaken || '').slice(0, 20),
      location: String(location || '').slice(0, 120),
      blurb: String(blurb || '').slice(0, 2000),
      likes: 0,
      imageUrl: `/uploads/${req.file.filename}`,
      createdAt: new Date().toISOString()
    };

    photos.unshift(record);
    await writeJson(PHOTOS_FILE, photos);

    return res.status(201).json(record);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Upload failed.' });
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || 'Unexpected error.' });
});

ensureFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Wildlight gallery running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data files.', error);
    process.exit(1);
  });
