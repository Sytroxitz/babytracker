<?php
namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'app_user')]
#[UniqueEntity('email')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\Column(length: 180, unique: true)]
    private string $email;

    #[ORM\Column]
    private string $password;

    #[ORM\Column(type: 'bigint', options: ['default' => 0])]
    private int $syncCounter = 0;

    public function __construct(string $email)
    {
        $this->id = Uuid::v4();
        $this->email = $email;
    }

    public function getId(): Uuid { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function getUserIdentifier(): string { return $this->email; }
    public function getRoles(): array { return ['ROLE_USER']; }
    public function getPassword(): string { return $this->password; }
    public function setPassword(string $hash): void { $this->password = $hash; }
    public function eraseCredentials(): void {}

    public function getSyncCounter(): int { return $this->syncCounter; }
    public function bumpSyncCounter(): int { return ++$this->syncCounter; }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function setSyncCounter(string $syncCounter): static
    {
        $this->syncCounter = $syncCounter;

        return $this;
    }
}
