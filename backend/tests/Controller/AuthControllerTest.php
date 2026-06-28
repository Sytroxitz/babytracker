<?php
namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AuthControllerTest extends WebTestCase
{
    public function testRegisterThenLoginReturnsToken(): void
    {
        $client = static::createClient();
        $email = 'u'.uniqid().'@test.de';

        $client->request('POST', '/api/register', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'secret123']));
        $this->assertResponseStatusCodeSame(201);

        $client->request('POST', '/api/login', server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['email' => $email, 'password' => 'secret123']));
        $this->assertResponseIsSuccessful();
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
    }
}
