const token = process.env.CELIGO_PROD_API_TOKEN;
const flowId = '68f7bd3c9ec727d02d11206d';

async function test() {
  const flowErrorsRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
  const flowErrorsJson = await flowErrorsRes.json();
  console.log('Flow errors JSON:', flowErrorsJson);
  
  const steps = flowErrorsJson.flowErrors || [];
  for (const stepItem of steps) {
    const numErr = stepItem.numError ?? stepItem.numErrors ?? stepItem.errorCount ?? 0;
    const stepId = stepItem._expOrImpId || stepItem._id || stepItem.id;
    console.log(`Step ${stepId} numError: ${numErr}`);
    if (numErr > 0 && stepId) {
      const stepErrRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
      const stepErrJson = await stepErrRes.json();
      console.log(`Step errors for ${stepId}:`, Array.isArray(stepErrJson) ? stepErrJson.length : stepErrJson);
      if (Array.isArray(stepErrJson) && stepErrJson.length > 0) {
        console.log('Sample error:', stepErrJson[0]);
      }
    }
  }
}
test();
