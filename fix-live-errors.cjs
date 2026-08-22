const fs = require('fs');
let code = fs.readFileSync('src/server/apiHandler.ts', 'utf8');
code = code.replace(/let sandboxErrorCount = 0;/g, 'let sandboxErrorCount = 0;\n    const integrationMap = new Map<string, { name: string; environment?: string }>();');
fs.writeFileSync('src/server/apiHandler.ts', code);
