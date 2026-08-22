const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/setFlows\(liveFlowsRes\.flows \|\| \[\]\);/g, 'setFlows(liveFlowsRes.flows || []);\n          setIntegrations(liveFlowsRes.integrations || []);');
code = code.replace(/<DashboardView/g, '<DashboardView\n            integrations={integrations}');
code = code.replace(/setFlows\(\[\]\);/g, 'setFlows([]);\n        setIntegrations([]);');
fs.writeFileSync('src/App.tsx', code);
