const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
const stepId = '6196eb8cc7bc352fdc7ae9a2';
fetch(`https://api.integrator.io/v1/exports/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json().then(d => ({ status: r.status, endpoint: 'exports', data: d })))
  .then(res => {
    console.log('Export Errors:', res.status, Array.isArray(res.data) ? res.data.length : res.data);
    if(Array.isArray(res.data) && res.data.length > 0) console.log(res.data[0]);
    return fetch(`https://api.integrator.io/v1/imports/${stepId}/errors`, { headers: { 'Authorization': `Bearer ${token}` }});
  })
  .then(r => r.json().then(d => ({ status: r.status, endpoint: 'imports', data: d })))
  .then(res => {
    console.log('Import Errors:', res.status, Array.isArray(res.data) ? res.data.length : res.data);
    if(Array.isArray(res.data) && res.data.length > 0) console.log(res.data[0]);
  });
