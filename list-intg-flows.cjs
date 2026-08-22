const token = process.env.CELIGO_PROD_API_TOKEN;
const intgId = '6839072b5e21c9253f327ba7';

async function test() {
  const res = await fetch(`https://api.integrator.io/v1/flows?_integrationId=${intgId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  const flows = await res.json();
  console.log('Flows for integration:', Array.isArray(flows) ? flows.length : flows);
  if (Array.isArray(flows)) {
    for (const f of flows) {
      console.log('-', f._id, f.name);
    }
  }
}
test();
