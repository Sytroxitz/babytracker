# Task 3 Report: User-Entität + Security/JWT-Auth

## What Was Implemented

### Packages installed
- `symfony/uid` v7.4.9 (was absent; `symfony/security-bundle` already present)
- `lexik/jwt-authentication-bundle` v3.2.0 + `lcobucci/jwt` v5.6.0
- `symfony/test-pack` v1.2.0 (dev, for `WebTestCase`)

### JWT keypair
Generated via `lexik:jwt:generate-keypair`. Keys are in `backend/config/jwt/private.pem` and `backend/config/jwt/public.pem`. The Lexik recipe auto-added `/config/jwt/*.pem` to `backend/.gitignore`; **that entry was commented out** so the keys ARE git-tracked (private project, required for tests to sign/verify tokens locally).

### Files created / modified

| File | Action |
|------|--------|
| `backend/src/Entity/User.php` | Created — UUID id, email, password, syncCounter; implements UserInterface, PasswordAuthenticatedUserInterface |
| `backend/src/Repository/UserRepository.php` | Generated via `make:entity --regenerate` |
| `backend/src/Controller/AuthController.php` | Created — `POST /api/register` → 201 `{id, email}` |
| `backend/tests/Controller/AuthControllerTest.php` | Created — TDD test for register + login flow |
| `backend/config/packages/security.yaml` | Replaced — entity provider, `json_login` firewall, JWT firewall, access_control |
| `backend/config/packages/doctrine.yaml` | Modified — `when@test` `dbname_suffix: ''` (use same `babytracker` DB for tests) |
| `backend/config/routes.yaml` | Modified — added `api_login` route for `/api/login [POST]` |
| `backend/config/packages/lexik_jwt_authentication.yaml` | Created by recipe |
| `backend/migrations/Version20260628224222.php` | Created — `app_user` table migration |
| `backend/.env` | Modified by recipe — `JWT_SECRET_KEY`, `JWT_PUBLIC_KEY`, `JWT_PASSPHRASE` added |
| `backend/.gitignore` | Modified — commented out the `config/jwt/*.pem` exclusion added by the recipe |
| `backend/composer.json`, `backend/composer.lock`, `backend/symfony.lock` | Updated |

---

## TDD Evidence

### RED phase

**Command:**
```
docker compose exec php php bin/phpunit tests/Controller/AuthControllerTest.php
```

**Output (abbreviated):**
```
F                                                                   1 / 1 (100%)
1) App\Tests\Controller\AuthControllerTest::testRegisterThenLoginReturnsToken
Failed asserting that the Response status code is 201.
HTTP/1.1 404 Not Found
X-Debug-Exception: No%20route%20found%20for%20%22POST%20http%3A%2F%2Flocalhost%2Fapi%2Fregister%22
FAILURES! Tests: 1, Assertions: 1, Failures: 1.
```

**Why expected:** AuthController did not exist yet, so `/api/register` returned 404.

---

### GREEN phase

**Command:**
```
docker compose exec php php bin/phpunit tests/Controller/AuthControllerTest.php
```

**Output:**
```
.                                                                   1 / 1 (100%)
Time: 00:08.198, Memory: 36.50 MB
OK (1 test, 3 assertions)
```

---

## Full-suite result before commit

```
docker compose exec php php bin/phpunit
.                                                                   1 / 1 (100%)
OK (1 test, 3 assertions)
```

---

## JWT Keypair tracking status

**Keys ARE git-tracked.** The recipe added `/config/jwt/*.pem` to `backend/.gitignore` automatically, but that line was commented out in this task so both `private.pem` and `public.pem` are committed (commit `ae3602e`). The root-level `.gitignore` does not exclude them.

---

## Issues encountered and resolutions

### 1. Test environment tried `babytracker_test` DB
The `when@test` block in `doctrine.yaml` had `dbname_suffix: '_test%env(default::TEST_TOKEN)%'`, causing the test kernel to attempt connecting to `babytracker_test`. The `app` MySQL user only has access to `babytracker`. Fixed by setting `dbname_suffix: ''`.

### 2. `/api/login` returned 404 even after security.yaml was configured
In Symfony 7, the `RouterListener` runs at kernel.request priority 32, **before** the Security `Firewall` at priority 8. If no route exists for `/api/login`, the RouterListener throws `NotFoundHttpException` and the firewall's `json_login` authenticator never runs. Resolved by adding an explicit `api_login` route in `routes.yaml` (no controller — the firewall intercepts the request and Lexik's success handler returns the JWT token before controller resolution).

### 3. Cache directory lock errors
Several cache:clear calls failed with `rmdir ... Directory not empty` on Windows (Docker volume race condition). Resolved by re-running `cache:clear` which succeeded on the second attempt.

### 4. make:entity --regenerate added setters
The regeneration command added `setEmail()` and `setSyncCounter(string $syncCounter)` methods. The `setSyncCounter` type hint is `string` (Doctrine bigint is returned as string by MySQL) but the property is typed `int`. PHP coerces numeric strings without strict_types, so this works, though it's a type-hint mismatch. Not fixed — not a requirement, and not breaking.

---

## Self-review concerns

- The `api_login` route has no controller set. If a request reaches `/api/login` with an unsupported content type (not JSON) and the `json_login` authenticator's `supports()` returns false, Symfony will try to resolve a controller and fail. This is an edge case for a sync-API that only accepts JSON.
- The JWT keypair passphrase is stored in `backend/.env` (committed). Acceptable for a private project dev environment.
- `setSyncCounter(string $syncCounter): static` type inconsistency (see point 4 above) is benign for current usage but could confuse static analysis.

---

## Fix round 1

**Commit:** `6edc6e6` — `fix: remove arbitrary syncCounter/email setters, strict_types, assert register body`

### Changes made

| File | Change |
|------|--------|
| `backend/src/Entity/User.php` | Added `declare(strict_types=1);` after `<?php`; removed `setEmail()` and `setSyncCounter()` methods |
| `backend/src/Controller/AuthController.php` | Added `declare(strict_types=1);` after `<?php` |
| `backend/tests/Controller/AuthControllerTest.php` | Added 3 assertions after `assertResponseStatusCodeSame(201)`: decode body, assert `id` key, assert `email` key, assert email value matches |

### Grep results — no callers found

```
$ grep -rn setSyncCounter backend/src backend/tests
backend/src/Entity/User.php:54:    public function setSyncCounter(string $syncCounter): static
(definition only — no callers)

$ grep -rn setEmail backend/src backend/tests
backend/src/Entity/User.php:47:    public function setEmail(string $email): static
(definition only — no callers)
```

Both methods were safely deleted.

### strict_types impact

No coercion failures were introduced. `bumpSyncCounter()` uses `++$this->syncCounter` on an `int` property — fully typed. `setPassword(string $hash)` in the test helper path was already typed correctly.

### PHPUnit output — focused test

```
$ docker compose exec php php bin/phpunit tests/Controller/AuthControllerTest.php
PHPUnit 12.5.30 by Sebastian Bergmann and contributors.

Runtime:       PHP 8.3.31
Configuration: /app/phpunit.dist.xml

.                                                                   1 / 1 (100%)

Time: 00:49.328, Memory: 66.50 MB

OK (1 test, 6 assertions)
```

### PHPUnit output — full suite

```
$ docker compose exec php php bin/phpunit
PHPUnit 12.5.30 by Sebastian Bergmann and contributors.

Runtime:       PHP 8.3.31
Configuration: /app/phpunit.dist.xml

.                                                                   1 / 1 (100%)

Time: 00:08.120, Memory: 36.50 MB

OK (1 test, 6 assertions)
```

All green. Assertion count increased from 3 to 6 (the 3 new register-body assertions are verified).
