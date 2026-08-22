fetch('http://127.0.0.1:3000/api/celigo/live-flows').then(r=>r.json()).then(d => {
  const active = d.flows.filter(f => f.status !== 'paused' && f.lastRunTime !== 'Recently');
  active.sort((a,b) => new Date(b.lastRunTime).getTime() - new Date(a.lastRunTime).getTime());
  console.log('Total active flows:', active.length);
});
