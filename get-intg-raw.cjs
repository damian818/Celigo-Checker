const fs = require('fs');
const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/integrations', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json())
  .then(d => {
    console.log(Object.keys(d[0] || {}));
    if (d[0]) console.log('exports?', d[0].exports, 'imports?', d[0].imports, '_flowIds?', d[0]._flowIds, 'flowIds?', d[0].flowIds, 'flows?', d[0].flows, 'installments?', d[0].installments);
    console.log('Sample integration keys:', d[0]);
  });
