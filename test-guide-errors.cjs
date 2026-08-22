const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(async intgs => {
    if (!intgs || intgs.length === 0) return;
    const intg = intgs[0];
    console.log('Testing integration rollup for:', intg._id || intg.id);
    const intgErrRes = await fetch(`https://api.integrator.io/v1/integrations/${intg._id || intg.id}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
    const intgErrs = await intgErrRes.json();
    console.log('Integration errors response status:', intgErrRes.status, Array.isArray(intgErrs) ? intgErrs.length : intgErrs);
    if (Array.isArray(intgErrs) && intgErrs.length > 0) {
      const firstErr = intgErrs[0];
      const flowId = firstErr._flowId;
      console.log('Found flowId from integration errors:', flowId);
      if (flowId) {
        const flowErrRes = await fetch(`https://api.integrator.io/v1/flows/${flowId}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
        const flowErrs = await flowErrRes.json();
        console.log('Flow errors response status:', flowErrRes.status, flowErrs);
      }
    }
  });
