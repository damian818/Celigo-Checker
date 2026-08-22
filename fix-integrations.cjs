const fs = require('fs');
let code = fs.readFileSync('src/server/apiHandler.ts', 'utf8');

// We need to move the integrationMap initialization outside the loop
// so we can collect all integrations across environments
const targetRegex = /const integrationMap = new Map<string, { name: string; environment\?: string }>\(\);/g;

// Replace it with an empty string, then add it outside the loop
code = code.replace(targetRegex, '');

code = code.replace('let sandboxFlowCount = 0;', 'let sandboxFlowCount = 0;\n    const integrationMap = new Map<string, { name: string; environment?: string }>();');

// Find the return payload for /celigo/live-flows
code = code.replace('flows: allMappedFlows,', 'flows: allMappedFlows,\n      integrations: Array.from(integrationMap.entries()).map(([id, val]) => ({ id, name: val.name, environment: val.environment })),');

fs.writeFileSync('src/server/apiHandler.ts', code);
