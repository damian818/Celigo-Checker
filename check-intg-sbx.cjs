const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    const sbxIntgs = d.filter(i => i.sandbox === true);
    console.log('Integrations with sandbox: true:', sbxIntgs.length, 'out of', d.length);
    if(d[0]) console.log('Sample integration sandbox property:', d[0].sandbox, 'name:', d[0].name);
  });
