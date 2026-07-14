import { useMemo, useRef, useState } from 'react';
import { validatePayload, validateAttachment } from './lib/validatePayload';

// Vite exposes env vars prefixed VITE_. Fallback keeps zero-config dev working.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

const PLACEHOLDER = `{
  "receiver": "example@email.com",
  "subject": "Job Application",
  "message": "Hello..."
}`;

export default function App() {
  const [jsonText, setJsonText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  // result: null | { type: 'success' | 'error', messages: string[] }
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  // Why useMemo instead of validating in a change handler: validation is a pure
  // function of the current text/file, so deriving it keeps a single source of
  // truth — no risk of state and error messages drifting out of sync.
  const payload = useMemo(() => validatePayload(jsonText), [jsonText]);
  const fileErrors = useMemo(() => validateAttachment(file), [file]);

  const canSend = payload.status === 'valid' && fileErrors.length === 0 && !sending;

  async function handleSend() {
    if (!canSend) return;

    setSending(true);
    setResult(null);

    // Why FormData with the RAW text (not re-serialized JSON): the server
    // validates the exact string the user pasted — the API contract's `payload`
    // field. Re-serializing could silently "fix" input the server should judge.
    const form = new FormData();
    form.append('payload', jsonText);
    if (file) form.append('attachment', file);

    try {
      const res = await fetch(`${API_BASE}/api/send-email`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form, // never set Content-Type manually — the browser adds the multipart boundary
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setResult({ type: 'success', messages: [data?.message ?? 'Email sent successfully.'] });
        // Reset the form after success so the next send starts clean.
        setJsonText('');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else if (res.status === 422 && data?.errors) {
        // Laravel's field-keyed errors object → flat list of readable messages.
        setResult({ type: 'error', messages: Object.values(data.errors).flat() });
      } else if (res.status === 429) {
        setResult({
          type: 'error',
          messages: ['Too many requests — the limit is 5 per minute. Wait a moment and try again.'],
        });
      } else {
        setResult({
          type: 'error',
          messages: [data?.message ?? 'Something went wrong while sending the email.'],
        });
      }
    } catch {
      // fetch itself failed → API not reachable (server down, wrong URL, CORS).
      setResult({
        type: 'error',
        messages: ['Could not reach the API. Is the Laravel server running on ' + API_BASE + '?'],
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="container">
      <header>
        <h1>json2mail</h1>
        <p className="tagline">Paste a JSON object, attach a file if you like, and send it as an email.</p>
      </header>

      <section className="panel">
        <label htmlFor="json-input">JSON</label>
        <textarea
          id="json-input"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          spellCheck={false}
        />

        {payload.status === 'invalid' && (
          <ul className="errors" role="alert">
            {payload.errors.map((err) => <li key={err}>{err}</li>)}
          </ul>
        )}
        {payload.status === 'valid' && <p className="ok">✓ Valid JSON</p>}
      </section>

      <section className="panel">
        <label htmlFor="file-input">Attachment (optional — pdf, docx, png, jpg · max 10 MB)</label>
        <input
          id="file-input"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.png,.jpg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {fileErrors.length > 0 && (
          <ul className="errors" role="alert">
            {fileErrors.map((err) => <li key={err}>{err}</li>)}
          </ul>
        )}
      </section>

      {payload.status === 'valid' && (
        <section className="panel preview">
          <h2>Preview</h2>
          <dl>
            <dt>To</dt>
            <dd>{payload.data.receiver}</dd>
            <dt>Subject</dt>
            <dd>{payload.data.subject}</dd>
            <dt>Message</dt>
            {/* white-space: pre-wrap in CSS preserves the user's line breaks,
                matching how the API renders them (nl2br). */}
            <dd className="message-body">{payload.data.message}</dd>
            {file && (
              <>
                <dt>Attachment</dt>
                <dd>{file.name}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <button type="button" onClick={handleSend} disabled={!canSend}>
        {sending ? 'Sending…' : 'Send Email'}
      </button>

      {result && (
        <div className={`result ${result.type}`} role="status">
          <ul>
            {result.messages.map((msg) => <li key={msg}>{msg}</li>)}
          </ul>
        </div>
      )}
    </main>
  );
}