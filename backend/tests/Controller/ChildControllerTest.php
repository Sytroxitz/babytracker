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
}
