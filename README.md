# Wildlight Archive

A multi-page wildlife photography gallery organized by seasonal collections (e.g. Winter 2025, Spring 2024), with:

- Timeline-style central directory
- Season collection pages
- Individual photo pages with click-to-reveal blurbs
- Hover-revealed minimalist controls (likes + print requests)
- Admin-only upload flow

## Run

1. Install dependencies:

```bash
npm install
```

2. Start the server with your admin password:

```bash
ADMIN_PASSWORD="your-strong-password" npm start
```

3. Open:

- Gallery timeline: `http://localhost:3000/index.html`
- Admin upload page: `http://localhost:3000/admin.html`

## How uploads are protected

- Upload endpoint (`POST /api/photos`) requires an authenticated admin session cookie.
- Only someone with your `ADMIN_PASSWORD` can log in from `/admin.html`.
- Visitors can view photos, like, and request prints, but cannot upload.

## Storage

- Uploaded image files: `uploads/`
- Photo metadata: `data/photos.json`
- Print requests: `data/print-requests.json`

## Notes

- Default password fallback is `change-me` if `ADMIN_PASSWORD` is not set. Set your own password before sharing the site.
- For public hosting, run behind HTTPS and set secure cookie behavior as needed.
