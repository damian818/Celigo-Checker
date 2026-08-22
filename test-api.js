import http from 'http';

http.get('http://127.0.0.1:3000/api/celigo/live-flows', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Flows connected:', parsed.connected);
      console.log('Integrations length:', parsed.integrations ? parsed.integrations.length : 'undefined');
      if (parsed.integrations && parsed.integrations.length > 0) {
         console.log('Sample integration:', parsed.integrations[0]);
      }
      console.log('Flows length:', parsed.flows ? parsed.flows.length : 'undefined');
    } catch(e) { console.error('Error parsing JSON:', e.message); }
  });
}).on('error', err => console.error(err.message));
