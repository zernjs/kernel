## Security Policy

Report potential vulnerabilities privately (security@yourdomain.example) or open a confidential issue if your platform supports it. We acknowledge reports within 72 hours and aim to ship fixes as quickly as possible, prioritizing severity and exploitability.

## Supported Versions

- Main branch and latest prereleases (tags `vX.Y.Z[-pre]`).
- Older tags receive fixes based on severity and feasibility.

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
3. Release: publish patched version; update changelog and advisories.
4. Notify: credit reporters when appropriate.

## Operational Guidance

- Keep Node.js and dependencies updated; prefer minimal, vetted dependencies.
- Avoid embedding secrets in code or CI. Use repository/organization secrets.
- Pin actions in GitHub workflows to tagged versions.
- Prefer least-privilege permissions in workflows (read-only by default).
