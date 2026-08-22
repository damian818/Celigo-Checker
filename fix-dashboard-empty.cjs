const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
code = code.replace(/\/\/ Remove empty groups \(if any integrations had no flows matching filters\)\n    return Array\.from\(groupMap\.values\(\)\)\.filter\(g => g\.totalFlows > 0\)\.sort/g, `// Keep empty groups only if no search/status filters are applied
    const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';
    return Array.from(groupMap.values()).filter(g => hasActiveFilters ? g.totalFlows > 0 : true).sort`);
fs.writeFileSync('src/components/DashboardView.tsx', code);
