#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Gera badges de coverage baseado no relatório JSON do vitest
 */
async function generateCoverageBadge() {
  try {
    const coverageDir = path.join(__dirname, '..', 'coverage');
    const coverageJsonPath = path.join(coverageDir, 'coverage-final.json');

    if (!fs.existsSync(coverageJsonPath)) {
      console.error(
        '❌ Arquivo de coverage não encontrado. Execute "npm run test:coverage" primeiro.'
      );
      process.exit(1);
    }

    const coverageData = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));

    // Calcula totais a partir dos dados individuais dos arquivos
    let totalStatements = 0,
      coveredStatements = 0;
    let totalBranches = 0,
      coveredBranches = 0;
    let totalFunctions = 0,
      coveredFunctions = 0;
    let totalLines = 0,
      coveredLines = 0;

    Object.values(coverageData).forEach(fileData => {
      // Statements
      const statements = Object.values(fileData.s || {});
      totalStatements += statements.length;
      coveredStatements += statements.filter(count => count > 0).length;

      // Branches
      const branches = Object.values(fileData.b || {});
      branches.forEach(branchArray => {
        if (Array.isArray(branchArray)) {
          totalBranches += branchArray.length;
          coveredBranches += branchArray.filter(count => count > 0).length;
        }
      });

      // Functions
      const functions = Object.values(fileData.f || {});
      totalFunctions += functions.length;
      coveredFunctions += functions.filter(count => count > 0).length;

      // Lines (usando statementMap para contar linhas)
      const statementMap = fileData.statementMap || {};
      const linesCovered = new Set();
      const allLines = new Set();

      Object.keys(statementMap).forEach(key => {
        const line = statementMap[key].start.line;
        allLines.add(line);
        if (fileData.s[key] > 0) {
          linesCovered.add(line);
        }
      });

      totalLines += allLines.size;
      coveredLines += linesCovered.size;
    });

    const total = {
      statements: {
        pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
        covered: coveredStatements,
        total: totalStatements,
      },
      branches: {
        pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        covered: coveredBranches,
        total: totalBranches,
      },
      functions: {
        pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        covered: coveredFunctions,
        total: totalFunctions,
      },
      lines: {
        pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        covered: coveredLines,
        total: totalLines,
      },
    };

    // Extrai as métricas principais
    const statements = Math.round(total.statements.pct);
    const branches = Math.round(total.branches.pct);
    const functions = Math.round(total.functions.pct);
    const lines = Math.round(total.lines.pct);

    // Calcula a média geral
    const overall = Math.round((statements + branches + functions + lines) / 4);

    // Determina a cor do badge baseado na porcentagem
    function getBadgeColor(percentage) {
      if (percentage >= 90) return 'brightgreen';
      if (percentage >= 80) return 'green';
      if (percentage >= 70) return 'yellow';
      if (percentage >= 60) return 'orange';
      return 'red';
    }

    const color = getBadgeColor(overall);

    // Gera URLs dos badges
    const badges = {
      overall: `https://img.shields.io/badge/coverage-${overall}%25-${color}?style=for-the-badge`,
      statements: `https://img.shields.io/badge/statements-${statements}%25-${getBadgeColor(statements)}?style=flat-square`,
      branches: `https://img.shields.io/badge/branches-${branches}%25-${getBadgeColor(branches)}?style=flat-square`,
      functions: `https://img.shields.io/badge/functions-${functions}%25-${getBadgeColor(functions)}?style=flat-square`,
      lines: `https://img.shields.io/badge/lines-${lines}%25-${getBadgeColor(lines)}?style=flat-square`,
    };

    // Salva os badges em um arquivo JSON
    const badgesPath = path.join(__dirname, '..', 'coverage', 'badges.json');
    fs.writeFileSync(badgesPath, JSON.stringify(badges, null, 2));

    // Cria arquivo README com os badges
    const badgeReadmePath = path.join(__dirname, '..', 'coverage', 'README.md');
    const badgeReadmeContent = `# Coverage Badges

## Overall Coverage
![Coverage](${badges.overall})

## Detailed Coverage
![Statements](${badges.statements})
![Branches](${badges.branches})
![Functions](${badges.functions})
![Lines](${badges.lines})

## Coverage Report
- **Statements**: ${statements}% (${total.statements.covered}/${total.statements.total})
- **Branches**: ${branches}% (${total.branches.covered}/${total.branches.total})
- **Functions**: ${functions}% (${total.functions.covered}/${total.functions.total})
- **Lines**: ${lines}% (${total.lines.covered}/${total.lines.total})

Generated on: ${new Date().toISOString()}
`;

    fs.writeFileSync(badgeReadmePath, badgeReadmeContent);

    // Atualiza o README.md principal com o badge dinâmico
    const mainReadmePath = path.join(__dirname, '..', '..', '..', 'README.md');
    if (fs.existsSync(mainReadmePath)) {
      let mainReadmeContent = fs.readFileSync(mainReadmePath, 'utf8');

      // Regex para encontrar e substituir o badge de coverage
      const coverageBadgeRegex = /\[\!\[Coverage\]\([^\)]+\)\]\([^\)]+\)/;
      const newCoverageBadge = `[![Coverage](${badges.overall})](./packages/kernel/coverage/README.md)`;

      if (coverageBadgeRegex.test(mainReadmeContent)) {
        mainReadmeContent = mainReadmeContent.replace(coverageBadgeRegex, newCoverageBadge);
        fs.writeFileSync(mainReadmePath, mainReadmeContent);
        console.log('✅ README.md principal atualizado com novo badge de coverage!');
      }
    }

    console.log('✅ Coverage badges gerados com sucesso!');
    console.log(`📊 Coverage geral: ${overall}%`);
    console.log(`📁 Badges salvos em: ${badgesPath}`);
    console.log(`📄 README gerado em: ${badgeReadmePath}`);
    console.log('\n🏷️  Badge URL para README principal:');
    console.log(`[![Coverage](${badges.overall})](./packages/kernel/coverage/README.md)`);
  } catch (error) {
    console.error('❌ Erro ao gerar badges de coverage:', error.message);
    process.exit(1);
  }
}

// Executa o script
generateCoverageBadge();
