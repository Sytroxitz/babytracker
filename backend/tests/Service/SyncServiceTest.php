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
        // Clean up any data left from a previous run (fixed emails would collide)
        $conn = $this->em->getConnection();
        $conn->executeStatement("DELETE FROM child WHERE name = 'Mia'"); // cascades logs + memberships
        $conn->executeStatement("DELETE FROM app_user WHERE email IN ('a@b.c','owner@b.c','stranger@b.c','owner2@b.c','partner2@b.c')");
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
