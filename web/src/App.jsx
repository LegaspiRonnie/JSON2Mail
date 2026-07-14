import { useMemo, useRef, useState } from 'react';
import { validatePayload, validateAttachment } from './lib/validatePayload';

// Vite exposes env vars prefixed VITE_. The fallback targets the local
// Json2Mail API app (fixed port 8999) so zero-config dev "just works".
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8999';

const PLACEHOLDER = `{
  "receiver": "example@email.com",
  "subject": "Job Application",
  "message": "Hello..."
}`;

// The prompt for the companion custom GPT: paste a job description in ChatGPT,
// get back JSON in exactly the shape the API's strict-key validation accepts.
const GPT_PROMPT = `You are "Json2Mail Assistant", a job-application email writer for Ronnie Legaspi.

When I paste a job description (plus optional notes), reply with ONLY a raw JSON object — no markdown, no code fences, no commentary — with exactly these three keys:

{
  "receiver": "the application/contact email found in the job post ('' if none is listed)",
  "subject": "Application for <exact job title> - Ronnie Legaspi",
  "message": "a professional application email body in plain text, using \\n for line breaks"
}

Rules for "message":
- Greet the hiring manager (by name if the post names one, otherwise "Dear Hiring Manager").
- Three short paragraphs: why I'm applying, my matching skills, a courteous close.
- Mention only skills from my background that the job actually asks for: HTML, CSS, JavaScript, PHP, Laravel, React, MySQL, Git, responsive web design, UI/UX principles.
- Include my portfolio: https://ronnie-legaspi-portfolio.vercel.app/
- Say my CV is attached.
- Sign off with "Kind regards,\\nRonnie Legaspi".
- Never leave placeholders like [Company] — infer everything from the post; if something is unknown, write around it naturally.

The JSON must contain exactly the keys receiver, subject and message — the mailer rejects extra or missing keys.`;

// ChatGPT wraps JSON in \`\`\`json fences more often than not; the API's
// validator (rightly) rejects that. Strip fences on paste so the textarea
// holds clean JSON — typing is never touched.
function stripFences(text) {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

export default function App() {
  const [jsonText, setJsonText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  // result: null | { type: 'success' | 'error', messages: string[] }
  const [result, setResult] = useState(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Why useMemo instead of validating in a change handler: validation is a pure
  // function of the current text/file, so deriving it keeps a single source of
  // truth — no risk of state and error messages drifting out of sync.
  const payload = useMemo(() => validatePayload(jsonText), [jsonText]);
  const fileErrors = useMemo(() => validateAttachment(file), [file]);

  const canSend = payload.status === 'valid' && fileErrors.length === 0 && !sending;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(GPT_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      /* clipboard permission denied — user can still select the text manually */
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setJsonText(stripFences(text));
    } catch {
      /* clipboard permission denied — Ctrl+V in the textarea still works */
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text');
    if (/^\s*```/.test(text)) {
      e.preventDefault();
      setJsonText(stripFences(text));
    }
  }

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
        <p className="tagline">
          Paste a job description into the custom GPT, paste its JSON here, and send it as an email.
        </p>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="panel">
            <h2 className="panel-title">How it works</h2>
            <ol className="steps">
              <li>Copy the prompt below into a ChatGPT <strong>custom GPT</strong> (or any chat).</li>
              <li>Paste a <strong>job description</strong> into that chat.</li>
              <li>It replies with ready-to-send JSON.</li>
              <li>Paste the JSON here, attach your CV, hit <strong>Send Email</strong>.</li>
            </ol>
            <a className="link-btn" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
              Open ChatGPT ↗
            </a>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Custom GPT prompt</h2>
              <button type="button" className="mini-btn" onClick={copyPrompt}>
                {promptCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <pre className="gpt-prompt">{GPT_PROMPT}</pre>
          </section>
        </aside>

        <div className="content">
          <section className="panel">
            <div className="panel-head">
              <label htmlFor="json-input">JSON from the GPT</label>
              <button type="button" className="mini-btn" onClick={pasteFromClipboard}>
                Paste from clipboard
              </button>
            </div>
            <textarea
              id="json-input"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              onPaste={handlePaste}
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

          <button type="button" className="send-btn" onClick={handleSend} disabled={!canSend}>
            {sending ? 'Sending…' : 'Send Email'}
          </button>

          {result && (
            <div className={`result ${result.type}`} role="status">
              <ul>
                {result.messages.map((msg) => <li key={msg}>{msg}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
