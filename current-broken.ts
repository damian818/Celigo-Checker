apiRouter.get('/celigo/live-flows', async (req: Request, res: Response) => {
  const targets = getCeligoTargets();

  if (targets.length === 0) {
    return res.json({
      connected: false,
      prodConnected: false,
      sandboxConnected: false,
      message: 'Neither CELIGO_PROD_API_TOKEN nor CELIGO_SANDBOX_API_TOKEN is configured in Settings / Secrets.',
      flows: [],
      totalCount: 0,
      prodFlowCount: 0,
      sandboxFlowCount: 0,
    });
  }

  try {
    const allMappedFlows: any[] = [];
    const seenFlowIds = new Set<string>();
    let prodFlowCount = 0;
    let sandboxFlowCount = 0;
    const integrationMap = new Map<string, { name: string; environment?: string }>();

    for (const target of targets) {
      try {
        // 1. Fetch Integrations
        const flowToIntegrationMap = new Map<string, string>();
        const integrationIds = new Set<string>();
        try {
          const integrations = await fetchAllCeligoPages(`${target.stack}/v1/integrations`, target.token, 50);
          integrations.forEach((intg: any) => {
            const intgId = String(intg._id || intg.id);
            integrationIds.add(intgId);
            integrationMap.set(intgId, {
              name: intg.name || 'Integration Group',
              environment: intg.environment || intg.env || target.name,
            });
            if (Array.isArray(intg._flow_ids)) {
              intg._flow_ids.forEach((fid: any) => flowToIntegrationMap.set(String(fid), intgId));
            }
            if (Array.isArray(intg.flows)) {
              intg.flows.forEach((flowItem: any) => {
                const fid = typeof flowItem === 'string' ? flowItem : String(flowItem._id || flowItem.id);
                flowToIntegrationMap.set(fid, intgId);
              });
            }
          });
        } catch {
          // Continue
        }

        // 2. Fetch flows
        const flows = await fetchAllCeligoPages(`${target.stack}/v1/flows`, target.token, 100);

        // 3. Find flows that actually have errors by querying integration error summaries!
        const flowsWithErrorsList = new Set<string>();
        
        try {
          const intgIdArray = Array.from(integrationIds);
          const intgBatchSize = 15;
          for (let i = 0; i < intgIdArray.length; i += intgBatchSize) {
            const batch = intgIdArray.slice(i, i + intgBatchSize);
            await Promise.all(batch.map(async (intgId) => {
              try {
                const res = await fetch(`${target.stack}/v1/integrations/${intgId}/errors`, {
                  headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                  const intgErrors = await res.json();
                  if (Array.isArray(intgErrors)) {
                    intgErrors.forEach(ie => {
                      if (ie.numError > 0 || ie.errorCount > 0 || ie.numErrors > 0) {
                        if (ie._flowId) flowsWithErrorsList.add(String(ie._flowId));
                      }
                    });
                  }
                }
              } catch (e) {
                // Ignore
              }
            }));
          }
        } catch (e) {
          // Ignore
        }

        const flowsToInspect = flows.filter((f: any) => {
          const flowId = String(f._id || f.id);
          const hasKnownError = flowsWithErrorsList.has(flowId);
          const errCount = f.numErrors || f.unresolvedErrors || f.unresolvedErrorCount || f.errorCount || f.numNewErrors || (f.lastJob?.numErrors) || (f.lastError ? 1 : 0);
          return hasKnownError || errCount > 0 || f.status === 'error' || f.status === 'degraded';
        });

        // 4. Query /v1/flows/{_id}/errors in concurrent batches
        // Query /v1/flows/{_id}/errors in concurrent batches
        const batchSize = 25;
        for (let i = 0; i < flowsToInspect.length; i += batchSize) {
          const batch = flowsToInspect.slice(i, i + batchSize);
          const batchPromises = batch.map(async (flow: any) => {
            const flowId = String(flow._id || flow.id);
            const integrationId = flow._integration_id 
              ? String(flow._integration_id) 
              : (flowToIntegrationMap.get(flowId) || (flow.integration?._id ? String(flow.integration._id) : (flow.integrationId ? String(flow.integrationId) : undefined)));
            
            try {
              // GET /v1/flows/{_id}/errors returns per-step error summaries
              const flowStepsResult = await fetchAllCeligoPages(`${target.stack}/v1/flows/${flowId}/errors`, target.token, 30);
              
              if (!Array.isArray(flowStepsResult) || flowStepsResult.length === 0) {
                // If flow itself reports errors, synthesize an entry if no steps returned
                const directErrCount = flow.numErrors || flow.unresolvedErrors || flow.errorCount || 0;
                if (directErrCount > 0) {
                  return [{
                    _id: `${flowId}_direct_err`,
                    errorId: `${flowId}_direct_err`,
                    _flow_id: flowId,
                    flowName: flow.name,
                    _integration_id: integrationId,
                    sourceApp: flow._source_id || 'Source System',
                    targetApp: flow._target_id || 'Target System',
                    code: flow.lastErrorCode || 'UNRESOLVED_RECORD_ERROR',
                    message: flow.lastErrorMessage || `${directErrCount} unresolved record(s) encountered in flow "${flow.name}".`,
                    retryCount: 1,
                    severity: directErrCount >= 5 ? 'critical' : 'high',
                    recordId: `FLOW-${flowId.substring(0, 8)}`,
                  }];
                }
                return [];
              }

              const stepErrorPromises: Promise<any[]>[] = [];

              for (const stepItem of flowStepsResult) {
                // Case A: The endpoint directly returned raw error records
                if (stepItem.message || stepItem.errorMessage || stepItem.errorId || stepItem.code || stepItem.errorCode) {
                  stepErrorPromises.push(Promise.resolve([{
                    ...stepItem,
                    _flow_id: flowId,
                    flowName: flow.name,
                    _integration_id: integrationId,
                  }]));
                  continue;
                }

                // Case B: Step error summary entry { _id, numError, ... }
                const stepNumErrors = stepItem.numError ?? stepItem.numErrors ?? stepItem.errorCount ?? stepItem.errors ?? 0;
                const stepId = String(stepItem._id || stepItem.id || stepItem._stepId || stepItem.stepId || stepItem._export_id || stepItem._import_id || '');

                if (stepNumErrors > 0 && stepId) {
                  // Query step-level errors: GET /v1/flows/{_id}/{_stepId}/errors
                  stepErrorPromises.push(
                    (async () => {
                      try {
                        const stepErrors = await fetchAllCeligoPages(`${target.stack}/v1/flows/${flowId}/${stepId}/errors`, target.token, 50);
                        if (Array.isArray(stepErrors) && stepErrors.length > 0) {
                          return stepErrors.map((errRecord: any) => ({
                            ...errRecord,
                            _flow_id: flowId,
                            flowName: flow.name,
                            _step_id: stepId,
                            stepName: stepItem.name || 'Step',
                            _integration_id: integrationId,
                          }));
                        } else {
                          // Step reports numError > 0 but errors endpoint was empty/paged: synthesize step record
                          return [{
                            _id: `${flowId}_${stepId}_err`,
                            errorId: `${flowId}_${stepId}_err`,
                            _flow_id: flowId,
                            flowName: flow.name,
                            _step_id: stepId,
                            stepName: stepItem.name || 'Step',
                            _integration_id: integrationId,
                            sourceApp: flow._source_id || 'Source System',
                            targetApp: flow._target_id || 'Target System',
                            code: stepItem.lastErrorCode || 'STEP_RECORD_ERROR',
                            message: stepItem.lastErrorMessage || `${stepNumErrors} record error(s) in step "${stepItem.name || stepId}".`,
                            retryCount: 1,
                            severity: stepNumErrors >= 5 ? 'critical' : 'high',
                            recordId: `STEP-${stepId.substring(0, 8)}`,
                          }];
                        }
                      } catch (stepFetchErr) {
                        console.warn(`Failed to fetch step errors for ${flowId}/${stepId}:`, stepFetchErr);
                        return [{
                          _id: `${flowId}_${stepId}_err`,
                          errorId: `${flowId}_${stepId}_err`,
                          _flow_id: flowId,
                          flowName: flow.name,
                          _step_id: stepId,
                          stepName: stepItem.name || 'Step',
                          _integration_id: integrationId,
                          sourceApp: flow._source_id || 'Source System',
                          targetApp: flow._target_id || 'Target System',
                          code: 'STEP_RECORD_ERROR',
                          message: `${stepNumErrors} unresolved record error(s) in step "${stepItem.name || stepId}".`,
                          retryCount: 1,
                          severity: stepNumErrors >= 5 ? 'critical' : 'high',
                          recordId: `STEP-${stepId.substring(0, 8)}`,
                        }];
                      }
                    })()
                  );
                }
              }

              const resolvedStepErrors = await Promise.all(stepErrorPromises);
              return resolvedStepErrors.flat();
            } catch (flowErr) {
              return [];
            }
          });

          const batchResults = await Promise.all(batchPromises);
          rawErrors.push(...batchResults.flat());
        }

        // 4. Try global /v1/errors endpoint as supplemental check
        try {
          const globalErrors = await fetchAllCeligoPages(`${target.stack}/v1/errors`, target.token, 20);
          if (Array.isArray(globalErrors) && globalErrors.length > 0) {
            rawErrors.push(...globalErrors);
          }
        } catch {
          // Supplemental
        }

        // 5. Map and classify all collected raw error records
        rawErrors.forEach((e: any, idx: number) => {
          const rawId = String(e.errorId || e._id || e.id || `${e._flow_id}_${e.code}_${e.recordId || ''}_${idx}`);
          const uniqueKey = `${target.name}_${rawId}`;
          if (seenErrorIds.has(uniqueKey)) return;
          seenErrorIds.add(uniqueKey);

          if (target.name === 'production') prodErrorCount++;
          if (target.name === 'sandbox') sandboxErrorCount++;

          const code = e.code || e.errorCode || e.error?.code || 'CELIGO_ERROR';
          const message = e.message || e.errorMessage || e.error?.message || 'Error occurred during export/import processing';
          
          let retrySafety: 'safe' | 'verify_data' | 'manual_intervention' = 'verify_data';
          let retrySafetyReason = 'Inspect source record before retrying.';
          let category = 'data_validation';
          let actionRequiredBy: 'Accounting' | 'Sales Ops' | 'IT Support' | 'Warehouse' | 'Customer Success' = 'IT Support';
          let severity: 'critical' | 'high' | 'medium' | 'low' = (e.severity as any) || 'high';

          const lowerMsg = (message + ' ' + code).toLowerCase();

          if (lowerMsg.includes('concurrency') || lowerMsg.includes('locked') || lowerMsg.includes('lock_request_timeout') || lowerMsg.includes('429') || lowerMsg.includes('rate limit')) {
            retrySafety = 'safe';
            retrySafetyReason = 'Transient concurrency or rate limit collision. Safe for immediate retry without data changes.';
            category = 'system_timeout';
            severity = 'medium';
          } else if (lowerMsg.includes('tax') || lowerMsg.includes('vat') || lowerMsg.includes('accounting') || lowerMsg.includes('gl account') || lowerMsg.includes('invoice')) {
            retrySafety = 'verify_data';
            retrySafetyReason = 'Financial accounting validation failed. Verify tax code or address mapping.';
            category = 'data_validation';
            actionRequiredBy = 'Accounting';
            severity = 'critical';
          } else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('401') || lowerMsg.includes('token expired') || lowerMsg.includes('invalid_grant')) {
            retrySafety = 'manual_intervention';
            retrySafetyReason = 'Authentication token expired or credentials revoked. Re-authorize connection.';
            category = 'auth_failure';
            actionRequiredBy = 'IT Support';
            severity = 'critical';
          } else if (lowerMsg.includes('customer') || lowerMsg.includes('email') || lowerMsg.includes('lead') || lowerMsg.includes('contact')) {
            actionRequiredBy = 'Sales Ops';
            category = 'data_validation';
            severity = 'high';
          } else if (lowerMsg.includes('inventory') || lowerMsg.includes('sku') || lowerMsg.includes('warehouse') || lowerMsg.includes('fulfillment')) {
            actionRequiredBy = 'Warehouse';
            category = 'mapping_failure';
            severity = 'high';
          }

          const flowId = String(e._flow_id || e.flowId || 'unknown_flow');
          const integrationId = e._integration_id 
            ? String(e._integration_id) 
            : (flowToIntegrationMap.get(flowId) || (e.integrationId ? String(e.integrationId) : undefined));
          
          const integrationInfo = integrationId ? integrationMap.get(integrationId) : undefined;
          const integrationName = integrationInfo?.name || e.integrationName || (target.name === 'sandbox' ? 'Sandbox Integration' : 'General Integration');

          // Exact Celigo Flow Link Format: https://integrator.io/integrations/{integrationId}/flows/sections/{flowId}
          const celigoUrl = integrationId 
            ? `https://${target.host}/integrations/${integrationId}/flows/sections/${flowId}`
            : `https://${target.host}/flows/${flowId}`;

          const occurredTime = e.occurredAt || e.createdAt || e.timestamp;

          allMappedErrors.push({
            id: uniqueKey,
            flowId,
            flowName: e.flowName || e.flow?.name || 'Celigo Flow',
            stepId: e._step_id || e.stepId,
            stepName: e.stepName,
            traceKey: e.traceKey,
            retryDataKey: e.retryDataKey,
            integrationId,
            integrationName,
            environment: target.name,
            environmentLabel: target.label,
            celigoUrl,
            sourceApp: e.sourceApp || e.source?.name || 'Source System',
            targetApp: e.targetApp || e.target?.name || 'Target System',
            timestamp: occurredTime ? new Date(occurredTime).toLocaleTimeString() : 'Recently',
            recordIdentifier: e.recordId || e.sourceRecordId || e.recordIdentifier || e.sourceRecord || `REC-${idx + 100}`,
            recordType: e.recordType || e.entityType || 'Record',
            severity,
            category,
            rawErrorCode: code,
            rawErrorMessage: message,
            retryCount: e.retryCount || 1,
            maxRetries: 5,
            status: e.resolved ? 'resolved' : 'unresolved',
            plainEnglishSummary: message.length > 180 ? `${message.substring(0, 180)}...` : message,
            businessImpact: 'Record blocked from syncing to downstream business system',
            rootCauseSimple: `Celigo connector error: ${code}`,
            actionRequiredBy,
            retrySafety,
            retrySafetyReason,
            rawPayload: e.data || e.record || e.payload || e.source || {},
            suggestedCliCommand: `celigo flows:retry-errors --flowId ${flowId} --errorId ${uniqueKey}`,
          });
        });
      } catch (targetErr) {
        console.error(`Error fetching errors for ${target.name}:`, targetErr);
      }
    }

    return res.json({
      connected: true,
      prodConnected: Boolean(targets.find(t => t.name === 'production')),
      sandboxConnected: Boolean(targets.find(t => t.name === 'sandbox')),
      count: allMappedErrors.length,
      totalCount: allMappedErrors.length,
      prodErrorCount,
      sandboxErrorCount,
      errors: allMappedErrors,
    });
  } catch (err: any) {
    console.error('Error fetching live Celigo errors:', err);
    return res.json({
      connected: false,
      error: err.message,
      errors: [],
      totalCount: 0,
    });
  }
});
