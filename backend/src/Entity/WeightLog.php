<?php
declare(strict_types=1);
namespace App\Entity;

use App\Entity\Concerns\SyncableTrait;
use App\Entity\Contract\Syncable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'weight_log')]
#[ORM\UniqueConstraint(name: 'uniq_weight_log_child_seq', columns: ['child_id', 'server_seq'])]
class WeightLog implements Syncable
{
    use SyncableTrait;

    #[ORM\Column]
    private int $weightGrams;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $note = null;

    public static function type(): string { return 'weight'; }

    public function applyData(array $data): void
    {
        $this->weightGrams = $data['weightGrams'];
        $this->note = $data['note'] ?? null;
    }

    public function toArray(): array
    {
        return $this->baseArray() + [
            'type' => self::type(),
            'weightGrams' => $this->weightGrams,
            'note' => $this->note,
        ];
    }
}
