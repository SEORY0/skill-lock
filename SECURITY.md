# Security Policy

skill-lock is a security tool; we treat vulnerabilities in it accordingly.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately via
[GitHub Security Advisories](https://github.com/SEORY0/skill-lock/security/advisories/new).

You can expect:

- Acknowledgement within 72 hours.
- A fix or mitigation plan within 30 days for confirmed issues.
- Coordinated disclosure: we ask for up to 90 days before public details, and we will
  credit you in the advisory unless you prefer otherwise.

## Scope notes

Especially interesting reports:

- Ways a malicious artifact could **evade collection or hashing** (path tricks,
  symlinks, encoding, projection bypasses).
- Ways drift could be hidden from `verify` or misrepresented by `diff`.
- Tampering with skill-lock's own state (`~/.skill-lock/`) that survives `verify`.

Out of scope: attacks requiring an already-compromised account with write access to
the state directory *and* the lockfile *and* every snapshot (that is the trust anchor,
like `.git` in a git repo).
