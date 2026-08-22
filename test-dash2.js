const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/dashboard', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => console.log('Dashboard:', d));
