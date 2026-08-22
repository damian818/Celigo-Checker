const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(async intgs => {
    for (const intg of intgs.slice(0, 20)) {
      const res = await fetch(`https://api.integrator.io/v1/integrations/${intg._id || intg.id}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const errs = await res.json();
        if (Array.isArray(errs) && errs.some(e => (e.numError || e.errorCount || e.numErrors || 0) > 0)) {
          console.log('Integration with errors:', intg.name, intg._id || intg.id, errs);
        }
      }
    }
  });
