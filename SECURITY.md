# Security Policy

The RYNA team and community take the security of our gateway, credentials, and routing infrastructure seriously.

---

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

---

## Security Architecture

### 1. Local-First Credential Isolation

- OAuth tokens, refresh keys, and provider secrets are stored exclusively in your local SQLite database (`rynarouter.db`) on your own infrastructure or device
- RYNA never phones home, collects telemetry, or sends your API keys to third-party tracking servers
- All data remains under your control at all times

### 2. Virtual Client Keys (`ryna-live-...`)

- Clients and downstream applications interact with RYNA using virtual API keys
- Your upstream master provider keys are completely isolated and never exposed to clients
- Keys can be individually scoped with rate limits, token quotas, credit limits, and model allowlists

### 3. Opt-in Enforced Authentication

- You can enforce Bearer authentication on all gateway endpoints via Settings (`Require API Key: Required`)
- When disabled, loopback (127.0.0.1) requests can bypass authentication for local development
- Admin operations always require session-based authentication

### 4. Data Protection

- All database queries are fully parameterized to prevent SQL injection
- Request bodies are validated with Zod schemas before processing
- CSRF protection is enabled for cookie-authenticated mutations
- Security headers are set on all responses (X-Content-Type-Options, X-Frame-Options, etc.)

### 5. Network Security

- The built-in Cloudflare Tunnel provides secure remote access without exposing ports
- OAuth callbacks are handled on a separate port (1455) to isolate auth flows
- CORS can be configured to restrict cross-origin requests

---

## Reporting a Vulnerability

If you discover a potential security vulnerability or sensitive information exposure in RYNA, please do **NOT** disclose it in a public GitHub issue.

Please report it privately via:

- **Email**: `security@ryna.dev` (or open a private GitHub Security Advisory)
- **GitHub**: [Security Advisories](https://github.com/ryna/RYNArouter/security/advisories/new)

### What to include in your report

- A clear description of the vulnerability
- Steps or a minimal proof-of-concept (PoC) to reproduce the issue
- Impact assessment (e.g. unauthorized token access, denial of service)
- Any suggested fixes (if applicable)

### Response Timeline

| Step | Timeline |
|------|----------|
| Acknowledgment | Within 24 hours |
| Initial assessment | Within 72 hours |
| Status updates | Weekly until resolved |
| Patch release | As soon as possible after confirmation |

### Scope

The following are in scope:

- Authentication and authorization bypasses
- Credential leakage or exposure
- SQL injection or other injection attacks
- Remote code execution
- Denial of service vulnerabilities
- Security-relevant logic errors

The following are out of scope:

- Issues requiring physical access to the server
- Issues in third-party dependencies (report these upstream)
- Social engineering attacks
- Issues already known and documented

---

## Security Best Practices

When deploying RYNA, follow these recommendations:

### Production Deployment

1. **Enable HTTPS**: Use a reverse proxy (nginx, Caddy) or Cloudflare Tunnel
2. **Set `RYNAROUTER_SECURE_COOKIES=true`**: Enables Secure flag on admin session cookies
3. **Enable API key authentication**: Set `Require API Key: Required` in Settings
4. **Restrict CORS**: Configure `RYNAROUTER_CORS_ORIGINS` to allow only trusted origins
5. **Use strong admin passwords**: Choose a unique, complex password
6. **Keep updated**: Apply updates promptly

### Network Configuration

1. **Firewall**: Only expose ports 3000 and 1455 if needed externally
2. **VPN/SSH**: For remote access, prefer VPN or SSH tunneling over public exposure
3. **Cloudflare Tunnel**: Use the built-in tunnel for secure remote access without opening ports

### Credential Management

1. **Rotate keys regularly**: Periodically regenerate virtual API keys
2. **Use scoped keys**: Create separate keys with minimal required permissions
3. **Monitor usage**: Check the logs dashboard for unusual activity
4. **Review providers**: Regularly audit connected provider accounts

---

## Updates and Patches

Security updates will be released as patch versions and announced via:

- GitHub Releases
- Repository README updates
- Email notifications (if subscribed)

To check for updates:

```bash
# Via CLI
npx @rynarouter/cli doctor

# Via API
curl http://localhost:3000/v1/settings | jq .version
```

---

## Contact

For security-related questions or concerns:

- **Security issues**: `security@ryna.dev`
- **General questions**: [GitHub Discussions](https://github.com/ryna/RYNArouter/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/ryna/RYNArouter/issues)
