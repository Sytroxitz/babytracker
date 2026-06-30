<?php
declare(strict_types=1);
namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ChildControllerTest extends WebTestCase
{
    private function register(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $email): string
    {
        $client->request('POST', '/api/register', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'pw123456']));
        $client->request('POST', '/api/login', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'pw123456']));
        $data = json_decode($client->getResponse()->getContent(), true);
        self::assertArrayHasKey('userId', $data); // Auth-Response trägt userId
        return $data['token'];
    }

    private function auth(string $token): array
    {
        return ['HTTP_AUTHORIZATION' => 'Bearer ' . $token, 'CONTENT_TYPE' => 'application/json'];
    }

    public function test_create_child_returns_child_with_creator_membership(): void
    {
        $client = static::createClient();
        $token = $this->register($client, 'mama' . uniqid() . '@b.c');

        $client->request('POST', '/api/children', server: $this->auth($token),
            content: json_encode([
                'name' => 'Mia', 'gender' => 'female',
                'birthDate' => '2026-01-01', 'birthWeightGrams' => 3200, 'role' => 'mama',
            ]));
        self::assertResponseStatusCodeSame(201);
        $body = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('Mia', $body['child']['name']);
        self::assertCount(1, $body['child']['members']);
        self::assertSame('mama', $body['child']['members'][0]['role']);
    }

    public function test_partner_joins_via_invitation_code(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'mamaX' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Mia', 'gender' => 'female', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'mama']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $client->request('POST', "/api/children/$childId/invitations", server: $this->auth($tokenA));
        self::assertResponseStatusCodeSame(201);
        $code = json_decode($client->getResponse()->getContent(), true)['code'];

        $tokenB = $this->register($client, 'papaX' . uniqid() . '@b.c');
        $client->request('POST', "/api/invitations/$code/accept", server: $this->auth($tokenB),
            content: json_encode(['role' => 'papa']));
        self::assertResponseStatusCodeSame(200);
        $body = json_decode($client->getResponse()->getContent(), true);
        self::assertCount(2, $body['child']['members']);
    }

    public function test_invalid_code_is_rejected(): void
    {
        $client = static::createClient();
        $token = $this->register($client, 'solo' . uniqid() . '@b.c');
        $client->request('POST', '/api/invitations/NOPECODE/accept', server: $this->auth($token),
            content: json_encode(['role' => 'papa']));
        self::assertResponseStatusCodeSame(404);
    }

    public function test_invalid_gender_on_create_returns_400(): void
    {
        $client = static::createClient();
        $token = $this->register($client, 'gender' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($token),
            content: json_encode([
                'name' => 'Baby', 'gender' => 'alien',
                'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'mama',
            ]));
        self::assertResponseStatusCodeSame(400);
    }

    // --- Fix #2: non-member gets 404 (not 200/403) ---

    public function test_non_member_patch_returns_404(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'ownerPatch' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Kid', 'gender' => 'male', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'papa']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $tokenB = $this->register($client, 'strangerPatch' . uniqid() . '@b.c');
        $client->request('PATCH', "/api/children/$childId", server: $this->auth($tokenB),
            content: json_encode(['name' => 'Hacked']));
        self::assertResponseStatusCodeSame(404);
    }

    public function test_non_member_delete_returns_404(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'ownerDel' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Kid', 'gender' => 'male', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'papa']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $tokenB = $this->register($client, 'strangerDel' . uniqid() . '@b.c');
        $client->request('DELETE', "/api/children/$childId", server: $this->auth($tokenB));
        self::assertResponseStatusCodeSame(404);
    }

    public function test_non_member_invite_returns_404(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'ownerInv' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Kid', 'gender' => 'male', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'papa']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $tokenB = $this->register($client, 'strangerInv' . uniqid() . '@b.c');
        $client->request('POST', "/api/children/$childId/invitations", server: $this->auth($tokenB));
        self::assertResponseStatusCodeSame(404);
    }

    // --- Fix #4: validation tests ---

    public function test_invalid_role_on_create_returns_400(): void
    {
        $client = static::createClient();
        $token = $this->register($client, 'roleCreate' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($token),
            content: json_encode(['name' => 'Baby', 'gender' => 'male', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'uncle']));
        self::assertResponseStatusCodeSame(400);
    }

    public function test_invalid_role_on_accept_returns_400(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'ownerRole' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Kid', 'gender' => 'female', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'mama']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $client->request('POST', "/api/children/$childId/invitations", server: $this->auth($tokenA));
        $code = json_decode($client->getResponse()->getContent(), true)['code'];

        $tokenB = $this->register($client, 'joinerRole' . uniqid() . '@b.c');
        $client->request('POST', "/api/invitations/$code/accept", server: $this->auth($tokenB),
            content: json_encode(['role' => 'uncle']));
        self::assertResponseStatusCodeSame(400);
    }

    public function test_code_is_single_use(): void
    {
        $client = static::createClient();
        $tokenA = $this->register($client, 'ownerSingle' . uniqid() . '@b.c');
        $client->request('POST', '/api/children', server: $this->auth($tokenA),
            content: json_encode(['name' => 'Kid', 'gender' => 'male', 'birthDate' => '2026-01-01', 'birthWeightGrams' => null, 'role' => 'papa']));
        $childId = json_decode($client->getResponse()->getContent(), true)['child']['id'];

        $client->request('POST', "/api/children/$childId/invitations", server: $this->auth($tokenA));
        $code = json_decode($client->getResponse()->getContent(), true)['code'];

        // First joiner — should succeed
        $tokenB = $this->register($client, 'joinerB' . uniqid() . '@b.c');
        $client->request('POST', "/api/invitations/$code/accept", server: $this->auth($tokenB),
            content: json_encode(['role' => 'mama']));
        self::assertResponseStatusCodeSame(200);

        // Third user tries same code — must be 404 (code consumed)
        $tokenC = $this->register($client, 'joinerC' . uniqid() . '@b.c');
        $client->request('POST', "/api/invitations/$code/accept", server: $this->auth($tokenC),
            content: json_encode(['role' => 'mama']));
        self::assertResponseStatusCodeSame(404);
    }
}
