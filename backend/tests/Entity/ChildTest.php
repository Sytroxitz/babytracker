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
