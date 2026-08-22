const fs = require('fs');
let code = fs.readFileSync('src/server/apiHandler.ts', 'utf8');

// Fix flowsToInspect to only check flows that ACTUALLY have errors, not every active flow
code = code.replace(/return errCount > 0 \|\| f\.status === 'error' \|\| f\.status === 'degraded' \|\| !f\.disabled;/g, "return errCount > 0 || f.status === 'error' || f.status === 'degraded';");

// Make the global errors endpoint the PRIMARY fast-path if possible? No, we still use the flow inspection
// but let's change batch size to 24 for speed
code = code.replace(/const batchSize = 12;/g, 'const batchSize = 25;');

fs.writeFileSync('src/server/apiHandler.ts', code);
