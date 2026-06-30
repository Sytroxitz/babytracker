<?php
declare(strict_types=1);
namespace App\Controller;

use App\Entity\User;
use App\Service\SyncService;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class SyncController
{
    #[Route('/api/sync', methods: ['POST'])]
    public function sync(Request $request, Security $security, SyncService $syncService): JsonResponse
    {
        /** @var User $user */
        $user = $security->getUser();
        $payload = json_decode($request->getContent(), true) ?? [];
        $cursors = $payload['cursors'] ?? [];
        if (!is_array($cursors)) { $cursors = []; }
        $changes = $payload['changes'] ?? [];
        if (!is_array($changes)) { $changes = []; }

        $result = $syncService->sync($user, $cursors, $changes);
        return new JsonResponse($result);
    }
}
