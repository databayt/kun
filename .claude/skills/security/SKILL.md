---
name: Security
description: Security audit - OWASP Top 10, dependency scanning
when_to_use: "Use when code needs a security pass — OWASP Top 10, dependency vulnerabilities, auth and exposure checks. Unlike /guard, the per-URL tenant and authz quality keyword. Triggers on: security audit, are we vulnerable, scan the dependencies, owasp check."
argument-hint: "[deps|auth|file]"
model: opus
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
