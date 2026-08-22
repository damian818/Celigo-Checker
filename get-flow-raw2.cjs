const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    const f = d.find(f => f._integrationId || f._integration_id || f.integrationId || f.integration);
    if(f) {
      console.log('Found flow with integration metadata:', { _integrationId: f._integrationId, _integration_id: f._integration_id, integrationId: f.integrationId });
    } else {
      console.log('No flow has integration info at the root level? Let us check a specific one.');
      console.log(d[0]);
    }
  });
