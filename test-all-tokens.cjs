const tokens = {
  PROD: process.env.CELIGO_PROD_API_TOKEN,
  SBX: process.env.CELIGO_SANDBOX_API_TOKEN,
  DEFAULT: process.env.CELIGO_API_TOKEN
};

const intgId = '6839072b5e21c9253f327ba7';
const flowId = '68f7bcd4dfdf69e764c0a488';

async function test() {
  for (const [name, token] of Object.entries(tokens)) {
    if (!token) continue;
    const res = await fetch(`https://api.integrator.io/v1/integrations/${intgId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    console.log(`Token ${name} integration fetch status:`, res.status);
    if (res.ok) {
      const flowRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      console.log(`Token ${name} flow fetch status:`, flowRes.status);
      if (flowRes.ok) {
        console.log(`SUCCESS with token ${name}!`);
        const flowData = await flowRes.json();
        console.log('Flow data:', flowData.name);
        const errRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
        console.log('Flow errors status:', errRes.status, await errRes.json());
      }
    }
  }
}
test();
