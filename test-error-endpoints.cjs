const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
const flowId = '6196eb8dc7bc352fdc7ae9c2';
Promise.all([
  fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json().then(d => ({ ep: 'flow/errors', status: r.status, data: d }))),
  fetch(`https://api.integrator.io/v1/flows/${flowId}/audit`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json().then(d => ({ ep: 'flow/audit', status: r.status, data: d }))),
  fetch(`https://api.integrator.io/v1/auditLogs`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json().then(d => ({ ep: 'auditLogs', status: r.status, data: d }))),
]).then(results => {
  console.log(JSON.stringify(results, null, 2));
});
