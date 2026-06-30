<?php
declare(strict_types=1);
namespace App\Entity;

use App\Entity\Concerns\SyncableTrait;
use App\Entity\Contract\Syncable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'bottle_log')]
#[ORM\UniqueConstraint(name: 'uniq_bottle_log_child_seq', columns: ['child_id', 'server_seq'])]
class BottleLog implements Syncable
{
    use SyncableTrait;

    #[ORM\Column]
    private int $amountMl;

    // type ist intern fest 'breastmilk' (kein Eingabefeld, später erweiterbar)
    #[ORM\Column(length: 20, options: ['default' => 'breastmilk'])]
    private string $milkType = 'breastmilk';

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $note = null;

    public static function type(): string { return 'bottle'; }

    public function applyData(array $data): void
    {
        $this->amountMl = $data['amountMl'];
        $this->milkType = 'breastmilk';
        $this->note = $data['note'] ?? null;
    }

    public function toArray(): array
    {
        return $this->baseArray() + [
            'type' => self::type(),
            'amountMl' => $this->amountMl,
            'milkType' => $this->milkType,
            'note' => $this->note,
        ];
    }
}
