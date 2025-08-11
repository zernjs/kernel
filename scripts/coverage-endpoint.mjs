import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

function buildBadge(pct) {
  const pctNum = Number(pct);
  const msg = `${pctNum.toFixed(1)}%`;
  const color =
    pctNum >= 90
      ? 'brightgreen'
      : pctNum >= 80
        ? 'green'
        : pctNum >= 70
          ? 'yellowgreen'
          : pctNum >= 60
            ? 'yellow'
            : 'orange';
  return { schemaVersion: 1, label: 'coverage', message: msg, color };
}

function main() {
  const summaryPath = 'coverage/coverage-summary.json';
  if (!existsSync(summaryPath)) return;

  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  // Prefer lines.pct, fallback to statements.pct
  const pct = summary.total?.lines?.pct ?? summary.total?.statements?.pct ?? 0;

  mkdirSync('coverage', { recursive: true });
  writeFileSync('coverage/coverage-endpoint.json', JSON.stringify(buildBadge(pct)));
}

main();
