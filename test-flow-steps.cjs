const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows/6196eb8dc7bc352fdc7ae9c2', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(flow => {
    console.log('pageGenerators:', JSON.stringify(flow.pageGenerators, null, 2));
    console.log('pageProcessors:', JSON.stringify(flow.pageProcessors, null, 2));
  });
