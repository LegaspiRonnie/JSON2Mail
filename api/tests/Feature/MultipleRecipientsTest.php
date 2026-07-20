<?php

namespace Tests\Feature;

use App\Mail\JsonMailable;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MultipleRecipientsTest extends TestCase
{
    public function test_it_sends_an_email_to_each_comma_separated_recipient(): void
    {
        Mail::fake();

        $response = $this->post('/api/send-email', [
            'payload' => json_encode([
                'receiver' => 'test1@example.com, test2@example.com',
                'subject' => 'Test subject',
                'message' => 'Test message',
            ]),
        ]);

        $response->assertOk()->assertJsonPath('success', true);

        Mail::assertSent(JsonMailable::class, function (JsonMailable $mail): bool {
            return $mail->hasTo('test1@example.com') && $mail->hasTo('test2@example.com');
        });
    }

    public function test_it_rejects_an_invalid_address_in_a_recipient_list(): void
    {
        $response = $this->post('/api/send-email', [
            'payload' => json_encode([
                'receiver' => 'test1@example.com, not-an-email',
                'subject' => 'Test subject',
                'message' => 'Test message',
            ]),
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('receiver');
    }
}
