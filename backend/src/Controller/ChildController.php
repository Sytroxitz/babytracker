<?php
declare(strict_types=1);
namespace App\Controller;

use App\Entity\Child;
use App\Entity\ChildMembership;
use App\Entity\Invitation;
use App\Entity\User;
use App\Repository\ChildMembershipRepository;
use App\Repository\ChildRepository;
use App\Repository\InvitationRepository;
use App\Service\InvitationCodeGenerator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class ChildController
{
    private const VALID_GENDERS = ['male', 'female', 'diverse'];
    private const VALID_ROLES   = ['mama', 'papa'];

    public function __construct(
        private EntityManagerInterface $em,
        private ChildMembershipRepository $memberships,
        private ChildRepository $children,
        private InvitationRepository $invitations,
        private Security $security,
    ) {}

    private function user(): User { /** @var User $u */ $u = $this->security->getUser(); return $u; }

    /** @return array<array<string,mixed>> */
    private function memberList(Child $child): array
    {
        $out = [];
        foreach ($this->memberships->findByChild($child) as $m) {
            $out[] = ['userId' => (string) $m->getUser()->getId(), 'role' => $m->getRole(), 'email' => $m->getUser()->getEmail()];
        }
        return $out;
    }

    private function requireMember(Child $child): ?ChildMembership
    {
        return $this->memberships->findOneByChildAndUser($child, $this->user());
    }

    #[Route('/api/children', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $d = json_decode($request->getContent(), true) ?? [];
        if (empty($d['name']) || empty($d['gender']) || empty($d['birthDate']) || empty($d['role'])) {
            return new JsonResponse(['error' => 'name, gender, birthDate, role required'], 400);
        }
        if (!in_array($d['gender'], self::VALID_GENDERS, true)) {
            return new JsonResponse(['error' => 'gender must be one of: ' . implode(', ', self::VALID_GENDERS)], 400);
        }
        if (!in_array($d['role'], self::VALID_ROLES, true)) {
            return new JsonResponse(['error' => 'role must be one of: ' . implode(', ', self::VALID_ROLES)], 400);
        }
        $child = new Child($d['name'], $d['gender'], new \DateTimeImmutable($d['birthDate']), $d['birthWeightGrams'] ?? null);
        $this->em->persist($child);
        $this->em->persist(new ChildMembership($child, $this->user(), $d['role']));
        $this->em->flush();
        return new JsonResponse(['child' => $child->toArray($this->memberList($child))], 201);
    }

    #[Route('/api/children/{id}', methods: ['PATCH'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $child->getDeletedAt() !== null || $this->requireMember($child) === null) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        $d = json_decode($request->getContent(), true) ?? [];
        if (isset($d['gender']) && !in_array($d['gender'], self::VALID_GENDERS, true)) {
            return new JsonResponse(['error' => 'gender must be one of: ' . implode(', ', self::VALID_GENDERS)], 400);
        }
        if (isset($d['name'])) { $child->setName($d['name']); }
        if (isset($d['gender'])) { $child->setGender($d['gender']); }
        if (isset($d['birthDate'])) { $child->setBirthDate(new \DateTimeImmutable($d['birthDate'])); }
        if (array_key_exists('birthWeightGrams', $d)) { $child->setBirthWeightGrams($d['birthWeightGrams']); }
        $this->em->flush();
        return new JsonResponse(['child' => $child->toArray($this->memberList($child))]);
    }

    #[Route('/api/children/{id}', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $child->getDeletedAt() !== null || $this->requireMember($child) === null) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        $child->setDeletedAt(new \DateTimeImmutable());
        $this->em->flush();
        return new JsonResponse(null, 204);
    }

    #[Route('/api/children/{id}/invitations', methods: ['POST'])]
    public function invite(string $id, InvitationCodeGenerator $gen): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $child->getDeletedAt() !== null || $this->requireMember($child) === null) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        do { $code = $gen->generate(); } while ($this->invitations->findOneByCode($code) !== null);
        $inv = new Invitation($child, $this->user(), $code);
        $this->em->persist($inv);
        $this->em->flush();
        return new JsonResponse(['code' => $inv->getCode(), 'expiresAt' => $inv->getExpiresAt()->format(DATE_ATOM)], 201);
    }

    #[Route('/api/invitations/{code}/accept', methods: ['POST'])]
    public function accept(string $code, Request $request): JsonResponse
    {
        $inv = $this->invitations->findOneByCode($code);
        if ($inv === null || !$inv->isUsable(new \DateTimeImmutable())) {
            return new JsonResponse(['error' => 'invalid or expired code'], 404);
        }
        $child = $inv->getChild();
        if ($child->getDeletedAt() !== null) {
            return new JsonResponse(['error' => 'invalid or expired code'], 404);
        }
        $d = json_decode($request->getContent(), true) ?? [];
        if (empty($d['role']) || !in_array($d['role'], self::VALID_ROLES, true)) {
            return new JsonResponse(['error' => 'role must be one of: ' . implode(', ', self::VALID_ROLES)], 400);
        }
        $role = $d['role'];
        $existing = $this->memberships->findOneByChildAndUser($child, $this->user());
        if ($existing === null) {
            $this->em->persist(new ChildMembership($child, $this->user(), $role));
            $inv->markUsed($this->user());
            $this->em->flush();
        }
        return new JsonResponse(['child' => $child->toArray($this->memberList($child))]);
    }

    #[Route('/api/children/{id}/members/me', methods: ['DELETE'])]
    public function leave(string $id): JsonResponse
    {
        $child = $this->children->find($id);
        if ($child === null || $child->getDeletedAt() !== null) { return new JsonResponse(['error' => 'not found'], 404); }
        $m = $this->requireMember($child);
        if ($m === null) { return new JsonResponse(['error' => 'not found'], 404); }
        $this->em->remove($m);
        $this->em->flush();
        return new JsonResponse(null, 204);
    }
}
