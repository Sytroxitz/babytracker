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
