<?php
declare(strict_types=1);
namespace App\Service;

use App\Entity\BottleLog;
use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\HeightLog;
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
        'height' => HeightLog::class,
    ];

    public function __construct(private EntityManagerInterface $em) {}

    /**
     * @param array<string,int> $cursors  childId => sinceSeq
     * @param array<array<string,mixed>> $changes
     * @return array{cursors:array<string,int>, changes:array<array<string,mixed>>, children:array<array<string,mixed>>}
     */
    public function sync(User $user, array $cursors, array $changes): array
    {
        // Mitgliedschaften des Users laden → erlaubte Kinder
        $memberships = $this->em->getRepository(ChildMembership::class)->findBy(['user' => $user]);
        /** @var array<string, Child> $childrenById */
        $childrenById = [];
        foreach ($memberships as $m) {
            if ($m->getChild()->getDeletedAt() === null) {
                $childrenById[(string) $m->getChild()->getId()] = $m->getChild();
            }
        }

        // Build the set of children that actually have incoming changes (membership-filtered).
        // Sort by childId string for deterministic lock order across all callers (prevents deadlocks).
        // Pure-pull syncs ($changes empty) acquire no write locks at all.
        /** @var array<string, Child> $childrenToLock */
        $childrenToLock = [];
        foreach ($changes as $change) {
            $childId = (string) ($change['childId'] ?? '');
            if (isset($childrenById[$childId]) && !isset($childrenToLock[$childId])) {
                $childrenToLock[$childId] = $childrenById[$childId];
            }
        }
        ksort($childrenToLock); // deterministic order; prevents deadlocks when two callers share 2+ children

        $this->em->wrapInTransaction(function () use ($user, $changes, $childrenById, $childrenToLock) {
            // Lock only children with incoming changes, in deterministic sorted order.
            // Refresh after locking so the syncCounter is the freshly-committed DB value;
            // without refresh, a concurrent caller that acquired the lock just before us
            // could have bumped the counter, causing a stale-counter collision on the
            // (child_id, server_seq) unique index and losing one caller's changes (HTTP 500).
            foreach ($childrenToLock as $child) {
                $this->em->lock($child, \Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE);
                $this->em->refresh($child);
            }
            foreach ($changes as $change) {
                $childId = (string) ($change['childId'] ?? '');
                $child = $childrenById[$childId] ?? null;
                if ($child === null) {
                    continue; // kein Mitglied dieses Kindes → ignorieren
                }
                $this->applyChange($child, $user, $change);
            }
        });

        $outCursors = [];
        $outChanges = [];
        foreach ($childrenById as $cid => $child) {
            $since = (int) ($cursors[$cid] ?? 0);
            foreach ($this->pullSince($child, $since) as $row) {
                $outChanges[] = $row;
            }
            $outCursors[$cid] = $child->getSyncCounter();
        }
        usort($outChanges, fn ($a, $b) => $a['serverSeq'] <=> $b['serverSeq']);

        return [
            'cursors' => $outCursors,
            'changes' => $outChanges,
            'children' => $this->serializeChildren($childrenById),
        ];
    }

    private function applyChange(Child $child, User $user, array $change): void
    {
        $class = self::TYPES[$change['type']] ?? null;
        if ($class === null) {
            return;
        }
        $id = Uuid::fromString($change['id']);
        $incomingUpdatedAt = new \DateTimeImmutable($change['updatedAt']);

        /** @var Syncable|null $entity */
        $entity = $this->em->getRepository($class)->findOneBy(['id' => $id, 'child' => $child]);

        if ($entity !== null && $entity->getUpdatedAt() >= $incomingUpdatedAt) {
            return;
        }

        if ($entity === null) {
            $entity = new $class();
            $entity->setId($id);
            $entity->setChild($child);
            $entity->setCreatedBy($user); // serverseitig, nur beim Anlegen
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
        $entity->setServerSeq($child->bumpSyncCounter());
    }

    /** @return array<array<string,mixed>> */
    private function pullSince(Child $child, int $since): array
    {
        $out = [];
        foreach (self::TYPES as $class) {
            $rows = $this->em->getRepository($class)->createQueryBuilder('e')
                ->where('e.child = :child')
                ->andWhere('e.serverSeq > :since')
                ->setParameter('child', $child->getId(), 'uuid')
                ->setParameter('since', $since)
                ->orderBy('e.serverSeq', 'ASC')
                ->getQuery()->getResult();
            foreach ($rows as $row) {
                $out[] = $row->toArray();
            }
        }
        return $out;
    }

    /**
     * @param array<string, Child> $childrenById
     * @return array<array<string,mixed>>
     */
    private function serializeChildren(array $childrenById): array
    {
        $out = [];
        $repo = $this->em->getRepository(ChildMembership::class);
        foreach ($childrenById as $child) {
            $members = [];
            foreach ($repo->findBy(['child' => $child]) as $m) {
                $members[] = [
                    'userId' => (string) $m->getUser()->getId(),
                    'role' => $m->getRole(),
                    'email' => $m->getUser()->getEmail(),
                ];
            }
            $out[] = $child->toArray($members);
        }
        return $out;
    }
}
