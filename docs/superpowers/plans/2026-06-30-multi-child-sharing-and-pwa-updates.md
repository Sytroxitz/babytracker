# Mehrkind-Sharing & PWA-Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den BabyTracker von einem nutzer-zentrierten zu einem kind-zentrierten,
teilbaren Tracker umbauen (mehrere Kinder, Wechsel, Partner-Einladung per Code,
Urheber-Anzeige) und ein automatisch versioniertes, erzwingbares PWA-Update
ergänzen.

**Architecture:** Der Sync-Bereich wandert vom `User` auf eine neue `Child`-Entität.
Logs hängen am Kind (`child_id`) statt am User; der monotone `serverSeq`-Zähler
liegt pro Kind. Nutzer sind über `ChildMembership` (mit Rolle mama/papa) n:m mit
Kindern verbunden; Einladung läuft über kurzlebige `Invitation`-Codes. Der
Sync-Client führt einen Cursor **pro Kind** und erhält pro Sync die autoritative
Kinder-/Mitglieder-Liste. Das Frontend filtert alle Views nach dem aktiven Kind.
PWA-Updates nutzen `virtual:pwa-register` mit skipWaiting + periodischen Checks
und einer aus Git generierten Versionsnummer.

**Tech Stack:** Symfony 7 / Doctrine ORM / lexik JWT (Backend, PHP 8.2+),
React 19 / Vite 8 / Dexie / vite-plugin-pwa / Tailwind (Frontend), Vitest +
PHPUnit.

## Global Constraints

- Keine Bestandsdaten-Migration nötig (noch nicht deployed) — die Migration darf
  vorhandene Test-Logs verwerfen.
- `gender` ∈ `{male, female, diverse}`; `role` ∈ `{mama, papa}` (als String
  gespeichert, später erweiterbar).
- Einladungs-Code: **24 h** gültig, **Einmal-Gebrauch**, neu generierbar.
- Rechte: jedes Mitglied eines Kindes ist voll gleichberechtigt (CRUD auf
  Einträge, Kind-Infos editieren, einladen, löschen, verlassen).
- `createdBy` wird **serverseitig** beim Anlegen gesetzt und nie überschrieben.
- Alle `/api`-Endpunkte außer `/api/login` und `/api/register` erfordern JWT.
- TDD: erst der fehlschlagende Test, dann minimale Implementierung. Häufig
  committen. Backend-Tests: `php bin/phpunit`. Frontend-Tests: `npm test`
  (vitest run) im Ordner `frontend/`.
- Bestehendes Verhalten/Tests dürfen nicht brechen; alte user-scoped Tests werden
  bewusst auf child-scoped umgeschrieben (Teil der jeweiligen Task).

---

# Teil A — Backend: Datenmodell, Sync, API

### Task A1: `Child`-Entität

**Files:**
- Create: `backend/src/Entity/Child.php`
- Create: `backend/src/Repository/ChildRepository.php`
- Test: `backend/tests/Entity/ChildTest.php`

**Interfaces:**
- Produces: `Child` mit
  `getId():Uuid`, `getName():string`, `setName(string):void`,
  `getGender():string`, `setGender(string):void`,
  `getBirthDate():\DateTimeImmutable`, `setBirthDate(\DateTimeImmutable):void`,
  `getBirthWeightGrams():?int`, `setBirthWeightGrams(?int):void`,
  `getCreatedAt():\DateTimeImmutable`,
  `getDeletedAt():?\DateTimeImmutable`, `setDeletedAt(?\DateTimeImmutable):void`,
  `getSyncCounter():int`, `bumpSyncCounter():int`,
  `toArray(array $members):array`.

- [ ] **Step 1: Write the failing test**

```php
<?php
declare(strict_types=1);
namespace App\Tests\Entity;

use App\Entity\Child;
use PHPUnit\Framework\TestCase;

final class ChildTest extends TestCase
{
    public function test_new_child_has_uuid_and_zero_counter(): void
    {
        $c = new Child('Mia', 'female', new \DateTimeImmutable('2026-01-01'), 3200);
        self::assertSame('Mia', $c->getName());
        self::assertSame('female', $c->getGender());
        self::assertSame(3200, $c->getBirthWeightGrams());
        self::assertSame(0, $c->getSyncCounter());
        self::assertSame(1, $c->bumpSyncCounter());
        self::assertSame(1, $c->getSyncCounter());
    }

    public function test_to_array_includes_members(): void
    {
        $c = new Child('Mia', 'female', new \DateTimeImmutable('2026-01-01'), null);
        $members = [['userId' => 'u1', 'role' => 'mama', 'email' => 'a@b.c']];
        $arr = $c->toArray($members);
        self::assertSame('Mia', $arr['name']);
        self::assertNull($arr['birthWeightGrams']);
        self::assertSame($members, $arr['members']);
        self::assertArrayHasKey('id', $arr);
        self::assertArrayHasKey('birthDate', $arr);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php bin/phpunit tests/Entity/ChildTest.php`
Expected: FAIL (Class "App\Entity\Child" not found).

- [ ] **Step 3: Write minimal implementation**

`backend/src/Entity/Child.php`:
```php
<?php
declare(strict_types=1);
namespace App\Entity;

use App\Repository\ChildRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: ChildRepository::class)]
#[ORM\Table(name: 'child')]
class Child
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\Column(length: 120)]
    private string $name;

    #[ORM\Column(length: 10)]
    private string $gender;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $birthDate;

    #[ORM\Column(nullable: true)]
    private ?int $birthWeightGrams = null;

    #[ORM\Column(type: 'bigint', options: ['default' => 0])]
    private int $syncCounter = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function __construct(string $name, string $gender, \DateTimeImmutable $birthDate, ?int $birthWeightGrams)
    {
        $this->id = Uuid::v4();
        $this->name = $name;
        $this->gender = $gender;
        $this->birthDate = $birthDate;
        $this->birthWeightGrams = $birthWeightGrams;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $v): void { $this->name = $v; }
    public function getGender(): string { return $this->gender; }
    public function setGender(string $v): void { $this->gender = $v; }
    public function getBirthDate(): \DateTimeImmutable { return $this->birthDate; }
    public function setBirthDate(\DateTimeImmutable $v): void { $this->birthDate = $v; }
    public function getBirthWeightGrams(): ?int { return $this->birthWeightGrams; }
    public function setBirthWeightGrams(?int $v): void { $this->birthWeightGrams = $v; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getDeletedAt(): ?\DateTimeImmutable { return $this->deletedAt; }
    public function setDeletedAt(?\DateTimeImmutable $v): void { $this->deletedAt = $v; }
    public function getSyncCounter(): int { return $this->syncCounter; }
    public function bumpSyncCounter(): int { return ++$this->syncCounter; }

    /** @param array<array<string,mixed>> $members */
    public function toArray(array $members): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'gender' => $this->gender,
            'birthDate' => $this->birthDate->format('Y-m-d'),
            'birthWeightGrams' => $this->birthWeightGrams,
            'createdAt' => $this->createdAt->format(DATE_ATOM),
            'deletedAt' => $this->deletedAt?->format(DATE_ATOM),
            'members' => array_values($members),
        ];
    }
}
```

`backend/src/Repository/ChildRepository.php`:
```php
<?php
declare(strict_types=1);
namespace App\Repository;

use App\Entity\Child;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Child> */
class ChildRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Child::class);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php bin/phpunit tests/Entity/ChildTest.php`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/Entity/Child.php backend/src/Repository/ChildRepository.php backend/tests/Entity/ChildTest.php
git commit -m "feat(backend): Child entity"
```

---

### Task A2: `ChildMembership`- und `Invitation`-Entitäten

**Files:**
- Create: `backend/src/Entity/ChildMembership.php`
- Create: `backend/src/Entity/Invitation.php`
- Create: `backend/src/Repository/ChildMembershipRepository.php`
- Create: `backend/src/Repository/InvitationRepository.php`
- Test: `backend/tests/Entity/InvitationTest.php`

**Interfaces:**
- Produces:
  - `ChildMembership(Child $child, User $user, string $role)` mit
    `getId():Uuid`, `getChild():Child`, `getUser():User`,
    `getRole():string`, `setRole(string):void`, `getCreatedAt():\DateTimeImmutable`.
  - `Invitation(Child $child, User $createdBy, string $code)` mit
    `getCode():string`, `getChild():Child`, `getCreatedBy():User`,
    `getExpiresAt():\DateTimeImmutable`, `getUsedAt():?\DateTimeImmutable`,
    `getUsedBy():?User`, `markUsed(User $by):void`,
    `isUsable(\DateTimeImmutable $now):bool`.
  - `ChildMembershipRepository::findOneByChildAndUser(Child,User):?ChildMembership`,
    `findByChild(Child):ChildMembership[]`, `findByUser(User):ChildMembership[]`.
  - `InvitationRepository::findOneByCode(string):?Invitation`.

- [ ] **Step 1: Write the failing test**

```php
<?php
declare(strict_types=1);
namespace App\Tests\Entity;

use App\Entity\Child;
use App\Entity\Invitation;
use App\Entity\User;
use PHPUnit\Framework\TestCase;

final class InvitationTest extends TestCase
{
    private function child(): Child
    {
        return new Child('Mia', 'female', new \DateTimeImmutable('2026-01-01'), null);
    }

    public function test_fresh_invitation_is_usable_within_24h(): void
    {
        $inv = new Invitation($this->child(), new User('a@b.c'), 'ABC123XY');
        $now = new \DateTimeImmutable();
        self::assertTrue($inv->isUsable($now));
        self::assertTrue($inv->isUsable($now->modify('+23 hours')));
    }

    public function test_invitation_expires_after_24h(): void
    {
        $inv = new Invitation($this->child(), new User('a@b.c'), 'ABC123XY');
        self::assertFalse($inv->isUsable((new \DateTimeImmutable())->modify('+25 hours')));
    }

    public function test_used_invitation_is_not_usable(): void
    {
        $inv = new Invitation($this->child(), new User('a@b.c'), 'ABC123XY');
        $inv->markUsed(new User('x@y.z'));
        self::assertFalse($inv->isUsable(new \DateTimeImmutable()));
        self::assertSame('x@y.z', $inv->getUsedBy()->getEmail());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php bin/phpunit tests/Entity/InvitationTest.php`
Expected: FAIL (Class "App\Entity\Invitation" not found).

- [ ] **Step 3: Write minimal implementation**

`backend/src/Entity/ChildMembership.php`:
```php
<?php
declare(strict_types=1);
namespace App\Entity;

use App\Repository\ChildMembershipRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: ChildMembershipRepository::class)]
#[ORM\Table(name: 'child_membership')]
#[ORM\UniqueConstraint(name: 'uniq_membership_child_user', columns: ['child_id', 'user_id'])]
class ChildMembership
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Child::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Child $child;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 10)]
    private string $role;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    public function __construct(Child $child, User $user, string $role)
    {
        $this->id = Uuid::v4();
        $this->child = $child;
        $this->user = $user;
        $this->role = $role;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid { return $this->id; }
    public function getChild(): Child { return $this->child; }
    public function getUser(): User { return $this->user; }
    public function getRole(): string { return $this->role; }
    public function setRole(string $v): void { $this->role = $v; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
```

`backend/src/Entity/Invitation.php`:
```php
<?php
declare(strict_types=1);
namespace App\Entity;

use App\Repository\InvitationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: InvitationRepository::class)]
#[ORM\Table(name: 'invitation')]
class Invitation
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Child::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Child $child;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $createdBy;

    #[ORM\Column(length: 16, unique: true)]
    private string $code;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $usedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?User $usedBy = null;

    public function __construct(Child $child, User $createdBy, string $code)
    {
        $this->id = Uuid::v4();
        $this->child = $child;
        $this->createdBy = $createdBy;
        $this->code = $code;
        $this->createdAt = new \DateTimeImmutable();
        $this->expiresAt = $this->createdAt->modify('+24 hours');
    }

    public function getId(): Uuid { return $this->id; }
    public function getChild(): Child { return $this->child; }
    public function getCreatedBy(): User { return $this->createdBy; }
    public function getCode(): string { return $this->code; }
    public function getExpiresAt(): \DateTimeImmutable { return $this->expiresAt; }
    public function getUsedAt(): ?\DateTimeImmutable { return $this->usedAt; }
    public function getUsedBy(): ?User { return $this->usedBy; }

    public function markUsed(User $by): void
    {
        $this->usedAt = new \DateTimeImmutable();
        $this->usedBy = $by;
    }

    public function isUsable(\DateTimeImmutable $now): bool
    {
        return $this->usedAt === null && $now < $this->expiresAt;
    }
}
```

`backend/src/Repository/ChildMembershipRepository.php`:
```php
<?php
declare(strict_types=1);
namespace App\Repository;

use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ChildMembership> */
class ChildMembershipRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ChildMembership::class);
    }

    public function findOneByChildAndUser(Child $child, User $user): ?ChildMembership
    {
        return $this->findOneBy(['child' => $child, 'user' => $user]);
    }

    /** @return ChildMembership[] */
    public function findByChild(Child $child): array
    {
        return $this->findBy(['child' => $child]);
    }

    /** @return ChildMembership[] */
    public function findByUser(User $user): array
    {
        return $this->findBy(['user' => $user]);
    }
}
```

`backend/src/Repository/InvitationRepository.php`:
```php
<?php
declare(strict_types=1);
namespace App\Repository;

use App\Entity\Invitation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Invitation> */
class InvitationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Invitation::class);
    }

    public function findOneByCode(string $code): ?Invitation
    {
        return $this->findOneBy(['code' => $code]);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php bin/phpunit tests/Entity/InvitationTest.php`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/Entity/ChildMembership.php backend/src/Entity/Invitation.php backend/src/Repository/ChildMembershipRepository.php backend/src/Repository/InvitationRepository.php backend/tests/Entity/InvitationTest.php
git commit -m "feat(backend): ChildMembership + Invitation entities"
```

---

### Task A3: Logs auf Child-Scope umstellen (`SyncableTrait`, `Syncable`)

**Files:**
- Modify: `backend/src/Entity/Concerns/SyncableTrait.php`
- Modify: `backend/src/Entity/Contract/Syncable.php`
- Modify: `backend/src/Entity/NursingLog.php`, `PumpingLog.php`, `BottleLog.php`, `WeightLog.php` (UniqueConstraint-Spalten)
- Test: `backend/tests/Entity/NursingLogTest.php`

**Interfaces:**
- Produces (Trait + Interface): scope/Urheber-Methoden ersetzen `user`:
  `getChild():Child`, `setChild(Child):void`,
  `getCreatedBy():?User`, `setCreatedBy(?User):void`.
  Übrige Syncable-Methoden (`getId/setId`, `occurredAt`, `updatedAt`,
  `deletedAt`, `serverSeq`, `applyData`, `toArray`) bleiben.
  `baseArray()` liefert künftig `childId` und `createdById` statt `userId`.

- [ ] **Step 1: Write the failing test**

```php
<?php
declare(strict_types=1);
namespace App\Tests\Entity;

use App\Entity\Child;
use App\Entity\NursingLog;
use App\Entity\User;
use PHPUnit\Framework\TestCase;

final class NursingLogTest extends TestCase
{
    public function test_to_array_uses_child_and_creator(): void
    {
        $child = new Child('Mia', 'female', new \DateTimeImmutable('2026-01-01'), null);
        $creator = new User('a@b.c');
        $log = new NursingLog();
        $log->setId(\Symfony\Component\Uid\Uuid::v4());
        $log->setChild($child);
        $log->setCreatedBy($creator);
        $log->setOccurredAt(new \DateTimeImmutable('2026-02-01T10:00:00+00:00'));
        $log->setUpdatedAt(new \DateTimeImmutable('2026-02-01T10:00:00+00:00'));
        $log->setServerSeq(5);
        $log->applyData(['side' => 'left', 'durationMinutes' => 12, 'note' => null]);

        $arr = $log->toArray();
        self::assertSame('nursing', $arr['type']);
        self::assertSame((string) $child->getId(), $arr['childId']);
        self::assertSame((string) $creator->getId(), $arr['createdById']);
        self::assertSame('left', $arr['side']);
        self::assertArrayNotHasKey('userId', $arr);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php bin/phpunit tests/Entity/NursingLogTest.php`
Expected: FAIL (`setChild` / `setCreatedBy` not defined).

- [ ] **Step 3: Write minimal implementation**

Ersetze in `backend/src/Entity/Concerns/SyncableTrait.php` das `user`-Feld und
seine Methoden durch `child` + `createdBy`, und passe `baseArray()` an. Neue
Datei-Fassung:
```php
<?php
declare(strict_types=1);
namespace App\Entity\Concerns;

use App\Entity\Child;
use App\Entity\User;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

trait SyncableTrait
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Child::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Child $child;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?User $createdBy = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $occurredAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    #[ORM\Column(type: 'bigint')]
    private ?string $serverSeq = null;

    public function getId(): Uuid { return $this->id; }
    public function setId(Uuid $id): void { $this->id = $id; }
    public function getChild(): Child { return $this->child; }
    public function setChild(Child $child): void { $this->child = $child; }
    public function getCreatedBy(): ?User { return $this->createdBy; }
    public function setCreatedBy(?User $user): void { $this->createdBy = $user; }
    public function getOccurredAt(): \DateTimeImmutable { return $this->occurredAt; }
    public function setOccurredAt(\DateTimeImmutable $t): void { $this->occurredAt = $t; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
    public function setUpdatedAt(\DateTimeImmutable $t): void { $this->updatedAt = $t; }
    public function getDeletedAt(): ?\DateTimeImmutable { return $this->deletedAt; }
    public function setDeletedAt(?\DateTimeImmutable $t): void { $this->deletedAt = $t; }
    public function getServerSeq(): ?int { return $this->serverSeq === null ? null : (int) $this->serverSeq; }
    public function setServerSeq(int $seq): void { $this->serverSeq = (string) $seq; }

    protected function baseArray(): array
    {
        return [
            'id' => (string) $this->id,
            'childId' => (string) $this->child->getId(),
            'createdById' => $this->createdBy !== null ? (string) $this->createdBy->getId() : null,
            'occurredAt' => $this->occurredAt->format(DATE_ATOM),
            'updatedAt' => $this->updatedAt->format(DATE_ATOM),
            'deletedAt' => $this->deletedAt?->format(DATE_ATOM),
            'serverSeq' => $this->getServerSeq(),
        ];
    }
}
```

In `backend/src/Entity/Contract/Syncable.php` die `getUser/setUser`-Zeilen
ersetzen durch:
```php
    public function getChild(): \App\Entity\Child;
    public function setChild(\App\Entity\Child $child): void;
    public function getCreatedBy(): ?\App\Entity\User;
    public function setCreatedBy(?\App\Entity\User $user): void;
```
(Den jetzt ungenutzten `use App\Entity\User;`-Import belassen — `User` wird im
Rückgabetyp via FQCN referenziert, kann also auch entfernt werden.)

In allen vier Log-Entitäten (`NursingLog`, `PumpingLog`, `BottleLog`,
`WeightLog`) den UniqueConstraint von `user_id` auf `child_id` umstellen, z.B.
`NursingLog`:
```php
#[ORM\UniqueConstraint(name: 'uniq_nursing_log_child_seq', columns: ['child_id', 'server_seq'])]
```
Analog `uniq_pumping_log_child_seq`, `uniq_bottle_log_child_seq`,
`uniq_weight_log_child_seq`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php bin/phpunit tests/Entity/NursingLogTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/Entity
git commit -m "refactor(backend): logs scoped to Child + createdBy"
```

---

### Task A4: Doctrine-Migration (Neubau Schema)

**Files:**
- Create: `backend/migrations/VersionYYYYMMDDHHMMSS_children.php` (via Generator)
- Test: (Smoke) `php bin/console doctrine:schema:validate`

**Interfaces:**
- Produces: konsistentes DB-Schema (Tabellen `child`, `child_membership`,
  `invitation`; Logs mit `child_id` + `created_by_id`; `app_user` ohne
  `sync_counter`).

- [ ] **Step 1: Schema-Diff erzeugen**

Run:
```bash
cd backend && php bin/console doctrine:migrations:diff --no-interaction
```
Expected: Neue Migrationsdatei unter `backend/migrations/`. Prüfe den `up()`-Code:
er muss `child`/`child_membership`/`invitation` anlegen, `*_log` um `child_id` +
`created_by_id` erweitern, alte `user_id`-FKs/Unique auf Logs entfernen,
`app_user.sync_counter` droppen.

- [ ] **Step 2: Migration anwenden (frische DB)**

Run:
```bash
cd backend && php bin/console doctrine:migrations:migrate --no-interaction
```
Expected: „migrated" ohne Fehler. (Falls Alt-Daten Fremdschlüssel blockieren:
`php bin/console doctrine:schema:drop --force --full-database` dann
`doctrine:migrations:migrate` — zulässig, da keine Bestandsdaten erhalten werden.)

- [ ] **Step 3: Schema validieren**

Run:
```bash
cd backend && php bin/console doctrine:schema:validate
```
Expected: „[OK] The mapping files are correct." und „[OK] The database schema is
in sync with the mapping files."

- [ ] **Step 4: Test-DB-Schema erzeugen**

Run:
```bash
cd backend && php bin/console doctrine:schema:drop --force --env=test && php bin/console doctrine:schema:create --env=test
```
Expected: erfolgreich (für die Integrationstests in A5/A6).

- [ ] **Step 5: Commit**

```bash
git add backend/migrations
git commit -m "feat(backend): migration for child-scoped schema"
```

---

### Task A5: `SyncService` auf pro-Kind-Cursor + Membership umbauen

**Files:**
- Modify: `backend/src/Service/SyncService.php`
- Modify: `backend/src/Controller/SyncController.php`
- Test: `backend/tests/Service/SyncServiceTest.php`

**Interfaces:**
- Consumes: `Child`, `ChildMembership`, `ChildMembershipRepository`.
- Produces: `SyncService::sync(User $user, array $cursors, array $changes): array`
  → `['cursors' => array<string,int>, 'changes' => array<int,array>, 'children'
  => array<int,array>]`. `$cursors` ist `childId => sinceSeq`; fehlende Kinder
  gelten als `0`. Änderungen für Kinder ohne Mitgliedschaft werden ignoriert.

- [ ] **Step 1: Write the failing test**

```php
<?php
declare(strict_types=1);
namespace App\Tests\Service;

use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\User;
use App\Service\SyncService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Uid\Uuid;

final class SyncServiceTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private SyncService $sync;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = static::getContainer();
        $this->em = $c->get(EntityManagerInterface::class);
        $this->sync = $c->get(SyncService::class);
    }

    private function user(string $email): User
    {
        $u = new User($email);
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $u->setPassword($hasher->hashPassword($u, 'pw'));
        $this->em->persist($u);
        return $u;
    }

    private function childWithMember(User $u, string $role = 'mama'): Child
    {
        $child = new Child('Mia', 'female', new \DateTimeImmutable('2026-01-01'), null);
        $this->em->persist($child);
        $this->em->persist(new ChildMembership($child, $u, $role));
        return $child;
    }

    private function nursingChange(Child $child, string $when): array
    {
        return [
            'id' => (string) Uuid::v4(),
            'type' => 'nursing',
            'childId' => (string) $child->getId(),
            'occurredAt' => $when,
            'updatedAt' => $when,
            'deletedAt' => null,
            'side' => 'left',
            'durationMinutes' => 10,
            'note' => null,
        ];
    }

    public function test_push_then_pull_returns_change_with_per_child_cursor(): void
    {
        $u = $this->user('a@b.c');
        $child = $this->childWithMember($u);
        $this->em->flush();
        $cid = (string) $child->getId();

        $res = $this->sync->sync($u, [], [$this->nursingChange($child, '2026-02-01T10:00:00+00:00')]);

        self::assertSame(1, $res['cursors'][$cid]);
        self::assertCount(1, $res['changes']);
        self::assertSame($cid, $res['changes'][0]['childId']);
        self::assertSame((string) $u->getId(), $res['changes'][0]['createdById']);
        self::assertCount(1, $res['children']);
        self::assertSame($cid, $res['children'][0]['id']);
    }

    public function test_changes_for_non_member_child_are_ignored(): void
    {
        $owner = $this->user('owner@b.c');
        $stranger = $this->user('stranger@b.c');
        $child = $this->childWithMember($owner);
        $this->em->flush();

        // stranger versucht, in fremdes Kind zu schreiben
        $res = $this->sync->sync($stranger, [], [$this->nursingChange($child, '2026-02-01T10:00:00+00:00')]);

        self::assertSame([], $res['changes']);
        self::assertSame([], $res['children']);
        // und der Eintrag darf beim Owner NICHT auftauchen
        $ownerRes = $this->sync->sync($owner, [], []);
        self::assertCount(0, $ownerRes['changes']);
    }

    public function test_new_member_pulls_full_history_from_cursor_zero(): void
    {
        $owner = $this->user('owner2@b.c');
        $child = $this->childWithMember($owner);
        $this->em->flush();
        $this->sync->sync($owner, [], [$this->nursingChange($child, '2026-02-01T10:00:00+00:00')]);

        // Partner tritt bei
        $partner = $this->user('partner2@b.c');
        $this->em->persist(new ChildMembership($child, $partner, 'papa'));
        $this->em->flush();

        $res = $this->sync->sync($partner, [], []); // leerer cursor → alles
        self::assertCount(1, $res['changes']);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php bin/phpunit tests/Service/SyncServiceTest.php`
Expected: FAIL (Signatur `sync(User,int,array)` passt nicht / `childId` fehlt).

- [ ] **Step 3: Write minimal implementation**

`backend/src/Service/SyncService.php` (Neufassung):
```php
<?php
declare(strict_types=1);
namespace App\Service;

use App\Entity\BottleLog;
use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\Contract\Syncable;
use App\Entity\NursingLog;
use App\Entity\PumpingLog;
use App\Entity\User;
use App\Entity\WeightLog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;

class SyncService
{
    /** @var array<string, class-string<Syncable>> */
    private const TYPES = [
        'nursing' => NursingLog::class,
        'pumping' => PumpingLog::class,
        'bottle' => BottleLog::class,
        'weight' => WeightLog::class,
    ];

    public function __construct(private EntityManagerInterface $em) {}

    /**
     * @param array<string,int> $cursors  childId => sinceSeq
     * @param array<array<string,mixed>> $changes
     * @return array{cursors:array<string,int>, changes:array<array<string,mixed>>, children:array<array<string,mixed>>}
     */
    public function sync(User $user, array $cursors, array $changes): array
    {
        // Mitgliedschaften des Users laden → erlaubte Kinder
        $memberships = $this->em->getRepository(ChildMembership::class)->findBy(['user' => $user]);
        /** @var array<string, Child> $childrenById */
        $childrenById = [];
        foreach ($memberships as $m) {
            if ($m->getChild()->getDeletedAt() === null) {
                $childrenById[(string) $m->getChild()->getId()] = $m->getChild();
            }
        }

        $this->em->wrapInTransaction(function () use ($user, $changes, $childrenById) {
            foreach ($childrenById as $child) {
                $this->em->lock($child, \Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE);
            }
            foreach ($changes as $change) {
                $childId = (string) ($change['childId'] ?? '');
                $child = $childrenById[$childId] ?? null;
                if ($child === null) {
                    continue; // kein Mitglied dieses Kindes → ignorieren
                }
                $this->applyChange($child, $user, $change);
            }
        });

        $outCursors = [];
        $outChanges = [];
        foreach ($childrenById as $cid => $child) {
            $since = (int) ($cursors[$cid] ?? 0);
            foreach ($this->pullSince($child, $since) as $row) {
                $outChanges[] = $row;
            }
            $outCursors[$cid] = $child->getSyncCounter();
        }
        usort($outChanges, fn ($a, $b) => $a['serverSeq'] <=> $b['serverSeq']);

        return [
            'cursors' => $outCursors,
            'changes' => $outChanges,
            'children' => $this->serializeChildren($childrenById),
        ];
    }

    private function applyChange(Child $child, User $user, array $change): void
    {
        $class = self::TYPES[$change['type']] ?? null;
        if ($class === null) {
            return;
        }
        $id = Uuid::fromString($change['id']);
        $incomingUpdatedAt = new \DateTimeImmutable($change['updatedAt']);

        /** @var Syncable|null $entity */
        $entity = $this->em->getRepository($class)->findOneBy(['id' => $id, 'child' => $child]);

        if ($entity !== null && $entity->getUpdatedAt() >= $incomingUpdatedAt) {
            return;
        }

        if ($entity === null) {
            $entity = new $class();
            $entity->setId($id);
            $entity->setChild($child);
            $entity->setCreatedBy($user); // serverseitig, nur beim Anlegen
            $this->em->persist($entity);
        }

        $entity->setOccurredAt(new \DateTimeImmutable($change['occurredAt']));
        $entity->setUpdatedAt($incomingUpdatedAt);
        $entity->setDeletedAt(
            isset($change['deletedAt']) && $change['deletedAt'] !== null
                ? new \DateTimeImmutable($change['deletedAt'])
                : null
        );
        $entity->applyData($change);
        $entity->setServerSeq($child->bumpSyncCounter());
    }

    /** @return array<array<string,mixed>> */
    private function pullSince(Child $child, int $since): array
    {
        $out = [];
        foreach (self::TYPES as $class) {
            $rows = $this->em->getRepository($class)->createQueryBuilder('e')
                ->where('e.child = :child')
                ->andWhere('e.serverSeq > :since')
                ->setParameter('child', $child->getId(), 'uuid')
                ->setParameter('since', $since)
                ->orderBy('e.serverSeq', 'ASC')
                ->getQuery()->getResult();
            foreach ($rows as $row) {
                $out[] = $row->toArray();
            }
        }
        return $out;
    }

    /**
     * @param array<string, Child> $childrenById
     * @return array<array<string,mixed>>
     */
    private function serializeChildren(array $childrenById): array
    {
        $out = [];
        $repo = $this->em->getRepository(ChildMembership::class);
        foreach ($childrenById as $child) {
            $members = [];
            foreach ($repo->findBy(['child' => $child]) as $m) {
                $members[] = [
                    'userId' => (string) $m->getUser()->getId(),
                    'role' => $m->getRole(),
                    'email' => $m->getUser()->getEmail(),
                ];
            }
            $out[] = $child->toArray($members);
        }
        return $out;
    }
}
```

`backend/src/Controller/SyncController.php` anpassen (Payload `cursors` statt
`since`):
```php
        $payload = json_decode($request->getContent(), true) ?? [];
        $cursors = $payload['cursors'] ?? [];
        if (!is_array($cursors)) { $cursors = []; }
        $changes = $payload['changes'] ?? [];
        if (!is_array($changes)) { $changes = []; }

        $result = $syncService->sync($user, $cursors, $changes);
        return new JsonResponse($result);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php bin/phpunit tests/Service/SyncServiceTest.php`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/Service/SyncService.php backend/src/Controller/SyncController.php backend/tests/Service/SyncServiceTest.php
git commit -m "feat(backend): per-child sync cursors + membership isolation"
```

---

### Task A6: Child-/Invitation-API + Auth-Response mit `userId`

**Files:**
- Create: `backend/src/Controller/ChildController.php`
- Create: `backend/src/Service/InvitationCodeGenerator.php`
- Create: `backend/src/EventListener/AuthenticationSuccessListener.php`
- Modify: `backend/src/Controller/AuthController.php` (Register-Response unverändert lassen — liefert schon `id`)
- Modify: `backend/config/services.yaml` (Listener-Tag, falls nicht autokonfiguriert)
- Test: `backend/tests/Controller/ChildControllerTest.php`

**Interfaces:**
- Consumes: `Child`, `ChildMembership`, `Invitation`, `InvitationCodeGenerator`,
  `ChildMembershipRepository`, `InvitationRepository`.
- Produces (HTTP):
  - `POST /api/children` `{name,gender,birthDate,birthWeightGrams,role}` → 201
    `{ child: {...inkl. members} }`
  - `PATCH /api/children/{id}` `{name?,gender?,birthDate?,birthWeightGrams?}` → 200
  - `DELETE /api/children/{id}` → 204 (Soft-Delete)
  - `POST /api/children/{id}/invitations` → 201 `{ code, expiresAt }`
  - `POST /api/invitations/{code}/accept` `{role}` → 200 `{ child: {...} }`
  - `DELETE /api/children/{id}/members/me` → 204
  - `/api/login`-Antwort enthält zusätzlich `userId`.
- Produces (PHP): `InvitationCodeGenerator::generate(): string` (8 Zeichen,
  Alphabet ohne 0/O/1/I/L).

- [ ] **Step 1: Write the failing test**

```php
<?php
declare(strict_types=1);
namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ChildControllerTest extends WebTestCase
{
    private function register(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $email): string
    {
        $client->request('POST', '/api/register', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'pw123456']));
        $client->request('POST', '/api/login', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'pw123456']));
        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertArrayHasKey('userId', $data); // Auth-Response trägt userId
        return $data['token'];
    }

    private function auth(string $token): array
    {
        return ['HTTP_AUTHORIZATION' => 'Bearer ' . $token, 'CONTENT_TYPE' => 'application/json'];
    }

    public function test_create_child_returns_child_with_creator_membership(): void
    {
        $client = static::createClient();
        $token = $this->register($client, 'mama@b.c');

        $client->request('POST', '/api/children', server: $this->auth($token),
            content: json_encode([
                'name' => 'Mia', 'gender' => 'female',
                'birthDate' => '2026-01-01', 'birthWeightGrams' => 3200, 'role' => 'mama',
            ]));
        self::assertResponseStatusCodeSame(201);
        $body = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('Mia', $body['child']['name']);
        self::assertCount(1, $body['child']['members']);
        self::assertSame('mama', $body['child']['members'][0]['role']);
    }

    public function test_partner_joins_via_invitation_code(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'mamaX@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Mia', 'gender' => 'female', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'mama']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $client->request('POST', "/api/children/$childId/invitations", server: $this->auth($tokenA));
        self::assertResponseStatusCodeSame(201);
        $code = json_decode($client->getResponse()->getContent(), true)['code'];

        $tokenB = $this->register($client, 'papaX@b.c');
        $client->request('POST', "/api/invitations/$code/accept", server: $this->auth($tokenB),
            content: json_encode(['role' => 'papa']));
        self::assertResponseStatusCodeSame(200);
        $body = json_decode($client->getResponse()->getContent(), true);
        self::assertCount(2, $body['child']['members']);
    }

    public function test_invalid_code_is_rejected(): void
    {
        $client = static::createClient();
        $token = $this->register($client, 'solo@b.c');
        $client->request('POST', '/api/invitations/NOPECODE/accept', server: $this->auth($token),
            content: json_encode(['role' => 'papa']));
        self::assertResponseStatusCodeSame(404);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php bin/phpunit tests/Controller/ChildControllerTest.php`
Expected: FAIL (kein `userId` in Login-Antwort / Routen 404).

- [ ] **Step 3: Write minimal implementation**

`backend/src/Service/InvitationCodeGenerator.php`:
```php
<?php
declare(strict_types=1);
namespace App\Service;

class InvitationCodeGenerator
{
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ohne 0,O,1,I,L

    public function generate(int $length = 8): string
    {
        $max = strlen(self::ALPHABET) - 1;
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= self::ALPHABET[random_int(0, $max)];
        }
        return $out;
    }
}
```

`backend/src/EventListener/AuthenticationSuccessListener.php`:
```php
<?php
declare(strict_types=1);
namespace App\EventListener;

use App\Entity\User;
use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

#[AsEventListener(event: 'lexik_jwt_authentication.on_authentication_success')]
final class AuthenticationSuccessListener
{
    public function __invoke(AuthenticationSuccessEvent $event): void
    {
        $user = $event->getUser();
        if ($user instanceof User) {
            $data = $event->getData();
            $data['userId'] = (string) $user->getId();
            $event->setData($data);
        }
    }
}
```

`backend/src/Controller/ChildController.php`:
```php
<?php
declare(strict_types=1);
namespace App\Controller;

use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\Invitation;
use App\Entity\User;
use App\Repository\ChildMembershipRepository;
use App\Repository\ChildRepository;
use App\Repository\InvitationRepository;
use App\Service\InvitationCodeGenerator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class ChildController
{
    public function __construct(
        private EntityManagerInterface $em,
        private ChildMembershipRepository $memberships,
        private ChildRepository $children,
        private InvitationRepository $invitations,
        private Security $security,
    ) {}

    private function user(): User { /** @var User $u */ $u = $this->security->getUser(); return $u; }

    /** @return array<array<string,mixed>> */
    private function memberList(Child $child): array
    {
        $out = [];
        foreach ($this->memberships->findByChild($child) as $m) {
            $out[] = ['userId' => (string) $m->getUser()->getId(), 'role' => $m->getRole(), 'email' => $m->getUser()->getEmail()];
        }
        return $out;
    }

    private function requireMember(Child $child): ?ChildMembership
    {
        return $this->memberships->findOneByChildAndUser($child, $this->user());
    }

    #[Route('/api/children', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $d = json_decode($request->getContent(), true) ?? [];
        if (empty($d['name']) || empty($d['gender']) || empty($d['birthDate']) || empty($d['role'])) {
            return new JsonResponse(['error' => 'name, gender, birthDate, role required'], 400);
        }
        $child = new Child($d['name'], $d['gender'], new \DateTimeImmutable($d['birthDate']), $d['birthWeightGrams'] ?? null);
        $this->em->persist($child);
        $this->em->persist(new ChildMembership($child, $this->user(), $d['role']));
        $this->em->flush();
        return new JsonResponse(['child' => $child->toArray($this->memberList($child))], 201);
    }

    #[Route('/api/children/{id}', methods: ['PATCH'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $this->requireMember($child) === null) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        $d = json_decode($request->getContent(), true) ?? [];
        if (isset($d['name'])) { $child->setName($d['name']); }
        if (isset($d['gender'])) { $child->setGender($d['gender']); }
        if (isset($d['birthDate'])) { $child->setBirthDate(new \DateTimeImmutable($d['birthDate'])); }
        if (array_key_exists('birthWeightGrams', $d)) { $child->setBirthWeightGrams($d['birthWeightGrams']); }
        $this->em->flush();
        return new JsonResponse(['child' => $child->toArray($this->memberList($child))]);
    }

    #[Route('/api/children/{id}', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $this->requireMember($child) === null) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        $child->setDeletedAt(new \DateTimeImmutable());
        $this->em->flush();
        return new JsonResponse(null, 204);
    }

    #[Route('/api/children/{id}/invitations', methods: ['POST'])]
    public function invite(string $id, InvitationCodeGenerator $gen): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $this->requireMember($child) === null) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        do { $code = $gen->generate(); } while ($this->invitations->findOneByCode($code) !== null);
        $inv = new Invitation($child, $this->user(), $code);
        $this->em->persist($inv);
        $this->em->flush();
        return new JsonResponse(['code' => $inv->getCode(), 'expiresAt' => $inv->getExpiresAt()->format(DATE_ATOM)], 201);
    }

    #[Route('/api/invitations/{code}/accept', methods: ['POST'])]
    public function accept(string $code, Request $request): JsonResponse
    {
        $inv = $this->invitations->findOneByCode($code);
        if ($inv === null || !$inv->isUsable(new \DateTimeImmutable())) {
            return new JsonResponse(['error' => 'invalid or expired code'], 404);
        }
        $child = $inv->getChild();
        $d = json_decode($request->getContent(), true) ?? [];
        $role = $d['role'] ?? 'papa';
        if ($this->memberships->findOneByChildAndUser($child, $this->user()) === null) {
            $this->em->persist(new ChildMembership($child, $this->user(), $role));
        }
        $inv->markUsed($this->user());
        $this->em->flush();
        return new JsonResponse(['child' => $child->toArray($this->memberList($child))]);
    }

    #[Route('/api/children/{id}/members/me', methods: ['DELETE'])]
    public function leave(string $id): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null) { return new JsonResponse(['error' => 'not found'], 404); }
        $m = $this->requireMember($child);
        if ($m === null) { return new JsonResponse(['error' => 'not found'], 404); }
        $this->em->remove($m);
        $this->em->flush();
        return new JsonResponse(null, 204);
    }
}
```

Hinweis: Symfony autokonfiguriert den Listener über das `#[AsEventListener]`-
Attribut; nur falls `autoconfigure` deaktiviert ist, in `services.yaml` taggen.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php bin/phpunit tests/Controller/ChildControllerTest.php`
Expected: PASS (3 tests).

- [ ] **Step 5: Full backend suite + commit**

Run: `cd backend && php bin/phpunit`
Expected: gesamte Suite grün (alte sync-Tests ggf. in A5 bereits angepasst).
```bash
git add backend/src backend/tests backend/config
git commit -m "feat(backend): child/invitation API + userId in auth response"
```

---

# Teil B — Frontend: Datenmodell & Sync

### Task B1: Typen + Dexie-Schema (children, log-Felder, cursors)

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/db/database.ts`
- Test: `frontend/src/db/database.test.ts` (erweitern)

**Interfaces:**
- Produces (types):
  - `export type Gender = 'male' | 'female' | 'diverse'`
  - `export type Role = 'mama' | 'papa'`
  - `export interface ChildMember { userId: string; role: Role; email: string }`
  - `export interface Child { id: string; name: string; gender: Gender;
    birthDate: string; birthWeightGrams: number | null; createdAt: string;
    deletedAt: string | null; members: ChildMember[] }`
  - `LogRecord` erhält `childId: string` und `createdByUserId: string | null`.
  - `ServerChange = Omit<LogRecord,'dirty'>` (kein `userId` mehr; enthält
    `childId`, `createdById`).
  - `SyncResponse { cursors: Record<string, number>; changes: ServerChange[];
    children: Child[] }`.
- Produces (db): Tabelle `children!: Table<Child, string>`; `logs`-Index
  `[childId+occurredAt]`.

- [ ] **Step 1: Write the failing test**

In `frontend/src/db/database.test.ts` ergänzen:
```ts
import { createDb } from './database'

test('children table exists and stores a child', async () => {
  const db = createDb('test-children-' + crypto.randomUUID())
  await db.children.put({
    id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01',
    birthWeightGrams: 3200, createdAt: new Date().toISOString(), deletedAt: null,
    members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }],
  })
  const got = await db.children.get('c1')
  expect(got?.name).toBe('Mia')
  expect(got?.members[0].role).toBe('mama')
  await db.delete()
})

test('logs can be queried by [childId+occurredAt]', async () => {
  const db = createDb('test-childidx-' + crypto.randomUUID())
  await db.logs.bulkPut([
    { id: 'l1', type: 'nursing', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-01T10:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, side: 'left' },
    { id: 'l2', type: 'nursing', childId: 'c2', createdByUserId: 'u1', occurredAt: '2026-02-01T11:00:00Z', updatedAt: '2026-02-01T11:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, side: 'right' },
  ])
  const c1 = await db.logs.where('[childId+occurredAt]')
    .between(['c1', Dexie.minKey], ['c1', Dexie.maxKey]).toArray()
  expect(c1.map((r) => r.id)).toEqual(['l1'])
  await db.delete()
})
```
(Import `Dexie` oben in der Testdatei ergänzen: `import Dexie from 'dexie'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/db/database.test.ts`
Expected: FAIL (`db.children` undefined / Index fehlt).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/types.ts` die neuen Typen ergänzen und `LogRecord`/
`ServerChange`/`SyncResponse` anpassen:
```ts
export type Gender = 'male' | 'female' | 'diverse'
export type Role = 'mama' | 'papa'

export interface ChildMember { userId: string; role: Role; email: string }
export interface Child {
  id: string
  name: string
  gender: Gender
  birthDate: string            // YYYY-MM-DD
  birthWeightGrams: number | null
  createdAt: string
  deletedAt: string | null
  members: ChildMember[]
}
```
In `LogRecord` ergänzen (direkt nach `id`):
```ts
  childId: string
  createdByUserId: string | null
```
`ServerChange` und `SyncResponse` ersetzen:
```ts
export type ServerChange = Omit<LogRecord, 'dirty'> & { createdById: string | null }

export interface SyncResponse {
  cursors: Record<string, number>
  changes: ServerChange[]
  children: Child[]
}
```
(Hinweis: `ServerChange` enthält bereits `childId` aus `LogRecord`; das Feld
`createdById` ist der Server-Name, der in B3 auf `createdByUserId` gemappt wird.)

In `NewLogInput` jede Variante NICHT ändern (childId/Urheber kommen im
Repository dazu — siehe B4).

In `frontend/src/db/database.ts` Dexie-Version erhöhen und `children` + Index
ergänzen:
```ts
import Dexie, { type Table } from 'dexie'
import type { LogRecord, Child } from '../types'

interface MetaRow { key: string; value: unknown }

export class AppDB extends Dexie {
  logs!: Table<LogRecord, string>
  children!: Table<Child, string>
  meta!: Table<MetaRow, string>

  constructor(name: string) {
    super(name)
    this.version(2).stores({
      logs: 'id, type, occurredAt, dirty, childId, [childId+occurredAt]',
      children: 'id',
      meta: '&key',
    })
  }
}
```
(Die `getMeta`/`setMeta`/`createDb`/`db`-Exports unverändert lassen.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/db/database.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/db/database.ts frontend/src/db/database.test.ts
git commit -m "feat(frontend): child types + dexie children table & child index"
```

---

### Task B2: Children-API-Client + Login mit userId

**Files:**
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts` (erweitern)

**Interfaces:**
- Consumes: `Child`, `SyncResponse`, `Role`, `Gender`.
- Produces:
  - `login(email,password): Promise<{ token: string; userId: string }>`
  - `postSync(token, body: { cursors: Record<string,number>; changes: unknown[] }): Promise<SyncResponse>`
  - `createChild(token, input: { name; gender; birthDate; birthWeightGrams; role }): Promise<{ child: Child }>`
  - `patchChild(token, id, patch): Promise<{ child: Child }>`
  - `deleteChild(token, id): Promise<void>`
  - `createInvitation(token, childId): Promise<{ code: string; expiresAt: string }>`
  - `acceptInvitation(token, code, role): Promise<{ child: Child }>`
  - `leaveChild(token, childId): Promise<void>`

- [ ] **Step 1: Write the failing test**

In `frontend/src/api/client.test.ts` ergänzen (Pattern an die vorhandenen
fetch-Mocks anlehnen):
```ts
import { login, postSync, createChild } from './client'

test('login returns token and userId', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ token: 't1', userId: 'u1' }),
  })
  vi.stubGlobal('fetch', fetchMock)
  const res = await login('a@b.c', 'pw')
  expect(res).toEqual({ token: 't1', userId: 'u1' })
  vi.unstubAllGlobals()
})

test('postSync sends cursors and returns children', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ cursors: { c1: 3 }, changes: [], children: [] }),
  })
  vi.stubGlobal('fetch', fetchMock)
  const res = await postSync('t1', { cursors: { c1: 0 }, changes: [] })
  expect(res.cursors.c1).toBe(3)
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.cursors).toEqual({ c1: 0 })
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/api/client.test.ts`
Expected: FAIL (login-Rückgabetyp/`createChild` fehlen).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/api/client.ts` `login`/`postSync` ändern und Child-Funktionen
ergänzen:
```ts
import type { SyncResponse, Child, Role, Gender } from '../types'

export function login(email: string, password: string) {
  return request<{ token: string; userId: string }>('/login', { method: 'POST', body: { email, password } })
}

export function postSync(token: string, body: { cursors: Record<string, number>; changes: unknown[] }) {
  return request<SyncResponse>('/sync', { method: 'POST', body, token })
}

export function createChild(
  token: string,
  input: { name: string; gender: Gender; birthDate: string; birthWeightGrams: number | null; role: Role },
) {
  return request<{ child: Child }>('/children', { method: 'POST', body: input, token })
}

export function patchChild(
  token: string,
  id: string,
  patch: { name?: string; gender?: Gender; birthDate?: string; birthWeightGrams?: number | null },
) {
  return request<{ child: Child }>(`/children/${id}`, { method: 'PATCH', body: patch, token })
}

export function deleteChild(token: string, id: string) {
  return request<void>(`/children/${id}`, { method: 'DELETE', token })
}

export function createInvitation(token: string, childId: string) {
  return request<{ code: string; expiresAt: string }>(`/children/${childId}/invitations`, { method: 'POST', token })
}

export function acceptInvitation(token: string, code: string, role: Role) {
  return request<{ child: Child }>(`/invitations/${code}/accept`, { method: 'POST', body: { role }, token })
}

export function leaveChild(token: string, childId: string) {
  return request<void>(`/children/${childId}/members/me`, { method: 'DELETE', token })
}
```
Damit `request<void>` mit DELETE (204, kein JSON) funktioniert, in `request`
die finale Zeile absichern:
```ts
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/api/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(frontend): children API client + login userId"
```

---

### Task B3: syncEngine auf cursors-Map + children-Merge

**Files:**
- Modify: `frontend/src/sync/syncEngine.ts`
- Test: `frontend/src/sync/syncEngine.test.ts` (anpassen/erweitern)

**Interfaces:**
- Consumes: `postSync`-Signatur aus B2, `SyncResponse`, `Child`.
- Produces: `runSync(db, postSync)` nutzt Meta `cursors` (Record), pusht dirty
  Logs (inkl. `childId`), merged `resp.changes` (Feld `createdById` →
  `createdByUserId`), schreibt `resp.children` in `db.children`, aktualisiert
  `cursors`. Rückgabe: `{ skipped?, pushed, pulled, cursors }`.

- [ ] **Step 1: Write the failing test**

Ersetze die Cursor-Erwartungen in `syncEngine.test.ts`. Kerntest:
```ts
test('stores per-child cursors and children, maps createdById', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 't1')
  await db.logs.put({ id: 'l1', type: 'nursing', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-01T10:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, side: 'left' })

  const postSync = vi.fn().mockResolvedValue({
    cursors: { c1: 7 },
    children: [{ id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: '2026-01-01T00:00:00Z', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] }],
    changes: [{ id: 'l2', type: 'bottle', childId: 'c1', createdById: 'u2', occurredAt: '2026-02-01T12:00:00Z', updatedAt: '2026-02-01T12:00:00Z', deletedAt: null, serverSeq: 7, amountMl: 90 }],
  })

  const res = await runSync(db, postSync)

  const sent = postSync.mock.calls[0][1]
  expect(sent.cursors).toEqual({}) // initial leer
  expect(sent.changes[0].childId).toBe('c1')
  expect(res.pulled).toBe(1)

  const merged = await db.logs.get('l2')
  expect(merged?.createdByUserId).toBe('u2')
  expect(await getMeta(db, 'cursors')).toEqual({ c1: 7 })
  expect((await db.children.get('c1'))?.name).toBe('Mia')
  await db.delete()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/sync/syncEngine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/sync/syncEngine.ts` (Neufassung):
```ts
import type { AppDB } from '../db/database'
import { getMeta, setMeta } from '../db/database'
import type { LogRecord, ServerChange, SyncResponse } from '../types'
import { isAfter } from '../time'

export type PostSyncFn = (
  token: string,
  body: { cursors: Record<string, number>; changes: unknown[] },
) => Promise<SyncResponse>

function toPayload(rec: LogRecord): Record<string, unknown> {
  const { dirty: _dirty, createdByUserId, ...rest } = rec
  return { ...rest, createdById: createdByUserId }
}

async function mergeIncoming(db: AppDB, inc: ServerChange): Promise<void> {
  const local = await db.logs.get(inc.id)
  if (local && local.dirty === 1 && isAfter(local.updatedAt, inc.updatedAt)) {
    return
  }
  const { createdById, ...fields } = inc
  await db.logs.put({ ...(fields as Omit<ServerChange, 'createdById'>), createdByUserId: createdById, dirty: 0 })
}

export async function runSync(
  db: AppDB,
  postSync: PostSyncFn,
): Promise<{ skipped?: 'no-token'; pushed: number; pulled: number; cursors: Record<string, number> }> {
  const token = await getMeta<string>(db, 'token')
  const cursors = (await getMeta<Record<string, number>>(db, 'cursors')) ?? {}
  if (!token) return { skipped: 'no-token', pushed: 0, pulled: 0, cursors }

  const dirty = await db.logs.where('dirty').equals(1).toArray()
  const changes = dirty.map(toPayload)

  const resp = await postSync(token, { cursors, changes }) // wirft AuthError bei 401

  await db.transaction('rw', db.logs, db.children, db.meta, async () => {
    for (const inc of resp.changes) await mergeIncoming(db, inc)
    for (const child of resp.children) await db.children.put(child)
    await setMeta(db, 'cursors', resp.cursors)
  })

  return { pushed: changes.length, pulled: resp.changes.length, cursors: resp.cursors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/sync/syncEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/sync/syncEngine.ts frontend/src/sync/syncEngine.test.ts
git commit -m "feat(frontend): per-child cursors + children merge in syncEngine"
```

---

### Task B4: Repository auf childId + Urheber filtern

**Files:**
- Modify: `frontend/src/db/repository.ts`
- Test: `frontend/src/db/repository.test.ts` (anpassen/erweitern)

**Interfaces:**
- Produces (alle Query/Write-Funktionen erhalten `childId`):
  - `addLog(db, childId, createdByUserId, input): Promise<LogRecord>`
  - `getLogsByDay(db, childId, dayStartIso, dayEndIso)`
  - `getWeightSeries(db, childId)`
  - `getLogsSince(db, childId, sinceIso)`
  - `updateLog`/`softDeleteLog` unverändert (per `id`).

- [ ] **Step 1: Write the failing test**

In `repository.test.ts` ergänzen/anpassen:
```ts
test('addLog stamps childId + creator; getLogsByDay filters by child', async () => {
  const db = createDb('test-repo-' + crypto.randomUUID())
  await addLog(db, 'c1', 'u1', { type: 'nursing', occurredAt: '2026-02-01T10:00:00Z', side: 'left' })
  await addLog(db, 'c2', 'u1', { type: 'nursing', occurredAt: '2026-02-01T11:00:00Z', side: 'right' })

  const day = await getLogsByDay(db, 'c1', '2026-02-01T00:00:00Z', '2026-02-02T00:00:00Z')
  expect(day).toHaveLength(1)
  expect(day[0].childId).toBe('c1')
  expect(day[0].createdByUserId).toBe('u1')
  await db.delete()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/db/repository.test.ts`
Expected: FAIL (Signatur passt nicht).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/db/repository.ts`:
- `addLog` Signatur `(db, childId, createdByUserId, input)`, im `base`-Objekt
  `childId` und `createdByUserId` ergänzen:
```ts
export async function addLog(db: AppDB, childId: string, createdByUserId: string | null, input: NewLogInput): Promise<LogRecord> {
  const now = nowIso()
  const base = {
    id: crypto.randomUUID(),
    childId,
    createdByUserId,
    occurredAt: input.occurredAt,
    updatedAt: now,
    deletedAt: null as string | null,
    serverSeq: null as number | null,
    dirty: 1 as const,
    note: ('note' in input ? input.note : null) ?? null,
  }
  // ... restlicher switch unverändert
```
- Den Query-Funktionen `childId` voranstellen und im `.filter(...)` ergänzen,
  z.B. `getLogsByDay`:
```ts
export async function getLogsByDay(db: AppDB, childId: string, dayStartIso: string, dayEndIso: string): Promise<LogRecord[]> {
  const start = Date.parse(dayStartIso)
  const end = Date.parse(dayEndIso)
  const rows = await db.logs
    .filter((r) => r.childId === childId && r.deletedAt === null && Date.parse(r.occurredAt) >= start && Date.parse(r.occurredAt) < end)
    .toArray()
  return rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}
```
  Analog `getWeightSeries(db, childId)` und `getLogsSince(db, childId, sinceIso)`
  jeweils mit `r.childId === childId &&` im Filter.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/db/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/db/repository.ts frontend/src/db/repository.test.ts
git commit -m "feat(frontend): repository scoped by childId + creator"
```

---

### Task B5: Children-Store-Hook + Cross-Account-Guard erweitern

**Files:**
- Create: `frontend/src/children/useChildren.ts`
- Modify: `frontend/src/auth/account.ts`
- Modify: `frontend/src/auth/useAuth.ts` (userId speichern, in `persist`)
- Test: `frontend/src/children/useChildren.test.ts`, `frontend/src/auth/account.test.ts` (erweitern)

**Interfaces:**
- Consumes: `db.children`, Meta `activeChildId`, `myUserId`, `cursors`.
- Produces:
  - `useChildren()` → `{ children: Child[]; activeChild: Child | null;
    activeChildId: string | null; myUserId: string | null; ready: boolean;
    setActiveChild(id: string): Promise<void>; refresh(): Promise<void> }`.
    Liefert nur nicht-gelöschte Kinder; setzt `activeChildId` automatisch auf das
    erste Kind, falls keines/Ungültiges gewählt.
  - `reconcileAccount(db, email)` leert zusätzlich `db.children` und Meta
    `cursors`/`activeChildId` bei Account-Wechsel.
  - `roleOf(child, userId): Role | null` (Helper, exportiert aus useChildren.ts).

- [ ] **Step 1: Write the failing test**

`frontend/src/auth/account.test.ts` ergänzen:
```ts
test('switching account clears children + cursors + activeChildId', async () => {
  const db = createDb('test-acct-' + crypto.randomUUID())
  await setMeta(db, 'accountId', 'old@b.c')
  await db.children.put({ id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] })
  await setMeta(db, 'cursors', { c1: 5 })
  await setMeta(db, 'activeChildId', 'c1')

  await reconcileAccount(db, 'new@b.c')

  expect(await db.children.count()).toBe(0)
  expect(await getMeta(db, 'cursors')).toEqual({})
  expect(await getMeta(db, 'activeChildId')).toBeUndefined()
  await db.delete()
})
```
`frontend/src/children/useChildren.test.ts`:
```ts
import { renderHook, waitFor, act } from '@testing-library/react'
import { createDb, setMeta } from '../db/database'
import { makeUseChildren } from './useChildren'

test('selects first child by default and switches', async () => {
  const db = createDb('test-uc-' + crypto.randomUUID())
  await db.children.bulkPut([
    { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
    { id: 'c2', name: 'Tom', gender: 'male', birthDate: '2026-03-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] },
  ])
  await setMeta(db, 'myUserId', 'u1')
  const useChildren = makeUseChildren(db)
  const { result } = renderHook(() => useChildren())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.activeChild?.id).toBe('c1')
  await act(async () => { await result.current.setActiveChild('c2') })
  expect(result.current.activeChild?.id).toBe('c2')
  await db.delete()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/children/useChildren.test.ts src/auth/account.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/auth/account.ts` erweitern:
```ts
export async function reconcileAccount(db: AppDB, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const prev = await getMeta<string>(db, 'accountId')
  if (prev && prev !== normalized) {
    await db.logs.clear()
    await db.children.clear()
    await setMeta(db, 'cursors', {})
    await db.meta.delete('activeChildId')
  }
  await setMeta(db, 'accountId', normalized)
}
```
`frontend/src/auth/useAuth.ts`: `signIn`/`signUp` speichern `userId`:
```ts
    async signIn(email: string, password: string) {
      const { token: t, userId } = await apiLogin(email, password)
      await setMeta(db, 'myUserId', userId)
      await persist(t, email)
    },
    async signUp(email: string, password: string) {
      await apiRegister(email, password)
      const { token: t, userId } = await apiLogin(email, password)
      await setMeta(db, 'myUserId', userId)
      await persist(t, email)
    },
```
`frontend/src/children/useChildren.ts`:
```ts
import { useCallback, useEffect, useState } from 'react'
import { db as defaultDb, getMeta, setMeta, type AppDB } from '../db/database'
import type { Child, Role } from '../types'

export function roleOf(child: Child | null, userId: string | null): Role | null {
  if (!child || !userId) return null
  return child.members.find((m) => m.userId === userId)?.role ?? null
}

export function makeUseChildren(db: AppDB) {
  return function useChildren() {
    const [children, setChildren] = useState<Child[]>([])
    const [activeChildId, setActiveId] = useState<string | null>(null)
    const [myUserId, setMyUserId] = useState<string | null>(null)
    const [ready, setReady] = useState(false)

    const refresh = useCallback(async () => {
      const all = (await db.children.toArray()).filter((c) => c.deletedAt === null)
      setChildren(all)
      const stored = await getMeta<string>(db, 'activeChildId')
      const valid = all.find((c) => c.id === stored) ? stored! : (all[0]?.id ?? null)
      if (valid !== stored) {
        if (valid) await setMeta(db, 'activeChildId', valid)
      }
      setActiveId(valid)
      setMyUserId((await getMeta<string>(db, 'myUserId')) ?? null)
      setReady(true)
    }, [])

    useEffect(() => { void refresh() }, [refresh])

    const setActiveChild = useCallback(async (id: string) => {
      await setMeta(db, 'activeChildId', id)
      setActiveId(id)
    }, [])

    const activeChild = children.find((c) => c.id === activeChildId) ?? null
    return { children, activeChild, activeChildId, myUserId, ready, setActiveChild, refresh }
  }
}

export const useChildren = makeUseChildren(defaultDb)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/children/useChildren.test.ts src/auth/account.test.ts`
Expected: PASS. (Falls `@testing-library/react` fehlt: prüfen mit
`npm ls @testing-library/react`; bestehende `*.test.tsx` nutzen es bereits.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/children frontend/src/auth
git commit -m "feat(frontend): children store hook + account guard for children"
```

---

# Teil C — Frontend: UI

### Task C1: Onboarding-Wizard (Kind anlegen / beitreten)

**Files:**
- Create: `frontend/src/ui/Onboarding.tsx`
- Test: `frontend/src/ui/Onboarding.test.tsx`

**Interfaces:**
- Consumes: `createChild`, `acceptInvitation` (B2), Meta `token`,
  `useChildren().refresh`.
- Produces: `<Onboarding token={string} onDone={() => void} />` — zwei Modi:
  „Kind anlegen" (Felder name, gender, birthDate, birthWeightGrams, eigene Rolle)
  und „Ich wurde eingeladen" (code + Rolle). Bei Erfolg `db.children.put(child)` +
  `onDone()`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { Onboarding } from './Onboarding'
import * as api from '../api/client'
import { db } from '../db/database'

test('creates first child and calls onDone', async () => {
  vi.spyOn(api, 'createChild').mockResolvedValue({
    child: { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: 3200, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
  })
  const onDone = vi.fn()
  render(<Onboarding token="t1" onDone={onDone} />)

  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Mia' } })
  fireEvent.change(screen.getByLabelText(/geburtsdatum/i), { target: { value: '2026-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: /anlegen/i }))

  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(await db.children.get('c1')).toBeTruthy()
  await db.children.clear()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/ui/Onboarding.test.tsx`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Write minimal implementation**

`frontend/src/ui/Onboarding.tsx` — Formular im bestehenden Tailwind-Stil
(dunkles Theme, Klassen analog zu `AuthScreen.tsx`). Kernlogik:
```tsx
import { useState } from 'react'
import type { Gender, Role } from '../types'
import { createChild, acceptInvitation } from '../api/client'
import { db } from '../db/database'

export function Onboarding({ token, onDone }: { token: string; onDone: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('female')
  const [birthDate, setBirthDate] = useState('')
  const [weight, setWeight] = useState('')
  const [role, setRole] = useState<Role>('mama')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true); setError(null)
    try {
      const res = mode === 'create'
        ? await createChild(token, { name, gender, birthDate, birthWeightGrams: weight ? Number(weight) : null, role })
        : await acceptInvitation(token, code.trim().toUpperCase(), role)
      await db.children.put(res.child)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">Willkommen 👋</h1>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setMode('create')} className={mode === 'create' ? 'font-semibold' : 'text-neutral-400'}>Kind anlegen</button>
          <button onClick={() => setMode('join')} className={mode === 'join' ? 'font-semibold' : 'text-neutral-400'}>Ich wurde eingeladen</button>
        </div>

        {mode === 'create' ? (
          <div className="space-y-3">
            <label className="block text-sm">Name
              <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2" />
            </label>
            <label className="block text-sm">Geschlecht
              <select aria-label="Geschlecht" value={gender} onChange={(e) => setGender(e.target.value as Gender)} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2">
                <option value="female">Mädchen</option>
                <option value="male">Junge</option>
                <option value="diverse">Divers</option>
              </select>
            </label>
            <label className="block text-sm">Geburtsdatum
              <input aria-label="Geburtsdatum" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2" />
            </label>
            <label className="block text-sm">Geburtsgewicht (g)
              <input aria-label="Geburtsgewicht" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2" />
            </label>
          </div>
        ) : (
          <label className="block text-sm">Einladungs-Code
            <input aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2" />
          </label>
        )}

        <label className="block text-sm">Ich bin
          <select aria-label="Rolle" value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2">
            <option value="mama">Mama</option>
            <option value="papa">Papa</option>
          </select>
        </label>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button disabled={busy} onClick={submit} className="w-full rounded-lg bg-indigo-500 py-2 font-medium disabled:opacity-50">
          {mode === 'create' ? 'Anlegen' : 'Beitreten'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/ui/Onboarding.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/Onboarding.tsx frontend/src/ui/Onboarding.test.tsx
git commit -m "feat(frontend): onboarding wizard (create/join child)"
```

---

### Task C2: Header-Umschalter + „Kind verwalten"-Sheet

**Files:**
- Create: `frontend/src/ui/ChildSwitcher.tsx`
- Create: `frontend/src/ui/ManageChild.tsx`
- Test: `frontend/src/ui/ChildSwitcher.test.tsx`

**Interfaces:**
- Consumes: `useChildren()` (children, activeChild, setActiveChild, refresh),
  `createInvitation`, `patchChild`, `deleteChild`, `leaveChild`, Meta `token`.
- Produces:
  - `<ChildSwitcher token={string} onAddChild={() => void} />` — Button mit
    aktivem Kindnamen; öffnet Sheet: Kinder-Liste (Auswahl), „Kind hinzufügen"
    (→ `onAddChild`), „Kind beitreten" (→ `onAddChild`, Join-Modus), je Kind
    „Verwalten" (→ `ManageChild`).
  - `<ManageChild child={Child} token={string} onClose={() => void} onChanged={() => void} />`
    — Infos editieren (patch), Mitglieder anzeigen, „Partner einladen" (Code via
    `createInvitation`, Kopieren), „Kind löschen", „Kind verlassen".

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ChildSwitcher } from './ChildSwitcher'
import * as childrenHook from '../children/useChildren'

test('shows active child name and lists children to switch', async () => {
  const setActiveChild = vi.fn()
  vi.spyOn(childrenHook, 'useChildren').mockReturnValue({
    children: [
      { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
      { id: 'c2', name: 'Tom', gender: 'male', birthDate: '2026-03-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] },
    ],
    activeChild: { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] },
    activeChildId: 'c1', myUserId: 'u1', ready: true, setActiveChild, refresh: vi.fn(),
  } as unknown as ReturnType<typeof childrenHook.useChildren>)

  render(<ChildSwitcher token="t1" onAddChild={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Mia/ }))
  fireEvent.click(screen.getByRole('button', { name: /Tom/ }))
  await waitFor(() => expect(setActiveChild).toHaveBeenCalledWith('c2'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/ui/ChildSwitcher.test.tsx`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Write minimal implementation**

`ChildSwitcher.tsx`: Button zeigt `activeChild?.name ?? 'Kind wählen'`; State
`open`; im offenen Sheet die Kinder mappen (`<button>{c.name}</button>` →
`setActiveChild(c.id)`), plus Buttons „Kind hinzufügen" / „Kind beitreten" (beide
rufen `onAddChild`) und je Kind „Verwalten" (öffnet `ManageChild`). Stil analog
zu `ConfirmDialog.tsx` (Portal/zentriert) bzw. als Dropdown im Header.
`ManageChild.tsx`: kontrollierte Felder vorbefüllt aus `child`; „Speichern" →
`patchChild` + `onChanged`; „Partner einladen" → `createInvitation` → Code im UI
mit `navigator.clipboard.writeText`; „Kind löschen" → `deleteChild` (mit
`ConfirmDialog`); „Kind verlassen" → `leaveChild`. Nach Mutationen lokal
`db.children` aktualisieren bzw. `refresh()` via `onChanged`.

(Vollständige JSX im Stil der bestehenden Komponenten; Pflichtelemente: Button
mit Kindname als Accessible Name, je Kind ein Button mit Kindname.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/ui/ChildSwitcher.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/ChildSwitcher.tsx frontend/src/ui/ManageChild.tsx frontend/src/ui/ChildSwitcher.test.tsx
git commit -m "feat(frontend): header child switcher + manage child sheet"
```

---

### Task C3: App-Verdrahtung (Gate, Header, View-Props)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/ui/QuickEntry.tsx`, `Timeline.tsx`, `StatsPage.tsx`, `WeightPage.tsx` (childId-Prop + Repo-Aufrufe)
- Test: `frontend/src/App.test.tsx` (Gate-Verhalten)

**Interfaces:**
- Consumes: `useChildren()`, `Onboarding`, `ChildSwitcher`.
- Produces: App rendert nach Login: wenn `ready && children.length === 0` →
  `<Onboarding>`; sonst Haupt-App mit `<ChildSwitcher>` im Header und
  `activeChild` an die Views durchgereicht. Views nutzen die child-scoped
  Repository-Funktionen (B4) und zeigen Urheber-Label via `roleOf`.

- [ ] **Step 1: Write the failing test**

In `App.test.tsx`:
```tsx
test('shows onboarding when authed but no children', async () => {
  // token in meta, children leer
  await setMeta(db, 'token', 't1')
  await db.children.clear()
  render(<App />)
  await waitFor(() => expect(screen.getByText(/Willkommen/)).toBeInTheDocument())
})
```
(Setup an die bestehenden App-Tests anlehnen; ggf. `useAuth`/`syncController`
mocken wie dort bereits etabliert.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/App.test.tsx`
Expected: FAIL (kein Onboarding-Gate).

- [ ] **Step 3: Write minimal implementation**

In `App.tsx`:
- `const children = useChildren()` nach `useAuth()`.
- Nach `if (!auth.token) return <AuthScreen .../>`:
```tsx
  if (!children.ready) return null
  if (children.children.length === 0)
    return <Onboarding token={auth.token} onDone={() => children.refresh()} />
```
- Im Header den statischen Titel durch
  `<ChildSwitcher token={auth.token} onAddChild={() => setAddingChild(true)} />`
  ersetzen (State `addingChild`; bei `true` `<Onboarding>` als Overlay rendern,
  `onDone` → `refresh()` + `setAddingChild(false)`).
- Views erhalten `child={children.activeChild!} myUserId={children.myUserId}`.
- In `QuickEntry`, `Timeline`, `StatsPage`, `WeightPage` die Props ergänzen und
  Repository-Aufrufe auf `child.id` (und `addLog(db, child.id, myUserId, ...)`)
  umstellen. In `Timeline` je Eintrag ein Label aus
  `roleOf(child, row.createdByUserId)` (`'mama'→'Mama'`, `'papa'→'Papa'`)
  anzeigen.

- [ ] **Step 4: Run full frontend suite**

Run: `cd frontend && npm test`
Expected: gesamte Suite grün (alle in B/C angepassten Tests inklusive).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): onboarding gate, child switcher in header, child-scoped views"
```

---

# Teil D — PWA: Versionierung & erzwingbares Update

### Task D1: Auto-Versionsnummer aus Git (Vite-Inject + version.json)

**Files:**
- Create: `frontend/scripts/version.ts` (oder inline in `vite.config.ts`)
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/version.ts`
- Test: `frontend/src/version.test.ts`

**Interfaces:**
- Produces:
  - Build-Define `__APP_VERSION__: string` (Format `"<build> · <sha> · <date>"`)
    und `__APP_BUILD__: number`.
  - `frontend/src/version.ts`: `export const APP_VERSION: string`,
    `export const APP_BUILD: number`, `parseVersion(...)`-Helper für Tests.
  - Plugin schreibt `dist/version.json` `{ version, build, builtAt }`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildVersionString } from './version'

test('builds version string from git parts with fallback', () => {
  expect(buildVersionString({ build: 143, sha: 'a1b2c3d', date: '2026-06-30' }))
    .toBe('Version 143 · a1b2c3d · 2026-06-30')
  expect(buildVersionString({ build: 0, sha: 'dev', date: '2026-06-30' }))
    .toBe('Version dev · dev · 2026-06-30')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/version.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Write minimal implementation**

`frontend/src/version.ts`:
```ts
declare const __APP_VERSION__: string
declare const __APP_BUILD__: number

export function buildVersionString(p: { build: number; sha: string; date: string }): string {
  const b = p.build > 0 ? String(p.build) : p.sha
  return `Version ${b} · ${p.sha} · ${p.date}`
}

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'Version dev'
export const APP_BUILD: number =
  typeof __APP_BUILD__ === 'number' ? __APP_BUILD__ : 0
```
In `frontend/vite.config.ts` oben Git-Werte ermitteln (mit Fallback) und als
`define` injizieren + version.json schreiben:
```ts
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

function git(cmd: string, fallback: string): string {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return fallback }
}
const build = Number(git('git rev-list --count HEAD', '0'))
const sha = git('git rev-parse --short HEAD', 'dev')
const date = git('git log -1 --format=%cs', new Date().toISOString().slice(0, 10))
const versionString = `Version ${build > 0 ? build : sha} · ${sha} · ${date}`

const emitVersionJson = {
  name: 'emit-version-json',
  closeBundle() {
    mkdirSync('dist', { recursive: true })
    writeFileSync('dist/version.json', JSON.stringify({ version: versionString, build, builtAt: new Date().toISOString() }))
  },
}
```
Im `defineConfig` ergänzen:
```ts
  define: {
    __APP_VERSION__: JSON.stringify(versionString),
    __APP_BUILD__: build,
  },
  plugins: [react(), tailwindcss(), emitVersionJson, VitePWA({ /* ... */ })],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/version.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/vite.config.ts frontend/src/version.ts frontend/src/version.test.ts
git commit -m "feat(frontend): auto version from git + version.json"
```

---

### Task D2: SW-Update-Flow + Banner + „Nach Updates suchen"

**Files:**
- Modify: `frontend/vite.config.ts` (workbox skipWaiting/clientsClaim/cleanup)
- Create: `frontend/src/pwa/updates.ts`
- Create: `frontend/src/ui/UpdateBanner.tsx`
- Modify: `frontend/src/main.tsx` (SW registrieren über updates.ts)
- Modify: `frontend/src/App.tsx` (UpdateBanner + Version in „Verwalten")
- Test: `frontend/src/pwa/updates.test.ts`, `frontend/src/pwa.config.test.ts` (erweitern)

**Interfaces:**
- Produces:
  - `registerPwa(onNeedRefresh: () => void): { update: () => Promise<void>; applyUpdate: () => void }`
    — kapselt `registerSW` aus `virtual:pwa-register`; periodische `update()` per
    Intervall + `visibilitychange`/`focus`.
  - `hardReset(): Promise<void>` — löscht alle Caches und reload.
  - `checkLatestVersion(currentBuild: number): Promise<number | null>` — pollt
    `/version.json` (network-first), liefert neuere Build-Nummer oder null.
  - `<UpdateBanner onUpdate={() => void} latest={string | null} />`.

- [ ] **Step 1: Write the failing test**

```ts
import { hardReset, checkLatestVersion } from './updates'

test('checkLatestVersion returns newer build', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ build: 150 }) }))
  expect(await checkLatestVersion(143)).toBe(150)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ build: 143 }) }))
  expect(await checkLatestVersion(143)).toBeNull()
  vi.unstubAllGlobals()
})

test('hardReset deletes all caches and reloads', async () => {
  const del = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('caches', { keys: async () => ['a', 'b'], delete: del })
  const reload = vi.fn()
  vi.stubGlobal('location', { reload } as unknown as Location)
  await hardReset()
  expect(del).toHaveBeenCalledTimes(2)
  expect(reload).toHaveBeenCalled()
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/pwa/updates.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Write minimal implementation**

`frontend/src/pwa/updates.ts`:
```ts
import { registerSW } from 'virtual:pwa-register'

export async function checkLatestVersion(currentBuild: number): Promise<number | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { build: number }
    return data.build > currentBuild ? data.build : null
  } catch { return null }
}

export async function hardReset(): Promise<void> {
  if ('caches' in globalThis) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  location.reload()
}

export function registerPwa(onNeedRefresh: () => void): { update: () => Promise<void>; applyUpdate: () => void } {
  let swUpdate: ((reload?: boolean) => Promise<void>) | undefined
  let registration: ServiceWorkerRegistration | undefined

  swUpdate = registerSW({
    onNeedRefresh,
    onRegisteredSW(_swUrl, r) {
      registration = r
      if (r) {
        setInterval(() => { void r.update() }, 60 * 60 * 1000)
      }
    },
  })

  const checkNow = () => { if (registration) void registration.update() }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkNow() })
  window.addEventListener('focus', checkNow)

  return {
    update: async () => { if (registration) await registration.update() },
    applyUpdate: () => { void swUpdate?.(true) },
  }
}
```
`frontend/src/ui/UpdateBanner.tsx` — Banner im Stil des „Sitzung abgelaufen"-
Banners (sticky, amber), Text „Neue Version verfügbar{latest ? ` (${latest})` :
''} – jetzt aktualisieren", Klick → `onUpdate`.
`frontend/src/main.tsx` — `registerPwa(...)` aufrufen, `onNeedRefresh` setzt
einen globalen State/Event, den `App` über ein einfaches Modul-Listener-Muster
liest (analog `syncController.onChange`), oder direkt in `App` via `useEffect`
registrieren statt in `main.tsx`. (Empfohlen: in `App` registrieren, State
`updateReady`.)
`frontend/vite.config.ts` — im `VitePWA({...})` `workbox` erweitern:
```ts
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
```
`frontend/src/App.tsx` — `UpdateBanner` rendern, wenn `updateReady`; in der
„Statistik/Verwalten"-Sektion `APP_VERSION` anzeigen plus Button „Nach Updates
suchen" (→ `checkLatestVersion` + `registration.update()`) und „Hart neu laden"
(→ `hardReset`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/pwa/updates.test.ts`
Expected: PASS. (Hinweis: `virtual:pwa-register` ist ein Vite-Virtual-Modul; in
Vitest ggf. in `src/test/setup.ts` mocken:
`vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }))`.)

In `frontend/src/pwa.config.test.ts` zusätzlich prüfen:
```ts
expect(cfg).toMatch(/skipWaiting: true/)
expect(cfg).toMatch(/cleanupOutdatedCaches: true/)
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pwa frontend/src/ui/UpdateBanner.tsx frontend/src/main.tsx frontend/src/App.tsx frontend/vite.config.ts frontend/src/pwa.config.test.ts frontend/src/test/setup.ts
git commit -m "feat(frontend): forced PWA update flow + version UI"
```

---

### Task D3: End-to-End-Verifikation (Build + volle Suiten)

**Files:** keine (Verifikation)

- [ ] **Step 1: Backend-Suite**

Run: `cd backend && php bin/phpunit`
Expected: alle Tests grün; `php bin/console doctrine:schema:validate` OK.

- [ ] **Step 2: Frontend-Suite + typecheck + build**

Run:
```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
```
Expected: Tests grün, kein Typfehler, Build erfolgreich; `dist/version.json`
existiert mit aktueller Build-Nummer.

- [ ] **Step 3: Manuelle Smoke-Checks (dev)**

Backend `:8080`, Frontend `:5173`. Prüfen: Registrierung → Onboarding erscheint →
Kind anlegen → Eintrag erfassen → in Timeline mit „Mama/Papa"-Label → zweiten
Account, per Code beitreten → sieht dieselben Einträge → Kind-Wechsel filtert
Einträge. (Backend muss laufen; siehe Memory: Backend `:8080`, Docker DB
Port 3307.)

- [ ] **Step 4: Commit (falls Fixes nötig waren)**

```bash
git add -A && git commit -m "test: end-to-end verification fixes"
```

---

## Self-Review (durchgeführt)

**Spec-Coverage:** Teil 1 (Datenmodell) → A1–A4. Teil 2 (Sync) → A5, B3. Teil 3
(API) → A6. Teil 4 (Client+UI) → B1–B5, C1–C3. Teil 5 (Versionierung/PWA) →
D1–D2. Teil 6 (Tests) → in jede Task integriert + D3. Alle Spec-Abschnitte haben
zugeordnete Tasks.

**Platzhalter:** Konkrete UI-JSX in C2/C3 ist absichtlich teils prosaisch
beschrieben (an bestehende Komponenten angelehnt), aber mit exakten Pflicht-
Interfaces, Funktionsnamen und Repo-Aufrufen — keine offenen TBDs in Logik/Tests.

**Typ-Konsistenz:** `childId`/`createdByUserId` (Client) ↔ `childId`/`createdById`
(Server-Wire) durchgängig; Mapping in B3 (`mergeIncoming`) und B4 (`toPayload`).
`cursors: Record<string,number>` einheitlich in B2/B3. `Role`/`Gender` in types,
client, UI identisch. `roleOf`/`useChildren`-Signaturen in B5 definiert, in
C2/C3 konsumiert.
