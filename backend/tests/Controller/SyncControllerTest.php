<?php
declare(strict_types=1);
namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Uid\Uuid;

class SyncControllerTest extends WebTestCase
{
    public function testAuthenticatedSyncRoundTrip(): void
    {
        $client = static::createClient();
        $email = 'sc'.uniqid().'@test.de';

        $client->request('POST', '/api/register', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'secret123']));
        $client->request('POST', '/api/login', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'secret123']));
        $token = json_decode($client->getResponse()->getContent(), true)['token'];

        $id = (string) Uuid::v4();
        $client->request('POST', '/api/sync',
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$token],
            content: json_encode([
                'since' => 0,
                'changes' => [[
                    'type' => 'pumping', 'id' => $id,
                    'occurredAt' => '2026-06-01T09:00:00+00:00',
                    'updatedAt' => '2026-06-01T09:00:00+00:00',
                    'deletedAt' => null, 'amountMl' => 120, 'storageLocation' => 'fridge',
                ]],
            ]));

        $this->assertResponseStatusCodeSame(200);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(1, $data['cursor']);
        $this->assertSame(120, $data['changes'][0]['amountMl']);
        $this->assertSame('fridge', $data['changes'][0]['storageLocation']);
    }

    public function testSyncWithEmptyBodyUsesDefaults(): void
    {
        $client = static::createClient();
        $email = 'sc'.uniqid().'@test.de';

        $client->request('POST', '/api/register', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'secret123']));
        $client->request('POST', '/api/login', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'secret123']));
        $token = json_decode($client->getResponse()->getContent(), true)['token'];

        $client->request('POST', '/api/sync',
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$token],
            content: '{}');

        $this->assertResponseStatusCodeSame(200);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(0, $data['cursor']);
        $this->assertSame([], $data['changes']);
    }

    public function testSyncRequiresAuth(): void
    {
        $client = static::createClient();
        $client->request('POST', '/api/sync', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['since' => 0, 'changes' => []]));
        $this->assertResponseStatusCodeSame(401);
    }
}
