<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * The request is multipart/form-data with two parts:
 *   - payload:    the raw JSON string the user pasted
 *   - attachment: optional file
 *
 * Why the server re-parses the JSON instead of trusting flat fields from the
 * frontend: the strict-key rule ("exactly receiver, subject, message") is a
 * contract of the JSON itself. Anyone can hit this API with curl, so the only
 * place that rule truly exists is here.
 */
class SendEmailRequest extends FormRequest
{
    /** Keys the pasted JSON must contain — no more, no fewer. */
    private const ALLOWED_KEYS = ['receiver', 'subject', 'message'];

    /** Decoded payload, or null when the JSON is unusable. */
    private ?array $decoded = null;

    public function authorize(): bool
    {
        return true; // No auth in MVP scope; throttle middleware is the gate.
    }

    /**
     * Why decode in prepareForValidation: it runs once, before rules(), letting
     * us merge the JSON's values into the request so Laravel's normal rules
     * (required, email, max) can validate them and key the errors per field.
     */
    protected function prepareForValidation(): void
    {
        $raw = $this->input('payload');

        if (!is_string($raw)) {
            return;
        }

        $decoded = json_decode($raw, true);

        // Must decode to a JSON *object* (assoc array) — "[]", "42", or
        // '"text"' are valid JSON but not a valid payload for us.
        if (is_array($decoded) && array_is_list($decoded) === false) {
            $this->decoded = $decoded;

            $this->merge([
                'receiver' => $decoded['receiver'] ?? null,
                'subject'  => $decoded['subject'] ?? null,
                'message'  => $decoded['message'] ?? null,
            ]);
        } elseif (is_array($decoded) && $decoded === []) {
            // Empty object {} decodes to [] — treat as "all keys missing".
            $this->decoded = [];
        }
    }

    public function rules(): array
    {
        // If the JSON never decoded, only report that — per-field "required"
        // errors on top of "invalid JSON" would be noise, not help.
        if ($this->decoded === null) {
            return [
                'payload' => ['required', 'string', 'json'],
            ];
        }

        return [
            'payload'  => ['required', 'string', 'json'],
            'receiver' => ['required', 'email'],
            'subject'  => ['required', 'string', 'max:255'],
            'message'  => ['required', 'string'],

            // max:10240 is KB → 10 MB. mimes: validates by sniffed file content,
            // not the extension the client claims.
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,docx,png,jpg'],
        ];
    }

    /**
     * The strict-key check: reject any key outside the allowed three.
     * Missing keys are already reported per-field by the `required` rules,
     * which gives the UI more precise messages than a single blanket error.
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->decoded === null) {
                    // Valid JSON that isn't an object ("[1,2]", "42", '"text"')
                    // passes the `json` rule but never merges fields — without
                    // this check it would reach the mailer and blow up as a 500.
                    if (!$validator->errors()->has('payload')) {
                        $validator->errors()->add(
                            'payload',
                            'The JSON must be an object with "receiver", "subject", and "message" keys.'
                        );
                    }

                    return;
                }

                $extra = array_diff(array_keys($this->decoded), self::ALLOWED_KEYS);

                if ($extra !== []) {
                    $validator->errors()->add(
                        'payload',
                        'Unexpected key(s) in JSON: "'.implode('", "', $extra)
                        .'". Only "receiver", "subject", and "message" are allowed.'
                    );
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'payload.required'  => 'Paste a JSON object with "receiver", "subject", and "message".',
            'payload.json'      => 'The pasted text is not valid JSON.',
            'receiver.required' => 'The JSON is missing the "receiver" key.',
            'receiver.email'    => 'The "receiver" value must be a valid email address.',
            'subject.required'  => 'The JSON is missing the "subject" key.',
            'message.required'  => 'The JSON is missing the "message" key.',
            'attachment.max'    => 'The attachment must not be larger than 10 MB.',
            'attachment.mimes'  => 'The attachment must be a pdf, docx, png, or jpg file.',
        ];
    }
}