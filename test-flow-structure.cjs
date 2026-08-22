const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows/6196eb8dc7bc352fdc7ae9c2', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(flow => {
    console.log('Flow keys:', Object.keys(flow));
    console.log('Exports:', flow.exports ? flow.exports.length : 'none');
    console.log('Imports:', flow.imports ? flow.imports.length : 'none');
    console.log('Mappings:', flow.mappings ? flow.mappings.length : 'none');
    if(flow.exports && flow.exports[0]) console.log('Sample export:', Object.keys(flow.exports[0]), flow.exports[0]._id);
  });
