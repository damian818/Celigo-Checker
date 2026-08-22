const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows/6196eb8dc7bc352fdc7ae9c2/6196eb8cc7bc352fdc7ae9a2/errors', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(async r => {
    console.log('GET /v1/flows/{_id}/{_stepId}/errors status:', r.status);
    const d = await r.json();
    console.log('Response:', d);
  });
