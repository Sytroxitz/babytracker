<?php
declare(strict_types=1);
namespace App\Tests\Service;

use App\Entity\User;
use App\Service\SyncService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Uid\Uuid;

class SyncServiceTest extends KernelTestCase
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

    private function makeUser(): User
    {
        $u = new User('s'.uniqid().'@test.de');
        $u->setPassword('x');
        $this->em->persist($u);
        $this->em->flush();
        return $u;
    }

    private function change(string $id, string $updatedAt, array $extra): array
    {
        return [
            'type' => 'nursing',
            'id' => $id,
            'occurredAt' => '2026-06-01T10:00:00+00:00',
            'updatedAt' => $updatedAt,
            'deletedAt' => null,
        ] + $extra;
    }

    public function testInsertAssignsServerSeq(): void
    {
        $user = $this->makeUser();
        $id = (string) Uuid::v4();

        $result = $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T10:00:00+00:00', ['side' => 'left', 'durationMinutes' => 12]),
        ]);

        $this->assertSame(1, $result['cursor']);
        $this->assertCount(1, $result['changes']);
        $this->assertSame($id, $result['changes'][0]['id']);
        $this->assertSame('left', $result['changes'][0]['side']);
        $this->assertSame(1, $result['changes'][0]['serverSeq']);
    }

    public function testLastWriteWinsIgnoresOlderIncoming(): void
    {
        $user = $this->makeUser();
        $id = (string) Uuid::v4();

        $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T12:00:00+00:00', ['side' => 'right']),
        ]);
        // Älterer Stand darf den neueren nicht überschreiben
        $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T11:00:00+00:00', ['side' => 'left']),
        ]);

        $result = $this->sync->sync($user, 0, []);
        $this->assertSame('right', $result['changes'][0]['side']);
    }

    public function testDeletePropagatesAndCursorFilters(): void
    {
        $user = $this->makeUser();
        $id = (string) Uuid::v4();

        $r1 = $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T10:00:00+00:00', ['side' => 'left']),
        ]);
        $cursorAfterInsert = $r1['cursor'];

        // Löschen (deletedAt gesetzt, neueres updatedAt)
        $r2 = $this->sync->sync($user, $cursorAfterInsert, [
            ['type' => 'nursing', 'id' => $id,
             'occurredAt' => '2026-06-01T10:00:00+00:00',
             'updatedAt' => '2026-06-01T13:00:00+00:00',
             'deletedAt' => '2026-06-01T13:00:00+00:00', 'side' => 'left'],
        ]);

        // Pull seit cursorAfterInsert liefert nur den gelöschten Eintrag
        $this->assertCount(1, $r2['changes']);
        $this->assertNotNull($r2['changes'][0]['deletedAt']);
        $this->assertGreaterThan($cursorAfterInsert, $r2['cursor']);
    }
}
