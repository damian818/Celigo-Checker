const token = process.env.CELIGO_PROD_API_TOKEN;
const flowId = '68f7bd3c9ec727d02d11206d';

async function test() {
  const res = await fetch(`https://api.integrator.io/v1/flows/${flowId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log('Flow fetch status:', res.status);
  if (res.ok) {
    const d = await res.json();
    console.log('Flow name:', d.name);
    const errRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
    console.log('Flow errors status:', errRes.status, await errRes.json());
  }
}
test();
