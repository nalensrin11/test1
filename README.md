# Photo Import

A mobile-friendly Express application that lets people select photos through their phone's system picker and immediately uploads them in a small, controlled queue. The dashboard lists, previews, downloads, and deletes uploaded photos.

## Run locally

```bash
npm install
 .env.example .env
npm start
```

Open `http://localhost:3000` for upload or `http://localhost:3000/dashboard` for the dashboard. During development, use `npm run dev`.

## Configuration

- `PORT` — defaults to `3000`.
- `MAX_FILE_SIZE` — maximum upload size per image in bytes; defaults to `20971520` (20 MB).
- `MAX_FILES_PER_REQUEST` — server-side maximum per request; defaults to `10`. The client sends one image per request and uses up to three concurrent uploads.
\nCopy `.env.example` to `.env` for local development or create `/var/www/photo-import/.env` on EC2. `.env` is deliberately excluded from Git; only commit `.env.example`. Environment variables supplied by systemd, Docker, or your deployment platform take precedence over values in `.env`.

Images are kept in `uploads/`; lightweight metadata is stored in `data/photos.json`. Both are local storage suitable for an initial EC2 deployment. Back up these directories together. Neither is committed to Git.

## EC2 and Nginx notes

Run the application with a process manager such as systemd or PM2 and place Nginx in front as a reverse proxy. Set Nginx's `client_max_body_size` to at least the app's per-file upload limit. Terminate HTTPS at Nginx. For multi-server scaling or durable shared storage, replace local uploads with object storage such as S3 and move metadata to a database.

Browsers deliberately require a user gesture before opening a phone photo picker. This app opens it only after the user presses **Import Photos**; it cannot access a gallery silently.
