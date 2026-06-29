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

        $r1 = $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T12:00:00+00:00', ['side' => 'right']),
        ]);
        // Älterer Stand darf den neueren nicht überschreiben
        $r2 = $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T11:00:00+00:00', ['side' => 'left']),
        ]);
        // A rejected (older) write must NOT advance the cursor
        $this->assertSame($r1['cursor'], $r2['cursor']);

        $result = $this->sync->sync($user, 0, []);
        $this->assertCount(1, $result['changes']);
        $this->assertSame('right', $result['changes'][0]['side']);
    }

    public function testNewerIncomingOverwritesAndBumpsCursor(): void
    {
        $user = $this->makeUser();
        $id = (string) Uuid::v4();

        // First sync: insert with side 'left' at T1
        $r1 = $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T10:00:00+00:00', ['side' => 'left']),
        ]);
        $cursorAfterFirst = $r1['cursor'];
        $this->assertSame(1, $cursorAfterFirst);

        // Second sync: NEWER change for same id, side 'right' at T2 > T1
        $r2 = $this->sync->sync($user, 0, [
            $this->change($id, '2026-06-01T11:00:00+00:00', ['side' => 'right']),
        ]);

        // (a) stored side is now 'right'
        $allChanges = $this->sync->sync($user, 0, [])['changes'];
        $this->assertSame('right', $allChanges[0]['side']);

        // (b) cursor advanced (second serverSeq assigned, cursor == 2)
        $this->assertSame(2, $r2['cursor']);

        // (c) a pull since the first cursor returns the updated row
        $pullSinceFirst = $this->sync->sync($user, $cursorAfterFirst, [])['changes'];
        $this->assertCount(1, $pullSinceFirst);
        $this->assertSame($id, $pullSinceFirst[0]['id']);
        $this->assertSame('right', $pullSinceFirst[0]['side']);
    }

    public function testBottleAndWeightRoundTrip(): void
    {
        $user = $this->makeUser();
        $bottleId = (string) Uuid::v4();
        $weightId = (string) Uuid::v4();

        $result = $this->sync->sync($user, 0, [
            [
                'type' => 'bottle',
                'id' => $bottleId,
                'occurredAt' => '2026-06-01T08:00:00+00:00',
                'updatedAt' => '2026-06-01T08:00:00+00:00',
                'deletedAt' => null,
                'amountMl' => 90,
            ],
            [
                'type' => 'weight',
                'id' => $weightId,
                'occurredAt' => '2026-06-01T09:00:00+00:00',
                'updatedAt' => '2026-06-01T09:00:00+00:00',
                'deletedAt' => null,
                'weightGrams' => 4200,
            ],
        ]);

        $this->assertCount(2, $result['changes']);

        $byType = [];
        foreach ($result['changes'] as $c) {
            $byType[$c['type']] = $c;
        }

        $this->assertArrayHasKey('bottle', $byType);
        $this->assertArrayHasKey('weight', $byType);
        $this->assertSame(90, $byType['bottle']['amountMl']);
        $this->assertSame('breastmilk', $byType['bottle']['milkType']);
        $this->assertSame(4200, $byType['weight']['weightGrams']);
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
