const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
code = code.replace(/const groupedIntegrations = useMemo<IntegrationGroup\[\]>\(\(\) => \{[\s\S]*?\}, \[filteredAndSortedFlows\]\);/g, `const groupedIntegrations = useMemo<IntegrationGroup[]>(() => {
    const groupMap = new Map<string, IntegrationGroup>();

    // First populate from actual integrations if available
    if (integrations && integrations.length > 0) {
      integrations.forEach(intg => {
        const isSbx = intg.environment === 'sandbox';
        const host = isSbx ? 'integrator.io' : 'integrator.io';
        const integrationUrl = intg.id ? \`https://\${host}/integrations/\${intg.id}\` : undefined;

        groupMap.set(intg.id, {
          id: intg.id,
          name: intg.name,
          environment: intg.environment || 'production',
          environmentLabel: intg.environmentLabel,
          flows: [],
          totalFlows: 0,
          healthyFlows: 0,
          criticalFlows: 0,
          degradedFlows: 0,
          totalErrors: 0,
          totalThroughput: 0,
          integrationUrl,
        });
      });
    }

    filteredAndSortedFlows.forEach(flow => {
      const integrationName = flow.integrationName || flow.group || 'General Integration';
      const integrationId = flow.integrationId || '';
      const groupKey = integrationId ? integrationId : \`name_\${integrationName}_\${flow.environment || 'prod'}\`;

      if (!groupMap.has(groupKey)) {
        const isSbx = flow.environment === 'sandbox';
        const host = isSbx ? 'integrator.io' : 'integrator.io';
        const integrationUrl = integrationId ? \`https://\${host}/integrations/\${integrationId}\` : undefined;

        groupMap.set(groupKey, {
          id: integrationId || groupKey,
          name: integrationName,
          environment: flow.environment || 'production',
          environmentLabel: flow.environmentLabel,
          flows: [],
          totalFlows: 0,
          healthyFlows: 0,
          criticalFlows: 0,
          degradedFlows: 0,
          totalErrors: 0,
          totalThroughput: 0,
          integrationUrl,
        });
      }

      const grp = groupMap.get(groupKey)!;
      grp.flows.push(flow);
      grp.totalFlows += 1;
      if (flow.status === 'healthy') grp.healthyFlows += 1;
      if (flow.status === 'critical') grp.criticalFlows += 1;
      if (flow.status === 'degraded') grp.degradedFlows += 1;
      grp.totalErrors += (flow.unresolvedErrors || flow.errorCount24h || 0);
      grp.totalThroughput += (flow.recordsProcessed24h || 0);
    });

    // Remove empty groups (if any integrations had no flows matching filters)
    return Array.from(groupMap.values()).filter(g => g.totalFlows > 0).sort((a, b) => {
      if (b.totalErrors !== a.totalErrors) return b.totalErrors - a.totalErrors;
      if (b.totalFlows !== a.totalFlows) return b.totalFlows - a.totalFlows;
      return a.name.localeCompare(b.name);
    });
  }, [filteredAndSortedFlows, integrations]);`);
fs.writeFileSync('src/components/DashboardView.tsx', code);
