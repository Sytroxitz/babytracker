<?php
declare(strict_types=1);
namespace App\Entity;

use App\Entity\Concerns\SyncableTrait;
use App\Entity\Contract\Syncable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'nursing_log')]
class NursingLog implements Syncable
{
    use SyncableTrait;

    #[ORM\Column(length: 10)]
    private string $side; // left|right|both

    #[ORM\Column(nullable: true)]
    private ?int $durationMinutes = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $note = null;

    public static function type(): string { return 'nursing'; }

    public function applyData(array $data): void
    {
        $this->side = $data['side'];
        $this->durationMinutes = $data['durationMinutes'] ?? null;
        $this->note = $data['note'] ?? null;
    }

    public function toArray(): array
    {
        return $this->baseArray() + [
            'type' => self::type(),
            'side' => $this->side,
            'durationMinutes' => $this->durationMinutes,
            'note' => $this->note,
        ];
    }
}
