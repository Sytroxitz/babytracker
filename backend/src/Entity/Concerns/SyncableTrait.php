<?php
declare(strict_types=1);
namespace App\Entity\Concerns;

use App\Entity\User;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

trait SyncableTrait
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

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
    public function getUser(): User { return $this->user; }
    public function setUser(User $user): void { $this->user = $user; }
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
            'userId' => (string) $this->user->getId(),
            'occurredAt' => $this->occurredAt->format(DATE_ATOM),
            'updatedAt' => $this->updatedAt->format(DATE_ATOM),
            'deletedAt' => $this->deletedAt?->format(DATE_ATOM),
            'serverSeq' => $this->getServerSeq(),
        ];
    }
}
