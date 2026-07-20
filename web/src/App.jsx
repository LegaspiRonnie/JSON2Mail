import { useEffect, useMemo, useRef, useState } from 'react';
import { validatePayload, validateAttachment } from './lib/validatePayload';

// Vite exposes env vars prefixed VITE_. The fallback targets the local
// Json2Mail API app (fixed port 8999) so zero-config dev "just works".
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8999';

const PLACEHOLDER = `{
  "receiver": "example@email.com, second@example.com",
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

/* --- Inline icon set (stroke style, inherits currentColor) — keeps the
       "no extra packages" rule while giving the UI a proper icon language. */
function Icon({ d, children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

const icons = {
  mail: (size) => (
    <Icon size={size}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Icon>
  ),
  sparkles: (size) => (
    <Icon size={size} d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
  ),
  copy: (size) => (
    <Icon size={size}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  ),
  check: (size) => <Icon size={size} d="M20 6 9 17l-5-5" />,
  clipboard: (size) => (
    <Icon size={size}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </Icon>
  ),
  paperclip: (size) => (
    <Icon size={size} d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ),
  send: (size) => (
    <Icon size={size}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </Icon>
  ),
  code: (size) => (
    <Icon size={size}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </Icon>
  ),
  external: (size) => (
    <Icon size={size}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Icon>
  ),
  alert: (size) => (
    <Icon size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icon>
  ),
  eye: (size) => (
    <Icon size={size}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
};

export default function App() {
  const [jsonText, setJsonText] = useState('');
  const [file, setFile] = useState(null);
  const [sender, setSender] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [useCustomSmtp, setUseCustomSmtp] = useState(false);
  const [sending, setSending] = useState(false);
  // result: null | { type: 'success' | 'error', messages: string[] }
  const [result, setResult] = useState(null);
  const [promptCopied, setPromptCopied] = useState(false);
  // null = checking, true/false once known
  const [apiOnline, setApiOnline] = useState(null);
  const fileInputRef = useRef(null);

  // Live API status in the header: /api/test is inside the CORS'd api/* paths,
  // so the browser can read it from any allowed origin.
  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch(`${API_BASE}/api/test`, { headers: { Accept: 'text/plain' } });
        if (!cancelled) setApiOnline(res.ok);
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    }
    ping();
    const id = setInterval(ping, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // The API provides only the non-sensitive configured sender. The existing
  // .env app password is deliberately never exposed to the browser.
  useEffect(() => {
    let cancelled = false;
    async function loadMailSettings() {
      try {
        const res = await fetch(`${API_BASE}/api/mail-settings`);
        const data = await res.json();
        if (!cancelled && typeof data.sender === 'string') setSender(data.sender);
      } catch {
        // Sending without overrides still uses the API's .env mail settings.
      }
    }
    loadMailSettings();
    return () => { cancelled = true; };
  }, []);

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
    // The default path deliberately sends neither field: the API retains its
    // configured mailer and .env credentials. Only opt into SMTP overrides
    // after the user explicitly enables them.
    if (useCustomSmtp) {
      if (sender.trim()) form.append('sender', sender.trim());
      if (appPassword) form.append('app_password', appPassword);
    }

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
        setAppPassword('');
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
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">{icons.mail(24)}</span>
          <div>
            <h1>
              Json2Mail
              <span className="brand-pill">{icons.sparkles(12)} GPT-powered</span>
            </h1>
            <p className="tagline">
              Paste a job description into the custom GPT, paste its JSON here, and send it as an email.
            </p>
          </div>
        </div>
        <div className={`api-status ${apiOnline === null ? 'checking' : apiOnline ? 'online' : 'offline'}`}>
          <span className="dot" />
          {apiOnline === null ? 'Checking API…' : apiOnline ? 'API online' : 'API offline'}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="panel">
            <h2 className="panel-title">{icons.sparkles(16)} How it works</h2>
            <ol className="steps">
              <li>Copy the prompt below into a ChatGPT <strong>custom GPT</strong> (or any chat).</li>
              <li>Paste a <strong>job description</strong> into that chat.</li>
              <li>It replies with ready-to-send JSON.</li>
              <li>Paste the JSON here, attach your CV, hit <strong>Send Email</strong>.</li>
            </ol>
            <a className="link-btn" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
              Open ChatGPT {icons.external(14)}
            </a>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">{icons.code(16)} Custom GPT prompt</h2>
              <button type="button" className={`mini-btn ${promptCopied ? 'copied' : ''}`} onClick={copyPrompt}>
                {promptCopied ? icons.check(14) : icons.copy(14)}
                {promptCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="gpt-prompt">{GPT_PROMPT}</pre>
          </section>
        </aside>

        <div className="content">
          <section className="panel mail-settings">
            <h2 className="panel-title">{icons.mail(16)} Sender settings</h2>
            <p className="settings-help">By default, messages use the existing mailer and credentials configured on this server.</p>
            <label className="smtp-toggle">
              <input
                type="checkbox"
                checked={useCustomSmtp}
                onChange={(e) => setUseCustomSmtp(e.target.checked)}
              />
              Use a different Gmail sender for this email
            </label>
            <label htmlFor="sender-input" className="field-label">Gmail address</label>
            <input
              id="sender-input"
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="you@gmail.com"
              autoComplete="email"
              disabled={!useCustomSmtp}
            />
            <label htmlFor="app-password-input" className="field-label">Gmail app password <span>optional</span></label>
            <input
              id="app-password-input"
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-character app password"
              autoComplete="off"
              disabled={!useCustomSmtp}
            />
            <p className="settings-help">When using a different sender, leave the password blank to use the server's existing app password, or enter that sender's password. Create one in your Google Account: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Security → 2-Step Verification → App passwords</a>.</p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <label htmlFor="json-input" className="label-icon">{icons.code(16)} JSON from the GPT</label>
              <button type="button" className="mini-btn" onClick={pasteFromClipboard}>
                {icons.clipboard(14)} Paste from clipboard
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
            {payload.status === 'valid' && (
              <p className="ok">{icons.check(15)} Valid JSON — ready to send</p>
            )}
          </section>

          <section className="panel">
            <label htmlFor="file-input" className="label-icon">
              {icons.paperclip(16)} Attachment
              <span className="label-hint">optional — pdf, docx, png, jpg · max 10 MB</span>
            </label>
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
              <h2 className="panel-title">{icons.eye(16)} Email preview</h2>
              <div className="email-card">
                <div className="email-row">
                  <span className="email-key">To</span>
                  <span className="email-val">{payload.data.receiver}</span>
                </div>
                <div className="email-row">
                  <span className="email-key">Subject</span>
                  <span className="email-val email-subject">{payload.data.subject}</span>
                </div>
                {file && (
                  <div className="email-row">
                    <span className="email-key">Attach</span>
                    <span className="email-val attachment-chip">{icons.paperclip(13)} {file.name}</span>
                  </div>
                )}
                {/* white-space: pre-wrap preserves the user's line breaks,
                    matching how the API renders them (nl2br). */}
                <div className="email-body">{payload.data.message}</div>
              </div>
            </section>
          )}

          <button type="button" className="send-btn" onClick={handleSend} disabled={!canSend}>
            {icons.send(18)} {sending ? 'Sending…' : 'Send Email'}
          </button>

          {result && (
            <div className={`result ${result.type}`} role="status">
              <span className="result-icon">
                {result.type === 'success' ? icons.check(18) : icons.alert(18)}
              </span>
              <ul>
                {result.messages.map((msg) => <li key={msg}>{msg}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      <footer className="site-footer">
        Built by <a href="https://ronnie-legaspi-portfolio.vercel.app/" target="_blank" rel="noreferrer">Ronnie Legaspi</a>
        <span className="footer-sep">·</span> Laravel + React <span className="footer-sep">·</span> {icons.mail(13)} json2mail
      </footer>
    </main>
  );
}
