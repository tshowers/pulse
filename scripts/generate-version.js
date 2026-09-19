const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packagePath);
const outPath = path.join(__dirname, '..', 'public', 'assets', 'version.json');
const now = new Date();
const dateVersion = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
const buildNumberFromCi = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || process.env.GITHUB_RUN_ATTEMPT;
let buildNumber = Number(buildNumberFromCi) || 1;
try {
  const previous = JSON.parse(fs.readFileSync(outPath, 'utf8')).version || '';
  const match = previous.match(new RegExp(`^${dateVersion.replaceAll('.', '\\.')}-build\\.(\\d+)$`));
  if (!buildNumberFromCi && match) buildNumber = Number(match[1]) + 1;
} catch { }
const version = `${dateVersion}-build.${buildNumber}`;
packageJson.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ version, packageVersion: version }, null, 2)}\n`);
console.log(`Generated Pulse build version: ${version}`);
