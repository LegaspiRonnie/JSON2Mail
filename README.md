# json2mail

Paste a JSON object, optionally attach a file, preview it, and send it as a real email.

**Stack:** Laravel 13 REST API · React 18 + Vite SPA · SMTP (Gmail) · Docker · no database, no auth, no extra packages.

![json2mail UI](docs/screenshot-ui.png)

## How it works

```
{ "receiver": "...", "subject": "...", "message": "..." }  +  optional file
        │
        ▼
React SPA (localhost:5173)
  live validation as you type · preview panel · FormData POST
        │
        ▼
POST /api/send-email (localhost:8000)
  throttle 5/min per IP → FormRequest → EmailService → Mailable
        │
        ▼
SMTP (Gmail) → branded HTML email
```

The pasted JSON must contain **exactly** the keys `receiver`, `subject`, and `message` — any missing or extra key is rejected with a specific, human-readable error. Validation happens twice by design: live in the browser for instant feedback, and again on the server, which never trusts the frontend.

## Project structure

```
JSON2Mail/
├── api/                 Laravel 13 REST API (one endpoint; the only view is the email template)
├── web/                 React 18 + Vite single-page frontend
├── docs/                Screenshots
└── docker-compose.yml   Runs the pair with one command
```

## Run with Docker (recommended)

Requirements: **Docker Desktop**.

```powershell
cd api
copy .env.example .env
```

Fill in the mail block in `api/.env` (see *Gmail SMTP* below), then from the project root:

```powershell
docker compose up --build
```

Open **http://localhost:5173**. That's it — no PHP, Composer, or Node needed on the host.

- **API image** — `php:8.4-apache`, docroot pointed at Laravel's `public/`, dependency layers cached so code edits don't re-run Composer
- **Web image** — multi-stage build: Node compiles the Vite bundle, then a clean `nginx:alpine` image serves the static files
- **Credentials** — injected at runtime via `env_file`; the `.env` file is never baked into an image (see `api/.dockerignore`)

Day-to-day: `docker compose up` to start, `Ctrl+C` to stop, add `--build` after code changes.

## Run locally (dev servers)

Requirements: PHP 8.3+, Composer 2, Node 18+.

**API — first time:**

```powershell
cd api
composer install
copy .env.example .env
php artisan key:generate
```

Fill in the mail block in `.env`, then:

```powershell
php artisan serve
```

**Frontend — first time:**

```powershell
cd web
npm install
npm run dev
```

Open **http://localhost:5173**. The API must be running on `http://127.0.0.1:8000` — CORS is locked to the Vite dev origin, nothing else.

> Don't run the dev servers and the Docker stack at the same time — they share ports 8000 and 5173.

## Gmail SMTP (for testing)

1. Google Account → **Security** → enable **2-Step Verification**
2. Visit https://myaccount.google.com/apppasswords → create an app password named `json2mail`
3. In `api/.env`, set `MAIL_USERNAME` and `MAIL_FROM_ADDRESS` to your Gmail address and `MAIL_PASSWORD` to the 16-character app password (remove the spaces)
4. Run `php artisan config:clear` (or restart the Docker stack)

**Tip:** set `MAIL_MAILER=log` to develop without sending real email — messages land in `api/storage/logs/laravel.log` instead.

## API contract

`POST /api/send-email` — `multipart/form-data`

| Field | Rules |
|---|---|
| `payload` | required; a JSON **object** with exactly `receiver` (valid email), `subject` (string, ≤ 255), `message` (string) — extra keys rejected |
| `attachment` | optional file; ≤ 10 MB; pdf / docx / png / jpg (validated by sniffed content, not extension) |

| Status | Meaning |
|---|---|
| `200` | Sent — `{ "success": true, "message": "..." }` |
| `422` | Validation failed — Laravel's standard field-keyed `errors` object |
| `429` | Rate limited (5 requests per minute per IP) |
| `502` / `500` | Send failure — friendly message only; SMTP details and stack traces are logged server-side, never returned |

## Design decisions

- **REST over Inertia** — the deliverable *is* an API with a JSON contract; the decoupled SPA demonstrates consuming it, including CORS configuration and stateless rate limiting.
- **The server re-parses the pasted JSON** — the strict-key rule is a contract of the JSON itself. Anyone can hit the endpoint with curl, so the rule must live server-side; the client-side mirror exists purely for instant UX.
- **FormRequest → Service → Mailable layering** — the controller stays ~15 lines. Validation, sanitization, and transport each live in exactly one file, so each concern can change independently.
- **Defense in depth on the message body** — `strip_tags()` in `EmailService` *and* Blade escaping in the template. The service guarantees clean data regardless of which template renders it; the template guarantees safe output regardless of what data arrives.
- **Table-based, inline-styled email HTML** — email clients strip `<style>` blocks and ignore modern CSS layout; tables with inline styles are the only reliably rendered technique. Deliberate, not legacy.
- **The attachment is never stored** — validated, attached straight from PHP's temp upload location, then discarded. The client-supplied filename is used only as a display name, passed through `basename()` to strip any path characters.
- **Every artisan-visible failure is JSON** — `shouldRenderJsonWhen` in `bootstrap/app.php` guarantees the SPA never receives an HTML error page, even when a client forgets the `Accept` header.

## Screenshots

| Live validation | Received email |
|---|---|
| ![Live validation errors](docs/screenshot-errors.png) | ![Branded HTML email](docs/screenshot-email.png) |

## Roadmap (post-MVP, deliberately not built)

Queued sending, multiple recipients, sending history, templates, scheduling, and auth were all excluded to keep the MVP focused on one thing done well: a validated JSON-to-email pipeline with honest error handling at every layer.