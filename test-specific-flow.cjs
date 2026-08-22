const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
const intgId = '6839072b5e21c9253f327ba7';
const flowId = '68f7bcd4dfdf69e764c0a488';
const stepId = '68f7bd3c9ec727d02d11206d';

async function test() {
  console.log('1. Checking integration errors...');
  const intgRes = await fetch(`https://api.integrator.io/v1/integrations/${intgId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
  const intgErrs = await intgRes.json();
  console.log('Integration errors status:', intgRes.status, Array.isArray(intgErrs) ? intgErrs.find(e => e._flowId === flowId) : intgErrs);

  console.log('2. Checking flow errors summary...');
  const flowRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
  const flowErrs = await flowRes.json();
  console.log('Flow errors status:', flowRes.status, flowErrs);

  console.log('3. Checking step errors directly...');
  const stepRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
  const stepErrs = await stepRes.json();
  console.log('Step errors status:', stepRes.status, Array.isArray(stepErrs) ? stepErrs.length : stepErrs);
  if (Array.isArray(stepErrs) && stepErrs.length > 0) {
    console.log('Sample error:', stepErrs[0]);
  }

  console.log('4. Checking exports/imports errors directly...');
  const expRes = await fetch(`https://api.integrator.io/v1/exports/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log('Export errors status:', expRes.status, await expRes.json());
  
  const impRes = await fetch(`https://api.integrator.io/v1/imports/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log('Import errors status:', impRes.status, await impRes.json());
}

test();
