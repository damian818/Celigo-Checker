const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(integrations => {
    if(!Array.isArray(integrations) || integrations.length === 0) {
      console.log('No integrations found');
      return;
    }
    const intg = integrations[0];
    console.log('Testing integration:', intg._id || intg.id, intg.name);
    return fetch(`https://api.integrator.io/v1/integrations/${intg._id || intg.id}/errors`, { headers: { 'Authorization': `Bearer ${token}` }})
      .then(r => r.json().then(d => ({ status: r.status, data: d })));
  })
  .then(res => {
    if(!res) return;
    console.log('Integration Errors Status:', res.status);
    console.log('Data:', Array.isArray(res.data) ? res.data.length + ' items' : res.data);
    if(Array.isArray(res.data) && res.data.length > 0) {
      console.log('Sample integration error:', res.data[0]);
    }
  });
