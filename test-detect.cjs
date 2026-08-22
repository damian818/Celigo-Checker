function detectCeligoEnvironment(flow, integration) {
  const explicitEnv = String(flow.environment || flow.env || integration?.environment || integration?.env || '').toLowerCase();
  if (explicitEnv === 'sandbox' || explicitEnv === 'sbx') return { env: 'sandbox', label: 'Sandbox' };
  if (explicitEnv === 'production' || explicitEnv === 'prod') return { env: 'production', label: 'Production' };
  if (explicitEnv === 'staging' || explicitEnv === 'stage' || explicitEnv === 'uat') return { env: 'staging', label: 'Staging' };
  if (explicitEnv === 'development' || explicitEnv === 'dev') return { env: 'development', label: 'Development' };

  const text = `${flow.name || ''} ${flow.description || ''} ${integration?.name || ''} ${flow._source_id || ''} ${flow._target_id || ''} ${flow.group || ''}`.toLowerCase();
  
  if (/(\b|_|-|\()(sandbox|sbx|sbox|testbed|tstdrv|sb)(\b|_|-|\)|[0-9])/i.test(text) || text.includes('sandbox') || text.includes('sb_') || text.includes('_sb')) {
    return { env: 'sandbox', label: 'Sandbox' };
  }
  return { env: 'production', label: 'Production' };
}

console.log(detectCeligoEnvironment({ name: 'SB-ACRS-CPL: test' }));
