<?php
declare(strict_types=1);
namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class SyncControllerTest extends WebTestCase
{
    public function testSyncRequiresAuth(): void
    {
        $client = static::createClient();
        $client->request('POST', '/api/sync', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['cursors' => [], 'changes' => []]));
        $this->assertResponseStatusCodeSame(401);
    }

    public function testSyncWithEmptyBodyReturnsNewShape(): void
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
        // New contract: {cursors:{}, changes:[], children:[]}
        $this->assertIsArray($data['cursors']);
        $this->assertEmpty($data['cursors']);
        $this->assertSame([], $data['changes']);
        $this->assertSame([], $data['children']);
    }
}
