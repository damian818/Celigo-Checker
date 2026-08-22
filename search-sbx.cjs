const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    const matches = d.filter(f => /sandbox|sbx|sbox|tstdrv|\bsb\b/i.test(f.name));
    console.log('Matching names:', matches.map(m => m.name));
  });
