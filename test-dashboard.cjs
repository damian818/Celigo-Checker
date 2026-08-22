const fs = require('fs');
const content = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
console.log(content.includes('integrations?: CeligoIntegration[];'));
console.log(content.includes('const map = new Map<string, { id?: string; name: string; environment: string }>();'));
