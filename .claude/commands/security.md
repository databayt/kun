# Security Audit

Run comprehensive security checks.

## Checks

### OWASP Top 10
- [ ] Injection (SQL, NoSQL, Command)
- [ ] Broken Authentication
- [ ] Sensitive Data Exposure
- [ ] XML External Entities
- [ ] Broken Access Control
- [ ] Security Misconfiguration
- [ ] XSS (Cross-Site Scripting)
- [ ] Insecure Deserialization
- [ ] Vulnerable Dependencies
- [ ] Insufficient Logging

### Code Analysis
- Input validation
- Output encoding
- Authentication flows
- Authorization checks
- Secrets in code
- CSRF protection

### Dependencies
```bash
pnpm audit
```

### Environment
- .env files not committed
- Secrets management
- HTTPS enforcement

## Usage
```
/security              # Full audit
/security deps         # Dependency check
/security auth         # Auth flow review
/security <file>       # Specific file
```

Run security audit: $ARGUMENTS
