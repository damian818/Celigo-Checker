const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/errors', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(async r => {
    console.log('GET /v1/errors status:', r.status);
    const d = await r.json();
    console.log('Response:', d);
  });
