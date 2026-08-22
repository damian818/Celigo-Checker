const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/errors', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    console.log('Errors response:', Array.isArray(d) ? d.length : d);
    if(Array.isArray(d) && d.length > 0) console.log(Object.keys(d[0]));
  });
