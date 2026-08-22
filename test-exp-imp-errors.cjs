const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
const expId = '6196eb8cc7bc352fdc7ae9a5';
const impId = '6196eb8cc7bc352fdc7ae9b4';
Promise.all([
  fetch(`https://api.integrator.io/v1/exports/${expId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json().then(d => ({ endpoint: 'exports', status: r.status, data: d }))),
  fetch(`https://api.integrator.io/v1/imports/${impId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json().then(d => ({ endpoint: 'imports', status: r.status, data: d }))),
  fetch(`https://api.integrator.io/v1/flows/6196eb8dc7bc352fdc7ae9c2/errors`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json().then(d => ({ endpoint: 'flow-errors', status: r.status, data: d })))
]).then(results => {
  console.log(JSON.stringify(results, null, 2));
});
