const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    console.log(Object.keys(d[0] || {}));
    if (d[0]) console.log('integrationId?', d[0].integrationId, '_integrationId?', d[0]._integrationId, '_integration_id?', d[0]._integration_id);
    console.log('Sample flow 0:', d[0]);
  });
