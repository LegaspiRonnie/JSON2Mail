## Run with Docker (recommended)

Requirements: Docker Desktop.

```powershell
cd api
copy .env.example .env
```

Fill in the mail block in `api/.env` (see *Gmail SMTP* below), then from the project root:

```powershell
docker compose up --build
```

Open http://localhost:5173. That's it — no PHP, Composer, or Node needed on the host.

- API image: `php:8.4-apache`, multi-layer cached Composer install
- Web image: multi-stage build (Node builds the bundle, nginx serves it)
- Credentials are injected at runtime via `env_file` — never baked into images