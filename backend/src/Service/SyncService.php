<?php
declare(strict_types=1);
namespace App\Service;

use App\Entity\BottleLog;
use App\Entity\Contract\Syncable;
use App\Entity\NursingLog;
use App\Entity\PumpingLog;
use App\Entity\User;
use App\Entity\WeightLog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;

class SyncService
{
    /** @var array<string, class-string<Syncable>> */
    private const TYPES = [
        'nursing' => NursingLog::class,
        'pumping' => PumpingLog::class,
        'bottle' => BottleLog::class,
        'weight' => WeightLog::class,
    ];

    public function __construct(private EntityManagerInterface $em) {}

    /**
     * @param array<array<string,mixed>> $changes
     * @return array{cursor:int, changes:array<array<string,mixed>>}
     */
    public function sync(User $user, int $since, array $changes): array
    {
        $this->em->wrapInTransaction(function () use ($user, $changes) {
            $this->em->lock($user, \Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE);
            foreach ($changes as $change) {
                $this->applyChange($user, $change);
            }
        });

        return [
            'cursor' => $user->getSyncCounter(),
            'changes' => $this->pullSince($user, $since),
        ];
    }

    private function applyChange(User $user, array $change): void
    {
        $class = self::TYPES[$change['type']] ?? null;
        if ($class === null) {
            return;
        }
        $id = Uuid::fromString($change['id']);
        $incomingUpdatedAt = new \DateTimeImmutable($change['updatedAt']);

        /** @var Syncable|null $entity */
        $entity = $this->em->getRepository($class)->findOneBy(['id' => $id, 'user' => $user]);

        if ($entity !== null && $entity->getUpdatedAt() >= $incomingUpdatedAt) {
            return; // Last-Write-Wins: gespeicherter Stand ist gleich alt oder neuer
        }

        if ($entity === null) {
            $entity = new $class();
            $entity->setId($id);
            $entity->setUser($user);
            $this->em->persist($entity);
        }

        $entity->setOccurredAt(new \DateTimeImmutable($change['occurredAt']));
        $entity->setUpdatedAt($incomingUpdatedAt);
        $entity->setDeletedAt(
            isset($change['deletedAt']) && $change['deletedAt'] !== null
                ? new \DateTimeImmutable($change['deletedAt'])
                : null
        );
        $entity->applyData($change);
        $entity->setServerSeq($user->bumpSyncCounter());
    }

    /** @return array<array<string,mixed>> */
    private function pullSince(User $user, int $since): array
    {
        $out = [];
        foreach (self::TYPES as $class) {
            $rows = $this->em->getRepository($class)->createQueryBuilder('e')
                ->where('e.user = :user')
                ->andWhere('e.serverSeq > :since')
                ->setParameter('user', $user->getId(), 'uuid')
                ->setParameter('since', $since)
                ->orderBy('e.serverSeq', 'ASC')
                ->getQuery()->getResult();
            foreach ($rows as $row) {
                $out[] = $row->toArray();
            }
        }
        usort($out, fn ($a, $b) => $a['serverSeq'] <=> $b['serverSeq']);
        return $out;
    }
}
