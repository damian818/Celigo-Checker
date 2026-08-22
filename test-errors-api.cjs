const token = process.env.CELIGO_PROD_API_TOKEN || process.env.CELIGO_API_TOKEN;
fetch('https://api.integrator.io/v1/errors', { headers: { 'Authorization': `Bearer ${token}` }})
  .then(r => r.json().then(d => ({ status: r.status, data: d })))
  .then(res => {
    console.log('Status:', res.status);
    console.log('Data type:', Array.isArray(res.data) ? 'Array of length ' + res.data.length : typeof res.data);
    if(Array.isArray(res.data) && res.data.length > 0) {
      console.log('Sample error keys:', Object.keys(res.data[0]));
      console.log('Sample error:', res.data[0]);
    } else {
      console.log('Response:', res.data);
    }
  });
