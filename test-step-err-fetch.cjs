const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
const flowId = '658038ba3c3433279500e26f';
const stepId = '658038b93c3433279500e253';
fetch(`https://api.integrator.io/v1/flows/${flowId}/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    console.log('Step errors endpoint result type:', Array.isArray(d) ? 'Array of length ' + d.length : typeof d, d);
  });
