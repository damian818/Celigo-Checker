const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(async intgs => {
    console.log('Got', intgs.length, 'integrations.');
    let flowsWithErrors = [];
    for(let i=0; i<Math.min(10, intgs.length); i++) {
       const res = await fetch(`https://api.integrator.io/v1/integrations/${intgs[i]._id}/errors`, { headers: { 'Authorization': `Bearer ${token}` }});
       if(res.ok) {
         const errs = await res.json();
         const errFlows = errs.filter(e => e.numError > 0 || e.errorCount > 0 || e.numErrors > 0);
         flowsWithErrors.push(...errFlows);
       }
    }
    console.log('Flows with errors in first 10 intgs:', flowsWithErrors);
  });
