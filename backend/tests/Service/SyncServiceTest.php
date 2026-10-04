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

    /** @var list<Uuid> tracked child UUIDs for tearDown cleanup */
    private array $createdChildIds = [];
    /** @var list<string> tracked user emails for tearDown cleanup */
    private array $createdUserEmails = [];

    protected function setUp(): void
    {
        self::bootKernel();
        $c = static::getContainer();
        $this->em = $c->get(EntityManagerInterface::class);
        $this->sync = $c->get(SyncService::class);
        $this->createdChildIds = [];
        $this->createdUserEmails = [];

        // Crash-recovery pre-clean: removes stale data if a previous run crashed before tearDown.
        $conn = $this->em->getConnection();
        $conn->executeStatement("DELETE FROM child WHERE name = 'Mia'");
        $conn->executeStatement("DELETE FROM app_user WHERE email IN (
            'a@b.c','owner@b.c','stranger@b.c','owner2@b.c','partner2@b.c',
            'lww1@b.c','lww2@b.c','softdel@b.c','incr@b.c','seq@b.c'
        )");
    }

    protected function tearDown(): void
    {
        // Normal-path cleanup by PK — not fragile like name='Mia'.
        foreach ($this->createdChildIds as $uuid) {
            try {
                $this->em->createQuery('DELETE FROM App\Entity\Child c WHERE c.id = :id')
                    ->setParameter('id', $uuid, 'uuid')
                    ->execute();
            } catch (\Throwable) {
                // Already gone (e.g. cascade from user delete) — ignore.
            }
        }
        if ($this->createdUserEmails !== []) {
            $this->em->createQuery('DELETE FROM App\Entity\User u WHERE u.email IN (:emails)')
                ->setParameter('emails', $this->createdUserEmails)
                ->execute();
        }
        parent::tearDown();
    }

    private function user(string $email): User
    {
        $this->createdUserEmails[] = $email;
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
        $this->createdChildIds[] = $child->getId(); // track for PK-based tearDown
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

    // ── Original 3 tests ──────────────────────────────────────────────────────

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

    public function test_height_measurement_syncs_with_decimal_centimetres(): void
    {
        $owner = $this->user('height-owner@b.c');
        $child = $this->childWithMember($owner);
        $this->em->flush();
        $cid = (string) $child->getId();
        $change = [
            'id' => (string) Uuid::v4(), 'type' => 'height', 'childId' => $cid,
            'occurredAt' => '2026-02-01T10:00:00+00:00',
            'updatedAt' => '2026-02-01T10:00:00+00:00',
            'deletedAt' => null, 'heightCm' => 52.5, 'note' => 'Vorsorge',
        ];

        $result = $this->sync->sync($owner, [], [$change]);
        self::assertSame('height', $result['changes'][0]['type']);
        self::assertSame(52.5, $result['changes'][0]['heightCm']);
        self::assertSame('Vorsorge', $result['changes'][0]['note']);
        self::assertSame(1, $result['cursors'][$cid]);
        self::assertSame(52.5, $this->sync->sync($owner, [], [])['changes'][0]['heightCm']);
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

    // ── 5 restored correctness tests ─────────────────────────────────────────

    /**
     * LWW: a later-arriving change with an older updatedAt must be ignored.
     * The stored row must retain the data that was written with the newer timestamp.
     */
    public function test_lww_ignores_older_incoming(): void
    {
        $u = $this->user('lww1@b.c');
        $child = $this->childWithMember($u);
        $this->em->flush();
        $cid = (string) $child->getId();
        $id = (string) Uuid::v4();

        // First: push at T2 (newer)
        $changeT2 = [
            'id' => $id, 'type' => 'nursing', 'childId' => $cid,
            'occurredAt' => '2026-02-01T10:00:00+00:00',
            'updatedAt'  => '2026-02-01T12:00:00+00:00',
            'deletedAt'  => null,
            'side' => 'right', 'durationMinutes' => 20, 'note' => null,
        ];
        $this->sync->sync($u, [], [$changeT2]);

        // Then: push same id with OLDER T1 and different field values
        $changeT1 = [
            'id' => $id, 'type' => 'nursing', 'childId' => $cid,
            'occurredAt' => '2026-02-01T09:00:00+00:00',
            'updatedAt'  => '2026-02-01T09:00:00+00:00',
            'deletedAt'  => null,
            'side' => 'left', 'durationMinutes' => 5, 'note' => null,
        ];
        $res = $this->sync->sync($u, [], [$changeT1]);

        // No write happened → cursor must not advance beyond 1
        self::assertSame(1, $res['cursors'][$cid]);

        // Pull from 0 → one row, data must be the T2 values
        $pull = $this->sync->sync($u, [], []);
        self::assertCount(1, $pull['changes']);
        self::assertSame('right', $pull['changes'][0]['side']);
        self::assertSame(20, $pull['changes'][0]['durationMinutes']);
    }

    /**
     * LWW: a newer incoming change must overwrite the stored row and bump the cursor.
     */
    public function test_newer_incoming_overwrites_and_bumps_cursor(): void
    {
        $u = $this->user('lww2@b.c');
        $child = $this->childWithMember($u);
        $this->em->flush();
        $cid = (string) $child->getId();
        $id = (string) Uuid::v4();

        // Push at T1
        $changeT1 = [
            'id' => $id, 'type' => 'nursing', 'childId' => $cid,
            'occurredAt' => '2026-02-01T09:00:00+00:00',
            'updatedAt'  => '2026-02-01T09:00:00+00:00',
            'deletedAt'  => null,
            'side' => 'left', 'durationMinutes' => 5, 'note' => null,
        ];
        $res1 = $this->sync->sync($u, [], [$changeT1]);
        self::assertSame(1, $res1['cursors'][$cid]);

        // Push same id with NEWER T2 and different field values
        $changeT2 = [
            'id' => $id, 'type' => 'nursing', 'childId' => $cid,
            'occurredAt' => '2026-02-01T10:00:00+00:00',
            'updatedAt'  => '2026-02-01T12:00:00+00:00',
            'deletedAt'  => null,
            'side' => 'right', 'durationMinutes' => 20, 'note' => null,
        ];
        $res2 = $this->sync->sync($u, [], [$changeT2]);
        self::assertSame(2, $res2['cursors'][$cid]);

        // Pull all → one row with updated data
        $pull = $this->sync->sync($u, [], []);
        self::assertCount(1, $pull['changes']);
        self::assertSame('right', $pull['changes'][0]['side']);
        self::assertSame(20, $pull['changes'][0]['durationMinutes']);
    }

    /**
     * Soft-delete: pushing deletedAt must be preserved and returned on pull.
     */
    public function test_soft_delete_round_trip(): void
    {
        $u = $this->user('softdel@b.c');
        $child = $this->childWithMember($u);
        $this->em->flush();
        $cid = (string) $child->getId();
        $id = (string) Uuid::v4();

        // Create the row
        $this->sync->sync($u, [], [[
            'id' => $id, 'type' => 'nursing', 'childId' => $cid,
            'occurredAt' => '2026-02-01T10:00:00+00:00',
            'updatedAt'  => '2026-02-01T10:00:00+00:00',
            'deletedAt'  => null,
            'side' => 'left', 'durationMinutes' => 10, 'note' => null,
        ]]);

        // Soft-delete it (newer updatedAt)
        $this->sync->sync($u, [], [[
            'id' => $id, 'type' => 'nursing', 'childId' => $cid,
            'occurredAt' => '2026-02-01T10:00:00+00:00',
            'updatedAt'  => '2026-02-01T11:00:00+00:00',
            'deletedAt'  => '2026-02-01T11:00:00+00:00',
            'side' => 'left', 'durationMinutes' => 10, 'note' => null,
        ]]);

        // Pull from 0 → the row must appear with non-null deletedAt
        $pull = $this->sync->sync($u, [$cid => 0], []);
        $found = null;
        foreach ($pull['changes'] as $c) {
            if ($c['id'] === $id) {
                $found = $c;
                break;
            }
        }
        self::assertNotNull($found, 'Soft-deleted row expected in pull result');
        self::assertNotNull($found['deletedAt']);
    }

    /**
     * Incremental pull: syncing with a non-zero cursor returns only newer changes.
     */
    public function test_incremental_pull_from_non_zero_cursor(): void
    {
        $u = $this->user('incr@b.c');
        $child = $this->childWithMember($u);
        $this->em->flush();
        $cid = (string) $child->getId();

        // Push two changes in one call → serverSeq 1 and 2
        $c1 = $this->nursingChange($child, '2026-02-01T10:00:00+00:00');
        $c2 = $this->nursingChange($child, '2026-02-01T11:00:00+00:00');
        $this->sync->sync($u, [], [$c1, $c2]);

        // Pull from cursor 1 → only c2 (serverSeq 2) must be returned
        $res = $this->sync->sync($u, [$cid => 1], []);
        self::assertCount(1, $res['changes']);
        self::assertSame($c2['id'], $res['changes'][0]['id']);
        self::assertSame(2, $res['changes'][0]['serverSeq']);
    }

    /**
     * Sequential bumps assign distinct serverSeq values (guards the refresh fix).
     *
     * In a single-threaded test, Doctrine's identity map already carries the correct
     * syncCounter from the first commit, so the test passes with or without the refresh.
     * The refresh fix is critical only under true concurrent requests (two separate PHP
     * processes each loading a stale counter before the other commits). That race cannot
     * be reproduced in a single-threaded test; this test verifies the sequential re-read
     * and guards against regressions that might break counter propagation entirely.
     */
    public function test_sequential_bumps_assign_distinct_server_seq(): void
    {
        $u = $this->user('seq@b.c');
        $child = $this->childWithMember($u);
        $this->em->flush();
        $cid = (string) $child->getId();

        $c1 = $this->nursingChange($child, '2026-02-01T10:00:00+00:00');
        $res1 = $this->sync->sync($u, [], [$c1]);
        self::assertSame(1, $res1['cursors'][$cid]);
        self::assertSame(1, $res1['changes'][0]['serverSeq']);

        // Second sync: pass cursor=1 so pull returns only the new row
        $c2 = $this->nursingChange($child, '2026-02-01T11:00:00+00:00');
        $res2 = $this->sync->sync($u, [$cid => 1], [$c2]);
        self::assertSame(2, $res2['cursors'][$cid]);
        self::assertCount(1, $res2['changes']);
        self::assertSame(2, $res2['changes'][0]['serverSeq']);
    }
}
