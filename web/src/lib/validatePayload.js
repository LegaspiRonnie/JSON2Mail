/**
 * Client-side mirror of SendEmailRequest's rules.
 * Why duplicate them here: instant feedback while typing (UX), while the
 * server stays the real gatekeeper (security). These must stay in sync with
 * api/app/Http/Requests/SendEmailRequest.php.
 */

const ALLOWED_KEYS = ['receiver', 'subject', 'message'];

// Deliberately simple email pattern: "something@something.tld".
// The server's `email` rule is the authority; this only catches obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — same as the API's max:10240 (KB)
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'png', 'jpg'];

/**
 * Validate the pasted JSON text.
 * Returns:
 *   { status: 'empty' }                      — nothing typed yet
 *   { status: 'invalid', errors: string[] }  — human-readable problems
 *   { status: 'valid', data: {receiver, subject, message} }
 */
export function validatePayload(raw) {
  if (raw.trim() === '') {
    return { status: 'empty' };
  }

  // 1. Syntax
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: 'invalid',
      errors: ['Invalid JSON syntax — check for missing quotes, commas, or braces.'],
    };
  }

  // 2. Must be a JSON *object* (not an array, string, number, or null)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      status: 'invalid',
      errors: ['The JSON must be an object like { "receiver": ..., "subject": ..., "message": ... }.'],
    };
  }

  const errors = [];
  const keys = Object.keys(parsed);

  // 3. Strict key set — no extras allowed
  const extra = keys.filter((k) => !ALLOWED_KEYS.includes(k));
  if (extra.length > 0) {
    errors.push(
      `Unexpected key(s): ${extra.map((k) => `"${k}"`).join(', ')}. ` +
      'Only "receiver", "subject", and "message" are allowed.'
    );
  }

  // 4. Missing keys — reported individually for precise feedback
  for (const key of ALLOWED_KEYS) {
    if (!(key in parsed) || String(parsed[key] ?? '').trim() === '') {
      errors.push(`Missing or empty key: "${key}".`);
    }
  }

  // 5. Value checks (only when the key exists, to avoid stacked noise)
  if (typeof parsed.receiver === 'string' && parsed.receiver.trim() !== '') {
    const recipients = parsed.receiver.split(',').map((address) => address.trim());
    if (recipients.some((address) => !EMAIL_RE.test(address))) {
      errors.push('Each comma-separated "receiver" address must be valid.');
    }
  }
  if (typeof parsed.subject === 'string' && parsed.subject.length > 255) {
    errors.push('"subject" must be 255 characters or fewer.');
  }

  if (errors.length > 0) {
    return { status: 'invalid', errors };
  }

  return {
    status: 'valid',
    data: {
      receiver: parsed.receiver,
      subject: parsed.subject,
      message: parsed.message,
    },
  };
}

/**
 * Validate the selected file (or null when none selected).
 * Returns string[] of problems — empty array means OK.
 */
export function validateAttachment(file) {
  if (!file) return [];

  const errors = [];

  if (file.size > MAX_FILE_BYTES) {
    errors.push('The attachment must not be larger than 10 MB.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push('The attachment must be a pdf, docx, png, or jpg file.');
  }

  return errors;
}
