<?php
declare(strict_types=1);
namespace App\Entity;

use App\Entity\Concerns\SyncableTrait;
use App\Entity\Contract\Syncable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'height_log')]
#[ORM\UniqueConstraint(name: 'uniq_height_log_child_seq', columns: ['child_id', 'server_seq'])]
class HeightLog implements Syncable
{
    use SyncableTrait;

    // Tenths of a centimetre preserve one decimal place without floating point drift.
    #[ORM\Column]
    private int $heightMm;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $note = null;

    public static function type(): string { return 'height'; }

    public function applyData(array $data): void
    {
        $this->heightMm = (int) round($data['heightCm'] * 10);
        $this->note = $data['note'] ?? null;
    }

    public function toArray(): array
    {
        return $this->baseArray() + [
            'type' => self::type(),
            'heightCm' => $this->heightMm / 10,
            'note' => $this->note,
        ];
    }
}
