const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    const sbxFlows = d.filter(f => f.sandbox === true);
    console.log('Flows with sandbox: true:', sbxFlows.length);
    if(d[0]) console.log('Sample flow sandbox property:', d[0].sandbox);
  });
