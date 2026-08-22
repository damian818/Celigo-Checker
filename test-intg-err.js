const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations/6196eb48113a76451469374a/errors', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    console.log('Errors response:', Array.isArray(d) ? d.length : d);
  });
