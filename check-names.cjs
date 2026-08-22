const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    const sbxNames = d.filter(i => /sb|sandbox|test|dev|uat/i.test(i.name)).map(i => i.name);
    console.log('Sample matching names:', sbxNames.slice(0, 10));
    console.log('Total matching names:', sbxNames.length);
  });
