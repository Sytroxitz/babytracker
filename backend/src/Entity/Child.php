<?php
declare(strict_types=1);
namespace App\Entity;

use App\Repository\ChildRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: ChildRepository::class)]
#[ORM\Table(name: 'child')]
class Child
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\Column(length: 120)]
    private string $name;

    #[ORM\Column(length: 10)]
    private string $gender;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $birthDate;

    #[ORM\Column(nullable: true)]
    private ?int $birthWeightGrams = null;

    #[ORM\Column(type: Types::INTEGER, options: ['default' => 0])]
    private int $syncCounter = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function __construct(string $name, string $gender, \DateTimeImmutable $birthDate, ?int $birthWeightGrams)
    {
        $this->id = Uuid::v4();
        $this->name = $name;
        $this->gender = $gender;
        $this->birthDate = $birthDate;
        $this->birthWeightGrams = $birthWeightGrams;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $v): void { $this->name = $v; }
    public function getGender(): string { return $this->gender; }
    public function setGender(string $v): void { $this->gender = $v; }
    public function getBirthDate(): \DateTimeImmutable { return $this->birthDate; }
    public function setBirthDate(\DateTimeImmutable $v): void { $this->birthDate = $v; }
    public function getBirthWeightGrams(): ?int { return $this->birthWeightGrams; }
    public function setBirthWeightGrams(?int $v): void { $this->birthWeightGrams = $v; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getDeletedAt(): ?\DateTimeImmutable { return $this->deletedAt; }
    public function setDeletedAt(?\DateTimeImmutable $v): void { $this->deletedAt = $v; }
    public function getSyncCounter(): int { return $this->syncCounter; }
    public function bumpSyncCounter(): int { return ++$this->syncCounter; }

    /** @param array<array<string,mixed>> $members */
    public function toArray(array $members): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'gender' => $this->gender,
            'birthDate' => $this->birthDate->format('Y-m-d'),
            'birthWeightGrams' => $this->birthWeightGrams,
            'createdAt' => $this->createdAt->format(DATE_ATOM),
            'deletedAt' => $this->deletedAt?->format(DATE_ATOM),
            'members' => array_values($members),
        ];
    }
}
