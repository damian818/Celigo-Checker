const fs = require('fs');
let code = fs.readFileSync('src/server/apiHandler.ts', 'utf8');

const newLogic = `
        // 1. Fetch Integrations
        const flowToIntegrationMap = new Map<string, string>();
        const integrationIds = new Set<string>();
        try {
          const integrations = await fetchAllCeligoPages(\`\${target.stack}/v1/integrations\`, target.token, 50);
          integrations.forEach((intg: any) => {
            const intgId = String(intg._id || intg.id);
            integrationIds.add(intgId);
            integrationMap.set(intgId, {
              name: intg.name || 'Integration Group',
              environment: intg.environment || intg.env || target.name,
            });
            if (Array.isArray(intg._flow_ids)) {
              intg._flow_ids.forEach((fid: any) => flowToIntegrationMap.set(String(fid), intgId));
            }
            if (Array.isArray(intg.flows)) {
              intg.flows.forEach((flowItem: any) => {
                const fid = typeof flowItem === 'string' ? flowItem : String(flowItem._id || flowItem.id);
                flowToIntegrationMap.set(fid, intgId);
              });
            }
          });
        } catch {
          // Continue
        }

        // 2. Fetch flows
        const flows = await fetchAllCeligoPages(\`\${target.stack}/v1/flows\`, target.token, 100);

        // 3. Find flows that actually have errors by querying integration error summaries!
        const flowsWithErrorsList = new Set<string>();
        
        try {
          const intgIdArray = Array.from(integrationIds);
          const intgBatchSize = 15;
          for (let i = 0; i < intgIdArray.length; i += intgBatchSize) {
            const batch = intgIdArray.slice(i, i + intgBatchSize);
            await Promise.all(batch.map(async (intgId) => {
              try {
                const res = await fetch(\`\${target.stack}/v1/integrations/\${intgId}/errors\`, {
                  headers: { 'Authorization': \`Bearer \${target.token}\`, 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                  const intgErrors = await res.json();
                  if (Array.isArray(intgErrors)) {
                    intgErrors.forEach(ie => {
                      if (ie.numError > 0 || ie.errorCount > 0 || ie.numErrors > 0) {
                        if (ie._flowId) flowsWithErrorsList.add(String(ie._flowId));
                      }
                    });
                  }
                }
              } catch (e) {
                // Ignore
              }
            }));
          }
        } catch (e) {
          // Ignore
        }

        const flowsToInspect = flows.filter((f: any) => {
          const flowId = String(f._id || f.id);
          const hasKnownError = flowsWithErrorsList.has(flowId);
          const errCount = f.numErrors || f.unresolvedErrors || f.unresolvedErrorCount || f.errorCount || f.numNewErrors || (f.lastJob?.numErrors) || (f.lastError ? 1 : 0);
          return hasKnownError || errCount > 0 || f.status === 'error' || f.status === 'degraded';
        });

        // 4. Query /v1/flows/{_id}/errors in concurrent batches
`;

const startIndex = code.indexOf('// 1. Fetch Integrations');
const endIndex = code.indexOf('// Query /v1/flows/{_id}/errors in concurrent batches');

if (startIndex > -1 && endIndex > -1) {
   code = code.substring(0, startIndex) + newLogic.trim() + '\n        ' + code.substring(endIndex);
   fs.writeFileSync('src/server/apiHandler.ts', code);
   console.log('Logic replaced successfully.');
} else {
   console.log('Could not find markers to replace logic.');
}
