fetch('http://127.0.0.1:3000/api/celigo/live-flows').then(r=>r.json()).then(d => {
  console.log('Flow sample keys:', Object.keys(d.flows[0]));
  console.log('Flow sample errorCount24h:', d.flows[0].errorCount24h);
});
