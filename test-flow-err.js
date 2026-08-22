const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/flows', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    const withJob = d.filter(f => f.lastJob || f.numErrors || f.unresolvedErrors || f.status === 'error');
    console.log('Flows with error stats at root:', withJob.length);
    if(withJob.length > 0) console.log(withJob[0]);
  });
