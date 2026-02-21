# Wildlight Archive

My personal photography profolio website: 

## Run

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root:

```bash
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=replace-this-for-production
LIKE_ID_SALT=replace-this-too
PORT=3000
```

3. Start the server:

```bash
npm start
```

4. Open:

- Gallery timeline: `http://localhost:3000/index.html`
- Admin page: `http://localhost:3000/admin.html`

## Admin login troubleshooting

1. Make sure `.env` includes `ADMIN_PASSWORD=...`.
2. Restart the server after any `.env` change.
3. Verify you are logging into the same running instance/port.
4. If needed, clear site cookies for localhost and try again.

## How uploads are protected

- Upload and profile update endpoints require an authenticated admin session cookie.
- Only someone with your `ADMIN_PASSWORD` can log in from `/admin.html`.
- Visitors can view photos, like (once per photo per unique identity), and request prints.

## Storage

- Uploaded image files: `uploads/`
- Photo metadata: `data/photos.json`
- Print requests: `data/print-requests.json`
- Profile metadata: `data/profile.json`
- Like claim ledger: `data/like-claims.json`

## Notes

- Default password fallback is `change-me` if `ADMIN_PASSWORD` is not set.
- Likes are unique by hashed viewer identity derived from IP + salt.
- On first run after this update, existing like counters are reset to `0` once.
- For public hosting, run behind HTTPS and tune cookie/security settings for production.
