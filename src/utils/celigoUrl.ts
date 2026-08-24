/**
 * Utility for constructing and formatting valid Celigo integrator.io flow and integration URLs.
 * 
 * Standard format with sections:
 * https://integrator.io/integrations/:integrationId/flows/sections/:sectionId/flowBuilder/:flowId#build
 * 
 * Standard format without sections:
 * https://integrator.io/integrations/:integrationId/flowBuilder/:flowId#build
 */

export interface CeligoUrlParams {
  integrationId?: string | null;
  sectionId?: string | null;
  flowId?: string | null;
  id?: string | null;
  _id?: string | null;
  _integrationId?: string | null;
  _sectionId?: string | null;
  celigoUrl?: string | null;
  environment?: string | null;
  host?: string | null;
  [key: string]: any;
}

/**
 * Builds a valid Celigo integrator.io Flow Builder URL.
 * - When sections exist: https://integrator.io/integrations/{integrationId}/flows/sections/{sectionId}/flowBuilder/{flowId}#build
 * - When no sections: https://integrator.io/integrations/{integrationId}/flowBuilder/{flowId}#build
 */
export function buildCeligoFlowUrl(
  input?: CeligoUrlParams | string | null,
  fallbackFlowId?: string | null,
  fallbackIntegrationId?: string | null,
  fallbackSectionId?: string | null
): string {
  if (!input && !fallbackFlowId && !fallbackIntegrationId) {
    return 'https://integrator.io';
  }

  // If input is a raw URL string
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      let cleanedUrl = input;
      // Fix incorrectly generated /integrations/:id/flows/flowBuilder/:id -> /integrations/:id/flowBuilder/:id
      if (cleanedUrl.includes('/integrations/') && cleanedUrl.includes('/flows/flowBuilder/')) {
        cleanedUrl = cleanedUrl.replace('/flows/flowBuilder/', '/flowBuilder/');
      }

      // If it already matches the full flowBuilder pattern with #build, return the sanitized URL
      if (cleanedUrl.includes('/flowBuilder/') && cleanedUrl.includes('#build')) {
        return cleanedUrl;
      }
      
      // If it's an old legacy URL or partial URL, extract IDs and rewrite
      try {
        const url = new URL(cleanedUrl);
        const host = url.host || 'integrator.io';
        
        // Extract integrationId, sectionId, flowId using regex
        const intgMatch = cleanedUrl.match(/\/integrations\/([a-zA-Z0-9_-]+)/);
        const sectionMatch = cleanedUrl.match(/\/sections\/([a-zA-Z0-9_-]+)/);
        const flowBuilderMatch = cleanedUrl.match(/\/flowBuilder\/([a-zA-Z0-9_-]+)/);
        const flowsMatch = cleanedUrl.match(/\/flows\/([a-zA-Z0-9_-]+)/);

        const extractedIntg = intgMatch?.[1] || fallbackIntegrationId;
        const extractedSection = sectionMatch?.[1] || fallbackSectionId;
        const extractedFlow = flowBuilderMatch?.[1] || flowsMatch?.[1] || fallbackFlowId;

        if (extractedIntg && extractedSection && extractedFlow) {
          return `https://${host}/integrations/${extractedIntg}/flows/sections/${extractedSection}/flowBuilder/${extractedFlow}#build`;
        }
        if (extractedIntg && extractedFlow) {
          return `https://${host}/integrations/${extractedIntg}/flowBuilder/${extractedFlow}#build`;
        }
        if (extractedFlow) {
          return `https://${host}/flows/flowBuilder/${extractedFlow}#build`;
        }
        return cleanedUrl;
      } catch {
        return cleanedUrl;
      }
    }

    // Input was passed as a flowId string
    const flowId = input;
    const intgId = fallbackIntegrationId;
    const sectId = fallbackSectionId;

    if (intgId && sectId) {
      return `https://integrator.io/integrations/${intgId}/flows/sections/${sectId}/flowBuilder/${flowId}#build`;
    }
    if (intgId) {
      return `https://integrator.io/integrations/${intgId}/flowBuilder/${flowId}#build`;
    }
    return `https://integrator.io/flows/flowBuilder/${flowId}#build`;
  }

  const obj = input || {};
  const host = obj.host || (obj.environment === 'eu' || obj.environmentLabel?.includes('EU') ? 'eu.integrator.io' : 'integrator.io');

  const flowId = obj.flowId || obj.id || obj._id || fallbackFlowId || '';
  const integrationId = obj.integrationId || obj._integrationId || obj._integration_id || obj.integration?._id || fallbackIntegrationId || '';
  const sectionId = obj._flowGroupingId || obj._apiGroupingId || obj.sectionId || obj._sectionId || obj._section_id || obj.section || obj.sections?.[0]?._id || fallbackSectionId || '';

  // If object already has a precomputed celigoUrl
  if (obj.celigoUrl && typeof obj.celigoUrl === 'string') {
    let existingUrl = obj.celigoUrl;
    if (existingUrl.includes('/integrations/') && existingUrl.includes('/flows/flowBuilder/')) {
      existingUrl = existingUrl.replace('/flows/flowBuilder/', '/flowBuilder/');
    }
    if (existingUrl.includes('/flowBuilder/') && existingUrl.includes('#build')) {
      return existingUrl;
    }
  }

  // Construct according to precedence rules:
  if (integrationId && sectionId && flowId) {
    return `https://${host}/integrations/${integrationId}/flows/sections/${sectionId}/flowBuilder/${flowId}#build`;
  }

  if (integrationId && flowId) {
    return `https://${host}/integrations/${integrationId}/flowBuilder/${flowId}#build`;
  }

  if (flowId) {
    return `https://${host}/flows/flowBuilder/${flowId}#build`;
  }

  if (integrationId) {
    return `https://${host}/integrations/${integrationId}`;
  }

  return `https://${host}`;
}
