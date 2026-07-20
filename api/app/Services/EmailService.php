<?php

namespace App\Services;

use App\Mail\JsonMailable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;

class EmailService
{
    public function send(array $data, ?UploadedFile $attachment = null): void
    {
        $subject = strip_tags($data['subject']);
        $message = strip_tags($data['message']);
        $recipients = array_map('trim', explode(',', $data['receiver']));

        $mailer = Mail::mailer();

        // Supplying either field opts into Gmail SMTP for this one send. When
        // both are blank, the existing .env mailer and credentials stay in use.
        if (! empty($data['sender']) || ! empty($data['app_password'])) {
            $sender = $data['sender'] ?: config('mail.mailers.smtp.username');

            config([
                'mail.default' => 'smtp',
                'mail.mailers.smtp.username' => $sender,
                'mail.mailers.smtp.password' => $data['app_password'] ?: config('mail.mailers.smtp.password'),
                'mail.from.address' => $sender,
            ]);

            Mail::purge('smtp');
            $mailer = Mail::mailer('smtp');
        }

        $mailer->to($recipients)
            ->send(new JsonMailable($subject, $message, $attachment));
    }
}
