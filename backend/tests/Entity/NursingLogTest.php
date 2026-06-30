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
