<?php
declare(strict_types=1);
namespace App\Entity\Contract;

use App\Entity\User;
use Symfony\Component\Uid\Uuid;

interface Syncable
{
    public static function type(): string;

    public function getId(): Uuid;
    public function getUser(): User;
    public function setUser(User $user): void;
    public function getOccurredAt(): \DateTimeImmutable;
    public function setOccurredAt(\DateTimeImmutable $t): void;
    public function getUpdatedAt(): \DateTimeImmutable;
    public function setUpdatedAt(\DateTimeImmutable $t): void;
    public function getDeletedAt(): ?\DateTimeImmutable;
    public function setDeletedAt(?\DateTimeImmutable $t): void;
    public function getServerSeq(): ?int;
    public function setServerSeq(int $seq): void;

    /** Wendet typ-spezifische Felder aus dem Sync-Payload an. */
    public function applyData(array $data): void;

    /** Serialisiert inkl. gemeinsamer + typ-spezifischer Felder für den Pull. */
    public function toArray(): array;
}
