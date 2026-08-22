const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    console.log(d.slice(0, 20).map(f => f.name));
  });
