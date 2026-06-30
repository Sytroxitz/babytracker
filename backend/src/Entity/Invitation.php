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
