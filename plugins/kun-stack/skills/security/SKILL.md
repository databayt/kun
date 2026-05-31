---
name: Security
description: Security audit - OWASP Top 10, dependency scanning
argument-hint: "[deps|auth|file]"
model: claude-opus-4-7
allowed-tools: ["Bash(pnpm *)", "Read", "Glob", "Grep"]
---

# Security Audit

Run comprehensive security checks.

## Usage
```
/security              # Full audit
/security deps         # Dependency check
/security auth         # Auth flow review
/security <file>       # Specific file
```

## Argument: $ARGUMENTS

## Checks

### OWASP Top 10
- Injection (SQL, NoSQL, Command)
- Broken Authentication
- Sensitive Data Exposure
- Broken Access Control
- Security Misconfiguration
- XSS (Cross-Site Scripting)
- Vulnerable Dependencies
- Insufficient Logging

### Code Analysis
- Input validation, Output encoding
- Authentication/Authorization flows
- Secrets in code, CSRF protection

### Dependencies
```bash
pnpm audit
```
