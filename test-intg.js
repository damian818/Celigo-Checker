fetch('http://127.0.0.1:3000/api/celigo/live-flows').then(r=>r.json()).then(d => {
  console.log('Sample flow 0 integrationId:', d.flows[0]?.integrationId);
  console.log('Sample flow 0 celigoUrl:', d.flows[0]?.celigoUrl);
  console.log('Sample flow 100 integrationId:', d.flows[100]?.integrationId);
  console.log('Sample flow 100 celigoUrl:', d.flows[100]?.celigoUrl);
});
