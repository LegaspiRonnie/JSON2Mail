<?php

namespace App\Mail;

use Illuminate\Http\UploadedFile;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class JsonMailable extends Mailable
{
    public function __construct (
        private readonly string $emailSubject,
        private readonly string $emailMessage,
        private readonly ?UploadedFile $attachmentFile = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->emailSubject);
    }

    public function content(): Content
    {
        return new Content(
            htmlString: nl2br(e($this->emailMessage)),
        );
    }

    public function attachments(): array
    {
        if ($this->attachmentFile === null) {
            return [];
        }

        return [
            Attachment::fromPath($this->attachmentFile->getRealPath())
                ->as(basename($this->attachmentFile->getClientOriginalName()))
                ->withMime($this->attachmentFile->getMimeType()),
        ];
    }
}
