## Security Policy

If you believe you have found a security vulnerability in this project, please report it responsibly using one of the following linked channels:

- Email: [viniciusborgeis@gmail.com](mailto:viniciusborgeis@gmail.com)
- GitHub Security Advisories: https://github.com/zernjs/zern-kernel/security/advisories/new

We will acknowledge vulnerability reports within 72 hours, provide an initial triage response within 7 days, and target a fix or mitigation within 90 days of confirmation (earlier for critical issues). We follow Coordinated Vulnerability Disclosure (CVD) and may publicly disclose within 90 days, or sooner if a fix is available and users can reasonably update. If a vulnerability is actively exploited in the wild, we may accelerate disclosure and remediation timelines.

## Supported Versions

- Main branch and latest prereleases (tags `vX.Y.Z[-pre]`).
- Older tags may receive backported fixes based on severity and feasibility.

## What is a Vulnerability?

A vulnerability is a weakness that could allow confidentiality, integrity, or availability violations. Examples include injection, insecure defaults, privilege escalation, or supply‑chain risks. If in doubt, please disclose privately and we will help determine impact and scope.

## Disclosure Policy and Timelines

- Acknowledge receipt: within 72 hours
- Initial triage and severity: within 7 days
- Target remediation: within 30–90 days depending on complexity and impact
- Public disclosure: coordinated, usually within 90 days of confirmation, or earlier by mutual agreement

## Hardening & Quality Gates

- TypeScript strict with ESLint; no `any` (enforced by lint rules).
- Unit/integration tests with coverage in CI.
- Static analysis: CodeQL workflow.
- OpenSSF Scorecard workflow (repository best-practices).
- Supply-chain hygiene: lockfile, Dependabot/renovations, SBOM.

## SBOM (CycloneDX)

Generate a CycloneDX SBOM for this package (local Syft or Docker):

```bash
pnpm sbom
# or
pnpm sbom:docker
```

This produces `sbom.json` in the repository root (`zern-kernel/`). You can ingest it in tools like Dependency-Track, Trustify, or Snyk for continuous monitoring.

## Vulnerability Management

1. Triage: reproduce and classify (severity, impact, affected versions).
2. Fix: develop patch and tests; run CI gates (lint, type-check, tests, CodeQL).
3. Release: publish patched version; update changelog and advisories; coordinate disclosure.
4. Notify: credit reporters when appropriate.

## Operational Guidance

- Keep Node.js and dependencies updated; prefer minimal, vetted dependencies.
- Avoid embedding secrets in code or CI. Use repository/organization secrets.
- Pin actions in GitHub workflows to tagged versions.
- Prefer least-privilege permissions in workflows (read-only by default).
