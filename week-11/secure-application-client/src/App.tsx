/**
 * The security demo console.
 *
 * The page looks like a harmless front-end, but every button simply sends a
 * request; the interesting part is what the API *accepts*. Anything this page
 * does can be done with curl, which is the lesson: the client is not a
 * security boundary.
 *
 * Switch the target between the vulnerable API (port 8000) and the secure API
 * (port 8001) and repeat the same attack.
 */
import { useState, type ReactNode } from "react";
import { callApi, TARGETS, type ApiCall, type Target } from "./api";

// The seeded ids (see secure-application-api/src/seed.ts).
const BOB_ID = "33333333-3333-3333-3333-333333333333";
const BOB_NOTE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function Section({ title, owasp, children }: Readonly<{ title: string; owasp: string; children: ReactNode }>) {
  return (
    <section className="section">
      <h2>
        <span className="owasp">{owasp}</span> {title}
      </h2>
      {children}
    </section>
  );
}

export default function App() {
  const [target, setTarget] = useState<Target>("vulnerable");
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("alice123");
  const [token, setToken] = useState("");

  const [searchEmail, setSearchEmail] = useState("' OR '1'='1");
  const [role, setRole] = useState("user");
  const [noteId, setNoteId] = useState(BOB_NOTE_ID);
  const [deleteId, setDeleteId] = useState(BOB_ID);

  const [results, setResults] = useState<ApiCall[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(...calls: (() => Promise<ApiCall>)[]) {
    setBusy(true);
    const replies: ApiCall[] = [];
    for (const call of calls) replies.push(await call()); // one after another, in order
    setResults(replies);
    setBusy(false);
    return replies;
  }

  async function handleLogin() {
    const [reply] = await run(() => callApi(target, "POST", "/api/login", { body: { email, password } }));
    const data = (reply?.body as { data?: { token?: string } } | null)?.data;
    setToken(data?.token ?? "");
  }

  // A07: ten wrong guesses in a row. The vulnerable API answers every one;
  // the secure one starts answering 429 after five.
  function bruteForce() {
    const guesses = Array.from({ length: 10 }, (_, i) => `guess-${i + 1}`);
    return run(...guesses.map((guess) => () => callApi(target, "POST", "/api/login", { body: { email, password: guess } })));
  }

  // Decoding the token shows what it contains: the vulnerable "token" is just
  // Base64-encoded JSON, a real JWT has three dot-separated parts.
  function decodeToken(): string {
    try {
      const part = token.includes(".") ? token.split(".")[1]! : token;
      return JSON.stringify(JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))), null, 2);
    } catch {
      return "(cannot decode)";
    }
  }

  return (
    <main className={`page ${target}`}>
      <header className="header">
        <h1>Week 11 Security Demo</h1>
        <div className="targets" role="radiogroup" aria-label="Target API">
          {(Object.keys(TARGETS) as Target[]).map((key) => (
            <label key={key} className={`target ${key === target ? "active" : ""}`}>
              <input
                type="radio"
                name="target"
                checked={key === target}
                onChange={() => {
                  setTarget(key);
                  setToken("");
                  setResults([]);
                }}
              />
              {TARGETS[key].label} <code>{TARGETS[key].url}</code>
            </label>
          ))}
        </div>
      </header>

      <div className="columns">
        <div>
          <Section owasp="A04 · A07" title="Register / Login">
            <div className="row">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" aria-label="Email" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                aria-label="Password"
              />
            </div>
            <div className="row">
              <button
                disabled={busy}
                onClick={() => run(() => callApi(target, "POST", "/api/register", { body: { email, password } }))}
              >
                Register
              </button>
              <button disabled={busy} onClick={handleLogin}>
                Login
              </button>
              <button disabled={busy} onClick={bruteForce}>
                Brute force: 10 wrong passwords
              </button>
            </div>
            <p className="hint">
              Try an email that does not exist, a wrong password, and a 4-character password. Compare the answers.
            </p>
            <div className="token">
              <strong>Token:</strong> <code>{token || "(none)"}</code>
              {token && <pre>{decodeToken()}</pre>}
            </div>
          </Section>

          <Section owasp="A05" title="Injection">
            <div className="row">
              <input value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} aria-label="Search email" />
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    callApi(target, "GET", `/api/users/search?email=${encodeURIComponent(searchEmail)}`, { token }),
                  )
                }
              >
                Search users
              </button>
            </div>
          </Section>

          <Section owasp="A01" title="Broken Access Control">
            <div className="row">
              <input value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" />
              <button
                disabled={busy}
                onClick={() =>
                  run(() => callApi(target, "GET", `/api/admin/audit?role=${encodeURIComponent(role)}`, { token }))
                }
              >
                Get admin audit (?role=…)
              </button>
            </div>
            <div className="row">
              <input value={noteId} onChange={(e) => setNoteId(e.target.value)} aria-label="Note id" />
              <button disabled={busy} onClick={() => run(() => callApi(target, "GET", `/api/notes/${noteId}`, { token }))}>
                Read note
              </button>
            </div>
            <div className="row">
              <input value={deleteId} onChange={(e) => setDeleteId(e.target.value)} aria-label="User id" />
              <button
                disabled={busy}
                onClick={() => run(() => callApi(target, "DELETE", `/api/users/${deleteId}`, { token }))}
              >
                Delete user
              </button>
            </div>
            <p className="hint">The defaults are Bob's note and Bob's account. Log in as Alice first.</p>
          </Section>

          <Section owasp="A02" title="Security Misconfiguration">
            <div className="row">
              <button disabled={busy} onClick={() => run(() => callApi(target, "GET", "/api/debug/config"))}>
                Get debug config
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    callApi(target, "POST", "/api/register", { body: { email: "alice@example.com", password: "x".repeat(12) } }),
                  )
                }
              >
                Trigger a database error
              </button>
            </div>
            <p className="hint">
              For CORS, run <code>bun run cors-test</code> and open <code>http://localhost:5500</code>.
            </p>
          </Section>
        </div>

        <section className="output" aria-live="polite">
          <h2>Responses</h2>
          {results.length === 0 && <p className="hint">Responses appear here.</p>}
          {results.map((result, i) => (
            <article key={i} className="response">
              <div className="responseHead">
                <code>{result.request}</code>
                <span className={`status s${String(result.status)[0]}`}>{result.status || "–"}</span>
              </div>
              <pre>{typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}</pre>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
