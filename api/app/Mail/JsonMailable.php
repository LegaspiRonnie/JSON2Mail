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
        // Why a Blade view now (vs the earlier htmlString): the email is the
        // product's visible output, so it gets a real branded template. The
        // "no Blade views" rule targets web pages — the SPA owns those; email
        // bodies are rendered documents, which is exactly what Blade is for.
        return new Content(
            view: 'emails.json-mail',
            with: [
                'emailSubject'   => $this->emailSubject,
                'emailMessage'   => $this->emailMessage,
                'attachmentName' => $this->attachmentFile
                    ? basename($this->attachmentFile->getClientOriginalName())
                    : null,
            ],
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
