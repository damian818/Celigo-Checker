fetch('http://127.0.0.1:3000/api/celigo/live-flows').then(r=>r.json()).then(d => {
  console.log('Integrations length:', d.integrations ? d.integrations.length : 'undefined');
  if(d.integrations?.length) console.log(d.integrations[0]);
  console.log('Flows length:', d.flows ? d.flows.length : 'undefined');
});
fetch('http://127.0.0.1:3000/api/celigo/live-errors').then(r=>r.json()).then(d => {
  console.log('Errors length:', d.errors ? d.errors.length : 'undefined');
});
