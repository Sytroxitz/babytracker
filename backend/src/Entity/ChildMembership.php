<?php
declare(strict_types=1);
namespace App\Entity;

use App\Repository\ChildMembershipRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: ChildMembershipRepository::class)]
#[ORM\Table(name: 'child_membership')]
#[ORM\UniqueConstraint(name: 'uniq_membership_child_user', columns: ['child_id', 'user_id'])]
class ChildMembership
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Child::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Child $child;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 10)]
    private string $role;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    public function __construct(Child $child, User $user, string $role)
    {
        $this->id = Uuid::v4();
        $this->child = $child;
        $this->user = $user;
        $this->role = $role;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid { return $this->id; }
    public function getChild(): Child { return $this->child; }
    public function getUser(): User { return $this->user; }
    public function getRole(): string { return $this->role; }
    public function setRole(string $v): void { $this->role = $v; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
