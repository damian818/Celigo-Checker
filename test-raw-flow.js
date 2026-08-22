import http from 'http';
http.get('http://127.0.0.1:3000/api/celigo/live-flows', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Mapped Flow integrationId:', parsed.flows[0].integrationId);
    } catch(e) {}
  });
});
