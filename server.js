const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');

function loadDotEnvFallback(filePath) {
  try {
    const raw = fsSync.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator < 1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  } catch {
    // Ignore missing .env files. Environment variables may be provided by the shell.
  }
}

let dotenvLoaded = false;
try {
  require('dotenv').config();
  dotenvLoaded = true;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    console.warn('Failed to load .env file.', error);
  }
}

if (!dotenvLoaded) {
  loadDotEnvFallback(path.join(__dirname, '.env'));
}

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const SESSION_SECRET = process.env.SESSION_SECRET || 'wildlife-gallery-secret';
const LIKE_ID_SALT = process.env.LIKE_ID_SALT || SESSION_SECRET;
const COOKIE_NAME = 'wildlight_admin';

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PHOTOS_FILE = path.join(DATA_DIR, 'photos.json');
const PRINT_REQUESTS_FILE = path.join(DATA_DIR, 'print-requests.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const LIKE_CLAIMS_FILE = path.join(DATA_DIR, 'like-claims.json');

const ALLOWED_SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const TIMELINE_SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_INDEX = TIMELINE_SEASONS.reduce((map, season, index) => ({ ...map, [season]: index }), {});

const TIMELINE_START = { season: 'spring', year: 2023 };
const LIKES_RESET_MIGRATION_KEY = 'likesResetV1';

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

function normalizeProfile(value) {
  const profile = value && typeof value === 'object' ? value : {};
  return {
    displayName: String(profile.displayName || 'Wildlight Photographer').slice(0, 120),
    about: String(profile.about || 'A seasonal visual archive built around light, habitat, and patient observation.').slice(0, 2400),
    imageUrl: String(profile.imageUrl || '').slice(0, 500),
    updatedAt: String(profile.updatedAt || new Date().toISOString())
  };
}

function defaultLikeClaims() {
  return {
    migrations: { [LIKES_RESET_MIGRATION_KEY]: false },
    claimsByPhoto: {}
  };
}

function normalizeLikeClaims(value) {
  const claims = defaultLikeClaims();

  if (!value || typeof value !== 'object') {
    return claims;
  }

  const migrations = value.migrations && typeof value.migrations === 'object' ? value.migrations : {};
  claims.migrations[LIKES_RESET_MIGRATION_KEY] = Boolean(migrations[LIKES_RESET_MIGRATION_KEY]);

  const claimsByPhoto = value.claimsByPhoto && typeof value.claimsByPhoto === 'object' ? value.claimsByPhoto : {};
  for (const [photoId, identityList] of Object.entries(claimsByPhoto)) {
    if (!Array.isArray(identityList)) {
      continue;
    }

    const cleanIdentities = [...new Set(identityList.map((item) => String(item || '').trim()).filter(Boolean))];
    if (cleanIdentities.length) {
      claims.claimsByPhoto[String(photoId)] = cleanIdentities;
    }
  }

  return claims;
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
            likes: 0,
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
            likes: 0,
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
            likes: 0,
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
            likes: 0,
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

  try {
    await fs.access(PROFILE_FILE);
  } catch {
    await fs.writeFile(PROFILE_FILE, JSON.stringify(normalizeProfile({}), null, 2));
  }

  try {
    await fs.access(LIKE_CLAIMS_FILE);
  } catch {
    await fs.writeFile(LIKE_CLAIMS_FILE, JSON.stringify(defaultLikeClaims(), null, 2));
  }

  await runMigrations();
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

function seasonProgress(year, season) {
  const seasonIndex = SEASON_INDEX[String(season || '').toLowerCase()];
  if (!Number.isFinite(Number(year)) || seasonIndex === undefined) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number(year) * 10 + seasonIndex;
}

function buildSeasonRange(start, end) {
  const items = [];
  let currentYear = start.year;
  let currentIndex = SEASON_INDEX[start.season];
  const endProgress = seasonProgress(end.year, end.season);

  while (seasonProgress(currentYear, TIMELINE_SEASONS[currentIndex]) <= endProgress) {
    items.push({ year: currentYear, season: TIMELINE_SEASONS[currentIndex] });
    currentIndex += 1;
    if (currentIndex >= TIMELINE_SEASONS.length) {
      currentIndex = 0;
      currentYear += 1;
    }
  }

  return items;
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

function getSeasonFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return { season: 'winter', year: new Date().getFullYear() };
  }

  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (month >= 3 && month <= 5) return { season: 'spring', year };
  if (month >= 6 && month <= 8) return { season: 'summer', year };
  if (month >= 9 && month <= 11) return { season: 'autumn', year };
  return { season: 'winter', year };
}

function getViewerIdentityHash(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(`${LIKE_ID_SALT}:${ip}`).digest('hex');
}

function getPhotoLikeClaims(claimsDoc, photoId) {
  const list = claimsDoc.claimsByPhoto[String(photoId)] || [];
  return new Set(list);
}

function withViewerLikeState(photo, claimsDoc, viewerIdentityHash) {
  const likeSet = getPhotoLikeClaims(claimsDoc, photo.id);
  return {
    ...photo,
    likes: Number(photo.likes || 0),
    likedByViewer: likeSet.has(viewerIdentityHash)
  };
}

async function runMigrations() {
  const likesDocRaw = await readJson(LIKE_CLAIMS_FILE, defaultLikeClaims());
  const likesDoc = normalizeLikeClaims(likesDocRaw);

  if (!likesDoc.migrations[LIKES_RESET_MIGRATION_KEY]) {
    const photos = await readJson(PHOTOS_FILE, []);
    const migratedPhotos = photos.map((photo) => ({ ...photo, likes: 0 }));

    likesDoc.claimsByPhoto = {};
    likesDoc.migrations[LIKES_RESET_MIGRATION_KEY] = true;

    await writeJson(PHOTOS_FILE, migratedPhotos);
    await writeJson(LIKE_CLAIMS_FILE, likesDoc);
    return;
  }

  // Keep the claims file normalized to prevent malformed values from causing runtime issues.
  await writeJson(LIKE_CLAIMS_FILE, likesDoc);
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

app.get('/api/profile', async (_req, res) => {
  const profile = normalizeProfile(await readJson(PROFILE_FILE, {}));
  res.json(profile);
});

app.post('/api/profile', requireAuth, upload.single('profilePhoto'), async (req, res) => {
  const currentProfile = normalizeProfile(await readJson(PROFILE_FILE, {}));

  const nextProfile = {
    displayName: String(req.body?.displayName || currentProfile.displayName).slice(0, 120),
    about: String(req.body?.about || currentProfile.about).slice(0, 2400),
    imageUrl: req.file ? `/uploads/${req.file.filename}` : currentProfile.imageUrl,
    updatedAt: new Date().toISOString()
  };

  await writeJson(PROFILE_FILE, nextProfile);
  return res.json(nextProfile);
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
  const viewerIdentityHash = getViewerIdentityHash(req);
  const claimsDoc = normalizeLikeClaims(await readJson(LIKE_CLAIMS_FILE, defaultLikeClaims()));

  let filtered = [...photos];
  if (seasonFilter) {
    filtered = filtered.filter((item) => String(item.season).toLowerCase() === seasonFilter);
  }
  if (!Number.isNaN(yearFilter)) {
    filtered = filtered.filter((item) => Number(item.year) === yearFilter);
  }

  filtered.sort((a, b) => safeTimestamp(b.dateTaken || b.createdAt) - safeTimestamp(a.dateTaken || a.createdAt));
  res.json(filtered.map((photo) => withViewerLikeState(photo, claimsDoc, viewerIdentityHash)));
});

app.get('/api/photos/:id', async (req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const photo = photos.find((item) => item.id === req.params.id);

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  const viewerIdentityHash = getViewerIdentityHash(req);
  const claimsDoc = normalizeLikeClaims(await readJson(LIKE_CLAIMS_FILE, defaultLikeClaims()));

  return res.json(withViewerLikeState(photo, claimsDoc, viewerIdentityHash));
});

app.get('/api/seasons', async (_req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const seasonMap = new Map();

  const sortedPhotos = [...photos].sort(
    (a, b) => safeTimestamp(b.dateTaken || b.createdAt) - safeTimestamp(a.dateTaken || a.createdAt)
  );

  for (const item of sortedPhotos) {
    const season = String(item.season || '').toLowerCase();
    const year = Number(item.year);
    if (!ALLOWED_SEASONS.includes(season) || Number.isNaN(year)) {
      continue;
    }

    const key = `${season}-${year}`;
    if (!seasonMap.has(key)) {
      seasonMap.set(key, {
        season,
        seasonLabel: toTitleCase(season),
        year,
        count: 0,
        coverImage: item.imageUrl || ''
      });
    }

    const current = seasonMap.get(key);
    current.count += 1;
    if (!current.coverImage) {
      current.coverImage = item.imageUrl || '';
    }
  }

  const nowSeason = getSeasonFromDate(new Date());
  const latestPhotoSeason = sortedPhotos
    .map((photo) => ({ season: String(photo.season || '').toLowerCase(), year: Number(photo.year) }))
    .filter((entry) => ALLOWED_SEASONS.includes(entry.season) && !Number.isNaN(entry.year))
    .sort((a, b) => seasonProgress(b.year, b.season) - seasonProgress(a.year, a.season))[0];

  const end =
    latestPhotoSeason && seasonProgress(latestPhotoSeason.year, latestPhotoSeason.season) > seasonProgress(nowSeason.year, nowSeason.season)
      ? latestPhotoSeason
      : nowSeason;

  const safeEnd =
    seasonProgress(end.year, end.season) < seasonProgress(TIMELINE_START.year, TIMELINE_START.season)
      ? TIMELINE_START
      : end;

  const range = buildSeasonRange(TIMELINE_START, safeEnd)
    .map((entry) => {
      const key = `${entry.season}-${entry.year}`;
      const fromPhotos = seasonMap.get(key);
      return {
        season: entry.season,
        seasonLabel: toTitleCase(entry.season),
        year: entry.year,
        count: fromPhotos ? fromPhotos.count : 0,
        coverImage: fromPhotos ? fromPhotos.coverImage : ''
      };
    })
    .sort((a, b) => seasonProgress(b.year, b.season) - seasonProgress(a.year, a.season));

  res.json(range);
});

app.post('/api/photos/:id/like', async (req, res) => {
  const photos = await readJson(PHOTOS_FILE, []);
  const index = photos.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  const viewerIdentityHash = getViewerIdentityHash(req);
  const claimsDoc = normalizeLikeClaims(await readJson(LIKE_CLAIMS_FILE, defaultLikeClaims()));
  const photoLikeClaims = getPhotoLikeClaims(claimsDoc, req.params.id);

  if (photoLikeClaims.has(viewerIdentityHash)) {
    return res.json({ likes: Number(photos[index].likes || 0), liked: false });
  }

  photoLikeClaims.add(viewerIdentityHash);
  claimsDoc.claimsByPhoto[req.params.id] = [...photoLikeClaims];

  photos[index].likes = Number(photos[index].likes || 0) + 1;
  await Promise.all([writeJson(PHOTOS_FILE, photos), writeJson(LIKE_CLAIMS_FILE, claimsDoc)]);

  return res.json({ likes: photos[index].likes, liked: true });
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
