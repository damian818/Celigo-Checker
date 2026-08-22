const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
const flowId = '658038ba3c3433279500e26f';
fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(async d => {
    console.log('Flow errors summary:', d);
    if (d.flowErrors) {
      for (const fe of d.flowErrors) {
        const stepId = fe._expOrImpId;
        console.log(`Checking step ${stepId}...`);
        const stepRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
        console.log(`Step errors status:`, stepRes.status, await stepRes.json());
      }
    }
  });
