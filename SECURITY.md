# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

1. **Do NOT** open a public GitHub issue
2. Contact the maintainer directly via GitHub private message
3. Include details about the vulnerability and steps to reproduce

We will respond within 48 hours and work with you to understand and address the issue.

## Security Measures

This repository employs the following security measures:

- **Dependabot**: Automated dependency vulnerability scanning
- **CodeQL**: Static analysis for security vulnerabilities
- **Gitleaks**: Secret detection in commits
- **Branch Protection**: Required reviews and CI checks before merging

## Supported Versions

| Version | Supported |
|---------|-----------|
| 6.x     | ✅ Yes    |
| < 6.0   | ❌ No     |

## Best Practices

- Never commit secrets or API keys
- Use environment variables for sensitive configuration
- Keep dependencies updated
- Follow the principle of least privilege
