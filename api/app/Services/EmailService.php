<?php 
namespace App\Services;

use App\Mail\JsonMailable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Http\UploadedFile;


class EmailService
{
    public function send(array $data, ?UploadedFile $attachment = null): void
    {
        $subject = strip_tags($data['subject']);
        $message = strip_tags($data['message']);

        $recipients = array_map('trim', explode(',', $data['receiver']));

        Mail::to($recipients)
            ->send(new JsonMailable($subject, $message, $attachment));
    }
}
