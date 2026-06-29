<?php
declare(strict_types=1);
namespace App\Entity;

use App\Entity\Concerns\SyncableTrait;
use App\Entity\Contract\Syncable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'pumping_log')]
#[ORM\UniqueConstraint(name: 'uniq_pumping_log_user_seq', columns: ['user_id', 'server_seq'])]
class PumpingLog implements Syncable
{
    use SyncableTrait;

    #[ORM\Column]
    private int $amountMl;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $side = null; // left|right|both

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $storageLocation = null; // fridge|freezer

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $note = null;

    public static function type(): string { return 'pumping'; }

    public function applyData(array $data): void
    {
        $this->amountMl = $data['amountMl'];
        $this->side = $data['side'] ?? null;
        $this->storageLocation = $data['storageLocation'] ?? null;
        $this->note = $data['note'] ?? null;
    }

    public function toArray(): array
    {
        return $this->baseArray() + [
            'type' => self::type(),
            'amountMl' => $this->amountMl,
            'side' => $this->side,
            'storageLocation' => $this->storageLocation,
            'note' => $this->note,
        ];
    }
}
