# Json2Mail

Paste JSON, get a branded email. Laravel API (`api/`) + React SPA (`web/`).

## Run locally

Requirements: PHP 8.3+, Composer, Node 20+.

**API** — from `api/`:

```powershell
copy .env.example .env
composer install
php artisan key:generate
php artisan serve
```

**Web** — from `web/`:

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The SPA calls the API at `http://127.0.0.1:8000` by default; override with `VITE_API_URL`.

Fill in the mail block in `api/.env` — locally `MAIL_MAILER=smtp` with Gmail works; in production use `MAIL_MAILER=brevo` (HTTPS API, no SMTP ports needed).

## Deploy (Railway)

No Dockerfile — Railway's Railpack builder detects Laravel from `artisan` and serves it via PHP-FPM (no Apache, no MPM headaches).

- **API service**: Root Directory = `api`. Variables: `APP_KEY`, `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `LOG_CHANNEL=stderr`, `MAIL_MAILER=brevo`, `BREVO_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`. Healthcheck path: `/api/test`.
- **Web service**: Root Directory = `web`. Variable: `VITE_API_URL=<API service URL>` (read at build time).
