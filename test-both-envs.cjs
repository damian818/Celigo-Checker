const prodToken = process.env.CELIGO_PROD_API_TOKEN;
const sbxToken = process.env.CELIGO_SBX_API_TOKEN || process.env.CELIGO_API_TOKEN;
const flowId = '68f7bcd4dfdf69e764c0a488';
const stepId = '68f7bd3c9ec727d02d11206d';

async function check(name, token) {
  if (!token) {
    console.log(`${name} token not found`);
    return;
  }
  const res = await fetch(`https://api.integrator.io/v1/flows/${flowId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log(`${name} GET /flows/${flowId}:`, res.status);
  if (res.ok) {
    const d = await res.json();
    console.log(`${name} flow found:`, d.name);
  }
}

async function run() {
  await check('PROD', prodToken);
  await check('SBX', sbxToken);
}
run();
