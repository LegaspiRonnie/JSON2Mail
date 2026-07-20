<?php

namespace Tests\Feature;

use Tests\TestCase;

class MailSettingsTest extends TestCase
{
    public function test_it_returns_the_configured_sender_without_a_password(): void
    {
        config([
            'mail.from.address' => 'sender@example.com',
            'mail.mailers.smtp.password' => 'secret-that-must-not-leak',
        ]);

        $this->getJson('/api/mail-settings')
            ->assertOk()
            ->assertExactJson(['sender' => 'sender@example.com']);
    }

    public function test_it_validates_a_supplied_gmail_app_password(): void
    {
        $this->post('/api/send-email', [
            'payload' => json_encode([
                'receiver' => 'recipient@example.com',
                'subject' => 'Test subject',
                'message' => 'Test message',
            ]),
            'sender' => 'sender@example.com',
            'app_password' => 'too-short',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('app_password');
    }
}
