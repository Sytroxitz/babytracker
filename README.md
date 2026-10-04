# BabyTracker

A self-hosted, offline-first PWA for tracking a baby's daily life: breastfeeding, pumping,
bottle feeds, weight and height. Built for two parents sharing one (or more) children — entries sync
live between partners, and the app keeps working without a network connection.

## Features

- **Offline-first PWA** — entries are stored locally (IndexedDB) and synced when online;
  installable on the phone's home screen
- **Multi-child support** — track several children per account
- **Partner sharing** — invite a partner to a child; their entries and edits appear live
- **Forced update flow** — clients detect new deployments via `version.json` and update themselves
- **JWT-based auth** — stateless API authentication

## Stack

| Part | Tech |
|---|---|
| Frontend | React 19, Vite (PWA plugin), Tailwind CSS, Dexie (IndexedDB) |
| Backend | Symfony 7.4 (PHP 8.3), Doctrine ORM, LexikJWTAuthenticationBundle |
| Database | MySQL 8 |
| Delivery | Docker images via GitHub Actions → GHCR, auto-deployed by Watchtower |

## Development setup

Requirements: Docker (Compose) and Node.js 22+.

```bash
# 1. Backend stack (php-fpm + nginx on :8080, MySQL on host port 3307)
docker compose up -d --build
docker compose exec php composer install

# 2. JWT keypair (one-time). Put the same passphrase into backend/.env.local
#    AND backend/.env.test.local (the test env does not read .env.local):
#      JWT_PASSPHRASE=<openssl rand -hex 32>
docker compose exec php bin/console lexik:jwt:generate-keypair

# 3. Database schema
docker compose exec php bin/console doctrine:migrations:migrate

# 4. Frontend dev server on :5173 (proxies /api to :8080)
cd frontend
npm install
npm run dev
```

Tests:

```bash
docker compose exec php bin/phpunit   # backend
cd frontend && npm test               # frontend
```

## Production deployment

Every push to `master` triggers the [build workflow](.github/workflows/build-images.yml),
which publishes two self-contained images to GHCR:

- `ghcr.io/<owner>/babytracker-php` — php-fpm with the Symfony app baked in; its entrypoint
  waits for the database, generates the JWT keypair on first start and runs pending migrations
- `ghcr.io/<owner>/babytracker-web` — nginx serving the built PWA and passing `/api` to php-fpm

On the server:

```bash
mkdir babytracker && cd babytracker
curl -O https://raw.githubusercontent.com/<owner>/<repo>/master/docker-compose.prod.yml
mv docker-compose.prod.yml docker-compose.yml
curl -o .env https://raw.githubusercontent.com/<owner>/<repo>/master/.env.prod.example
# fill in .env (secrets via: openssl rand -hex 32)
docker compose up -d
```

All secrets live only in that server-side `.env` — the repository contains none.
TLS is expected to be terminated by a reverse proxy in front of `HTTP_PORT`.

With [Watchtower](https://containrrr.dev/watchtower/) running on the host, deployments are
automatic: push to `master` → GitHub Actions builds and pushes `:latest` → Watchtower pulls
and restarts the containers (`php` and `web` are labeled opt-in; the database is excluded).
Migrations run on container start, and clients pick up the new build through the PWA update flow.

## License

[MIT](LICENSE)
