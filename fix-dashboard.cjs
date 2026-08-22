const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
code = code.replace(/import { CeligoErrorRecord, CeligoFlow } from '\.\.\/types\/celigo';/g, "import { CeligoErrorRecord, CeligoFlow, CeligoIntegration } from '../types/celigo';");
code = code.replace(/flows: CeligoFlow\[\];/g, "flows: CeligoFlow[];\n  integrations?: CeligoIntegration[];");
code = code.replace(/export const DashboardView: React\.FC<DashboardViewProps> = \(\{/g, "export const DashboardView: React.FC<DashboardViewProps> = ({\n  integrations = [],");
code = code.replace(/const uniqueIntegrations = useMemo\(\(\) => \{[\s\S]*?\}, \[flows\]\);/g, `const uniqueIntegrations = useMemo(() => {
    if (integrations && integrations.length > 0) {
      return integrations.map(intg => ({
        key: intg.id,
        id: intg.id,
        name: intg.name,
        environment: intg.environment,
      }));
    }
    const map = new Map<string, { id?: string; name: string; environment: string }>();
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
