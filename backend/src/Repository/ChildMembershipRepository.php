<?php
declare(strict_types=1);
namespace App\Repository;

use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ChildMembership> */
class ChildMembershipRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ChildMembership::class);
    }

    public function findOneByChildAndUser(Child $child, User $user): ?ChildMembership
    {
        return $this->findOneBy(['child' => $child, 'user' => $user]);
    }

    /** @return ChildMembership[] */
    public function findByChild(Child $child): array
    {
        return $this->findBy(['child' => $child]);
    }

    /** @return ChildMembership[] */
    public function findByUser(User $user): array
    {
        return $this->findBy(['user' => $user]);
    }
}
