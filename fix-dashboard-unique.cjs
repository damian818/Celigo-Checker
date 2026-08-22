const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
code = code.replace(/const uniqueIntegrations = useMemo\(\(\) => \{[\s\S]*?\}, \[flows, integrations\]\);/g, `const uniqueIntegrations = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; environment: string }>();

    if (integrations && integrations.length > 0) {
      integrations.forEach(intg => {
        map.set(intg.id, { id: intg.id, name: intg.name, environment: intg.environment || 'production' });
      });
    }

    flows.forEach(f => {
      const name = f.integrationName || f.group || 'General Integration';
      const key = f.integrationId || name;
      if (!map.has(key)) {
        map.set(key, { id: f.integrationId, name, environment: f.environment || 'production' });
      }
    });

    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      id: val.id,
      name: val.name,
      environment: val.environment,
    }));
  }, [flows, integrations]);`);
fs.writeFileSync('src/components/DashboardView.tsx', code);
