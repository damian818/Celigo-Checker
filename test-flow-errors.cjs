const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows/6196eb8dc7bc352fdc7ae9c2/errors', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json().then(d => ({ status: r.status, data: d })))
  .then(res => {
    console.log('Flow Errors Status:', res.status);
    console.log('Data:', Array.isArray(res.data) ? res.data.length + ' items' : res.data);
    if(Array.isArray(res.data) && res.data.length > 0) {
      console.log('Sample flow error item:', res.data[0]);
    }
  });
