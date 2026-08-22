const fs = require('fs');
let code = fs.readFileSync('src/server/apiHandler.ts', 'utf8');
code = code.replace(/integrations: Array\.from\(integrationMap\.entries\(\)\)\.map\(\(\[id, val\]\) => \(\{ id, name: val\.name, environment: val\.environment \}\)\),\n      integrations: Array\.from\(integrationMap\.entries\(\)\)\.map\(\(\[id, val\]\) => \(\{ id, name: val\.name, environment: val\.environment \}\)\),/g, 'integrations: Array.from(integrationMap.entries()).map(([id, val]) => ({ id, name: val.name, environment: val.environment })),');
fs.writeFileSync('src/server/apiHandler.ts', code);
