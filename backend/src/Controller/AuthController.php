<?php
declare(strict_types=1);
namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

class AuthController
{
    #[Route('/api/register', methods: ['POST'])]
    public function register(
        Request $request,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];
        if (empty($data['email']) || empty($data['password'])) {
            return new JsonResponse(['error' => 'email and password required'], 400);
        }
        $user = new User($data['email']);
        $user->setPassword($hasher->hashPassword($user, $data['password']));
        $em->persist($user);
        $em->flush();

        return new JsonResponse(['id' => (string) $user->getId(), 'email' => $user->getEmail()], 201);
    }
}
