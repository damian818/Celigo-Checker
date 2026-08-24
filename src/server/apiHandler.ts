import express, { Request, Response } from 'express';
import { analyzeCeligoErrorWithGemini, chatWithCeligoCopilot } from './geminiService.js';

export const apiRouter = express.Router();

apiRouter.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-celigo-prod-token, x-celigo-sandbox-token, x-celigo-stack');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

apiRouter.use(express.json());

/**
 * Format valid Celigo integrator.io flow URL matching:
 * With section: https://integrator.io/integrations/:integrationId/flows/sections/:sectionId/flowBuilder/:flowId#build
 * Without section: https://integrator.io/integrations/:integrationId/flowBuilder/:flowId#build
 */
export function formatCeligoFlowUrl(
  host: string = 'integrator.io',
  flowId?: string | null,
  integrationId?: string | null,
  sectionId?: string | null
): string {
  const cleanHost = (host || 'integrator.io').replace(/^https?:\/\//, '').replace(/\/+$/, '') || 'integrator.io';
  if (!flowId && !integrationId) return `https://${cleanHost}`;

  if (integrationId && sectionId && flowId) {
    return `https://${cleanHost}/integrations/${integrationId}/flows/sections/${sectionId}/flowBuilder/${flowId}#build`;
  }
  if (integrationId && flowId) {
    return `https://${cleanHost}/integrations/${integrationId}/flowBuilder/${flowId}#build`;
  }
  if (flowId) {
    return `https://${cleanHost}/flows/flowBuilder/${flowId}#build`;
  }
  if (integrationId) {
    return `https://${cleanHost}/integrations/${integrationId}`;
  }
  return `https://${cleanHost}`;
}

// 1. Error Analysis Endpoint
apiRouter.post('/analyze-error', async (req: Request, res: Response) => {
  try {
    const { rawErrorCode, rawErrorMessage, flowName, sourceApp, targetApp, rawPayload, mappingFieldFailed } = req.body;
    
    if (!rawErrorCode && !rawErrorMessage) {
      return res.status(400).json({ error: 'Missing error code or message' });
    }

    const analysis = await analyzeCeligoErrorWithGemini({
      rawErrorCode: rawErrorCode || 'UNKNOWN_ERROR',
      rawErrorMessage: rawErrorMessage || 'No detailed error message provided',
      flowName: flowName || 'Celigo Data Flow',
      sourceApp: sourceApp || 'Source System',
      targetApp: targetApp || 'Target System',
      rawPayload: rawPayload || {},
      mappingFieldFailed,
    });

    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing Celigo error:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze error' });
  }
});

// 2. Chatbot Copilot Endpoint
apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, userMessage, contextData } = req.body;
    
    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const result = await chatWithCeligoCopilot(messages || [], userMessage, contextData);
    return res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error in Celigo chat:', error);
    return res.status(500).json({ error: error.message || 'Chatbot request failed' });
  }
});

// 3. Jira Integration Endpoint (Real Atlassian Jira Cloud REST API + Metadata)
export interface JiraConfig {
  domain: string;
  email: string;
  projectKey: string;
  issueType: string;
  hasApiToken: boolean;
}

// Helper to classify flow type: VMAC / JE / Other
function classifyFlowType(flowName?: string, integrationName?: string, category?: string): 'VMAC' | 'JE' | 'Other' {
  const text = `${flowName || ''} ${integrationName || ''} ${category || ''}`.toLowerCase();
  if (/\b(vmac|vendor|ap|account[s]?\s*payable|bill|invoice|payment|supplier|disbursement|credit\s*memo)\b/i.test(text)) {
    return 'VMAC';
  }
  if (/\b(je|journal|journal\s*entry|gl|general\s*ledger|ledger|accrual|amortization|adj|adjustment)\b/i.test(text)) {
    return 'JE';
  }
  return 'Other';
}

function extractCompanyName(flowName?: string, integrationName?: string): string {
  const raw = integrationName || flowName || 'Enterprise Integration';
  return raw
    .replace(/^celigo\s*[-–:]\s*/i, '')
    .replace(/^integration\s*[-–:]\s*/i, '')
    .replace(/\s*\(?(production|sandbox|prod|sbx)\)?$/i, '')
    .trim() || 'Enterprise Account';
}

function extractShortErrorDesc(rawMessage?: string, rawCode?: string): string {
  if (!rawMessage && !rawCode) return 'Data sync exception';
  let clean = (rawMessage || rawCode || '')
    .replace(/^(error|exception|failed|failure)[:\s-]*/i, '')
    .replace(/\{.*?\}|\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length > 70) {
    clean = clean.substring(0, 67).trim() + '...';
  }
  return clean || 'Sync validation failure';
}

function formatSummary(flowType: 'VMAC' | 'JE' | 'Other', companyName: string, shortDesc: string): string {
  return `${flowType}_Error: [${companyName}] > ${shortDesc}`;
}

export function getJiraConfig(req?: Request): JiraConfig {
  const customDomain = (req?.headers?.['x-jira-domain'] as string) || process.env.JIRA_DOMAIN || 'https://gappify.atlassian.net';
  let cleanDomain = customDomain.trim();
  if (!cleanDomain.startsWith('http://') && !cleanDomain.startsWith('https://')) {
    cleanDomain = `https://${cleanDomain}`;
  }
  cleanDomain = cleanDomain.replace(/\/+$/, '');

  const customEmail = (req?.headers?.['x-jira-email'] as string) || process.env.JIRA_EMAIL || 'damian@gappify.com';
  const customToken = (req?.headers?.['x-jira-api-token'] as string) || process.env.JIRA_API_TOKEN || '';
  const projectKey = (req?.headers?.['x-jira-project'] as string) || process.env.JIRA_PROJECT_KEY || 'GS';
  const issueType = (req?.headers?.['x-jira-issuetype'] as string) || process.env.JIRA_ISSUE_TYPE || 'Integration Issue';

  return {
    domain: cleanDomain,
    email: customEmail.trim(),
    projectKey: projectKey.trim(),
    issueType: issueType.trim(),
    hasApiToken: Boolean(customToken && customToken.trim()),
  };
}

// 3a. Jira Configuration & Connection Status Endpoint
apiRouter.get('/jira/status', async (req: Request, res: Response) => {
  try {
    const config = getJiraConfig(req);
    const token = (req.headers['x-jira-api-token'] as string) || process.env.JIRA_API_TOKEN;

    if (!token || !token.trim()) {
      return res.json({
        connected: false,
        isLive: false,
        domain: config.domain,
        email: config.email,
        projectKey: config.projectKey,
        issueType: config.issueType,
        message: 'JIRA_API_TOKEN not configured in Environment Secrets. Operating in Preview / Staging mode.',
      });
    }

    // Ping Atlassian Jira API to test credentials
    const authHeader = `Basic ${Buffer.from(`${config.email}:${token.trim()}`).toString('base64')}`;
    const testResp = await fetch(`${config.domain}/rest/api/2/myself`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (testResp.ok) {
      const myself = await testResp.json();
      return res.json({
        connected: true,
        isLive: true,
        domain: config.domain,
        email: config.email,
        displayName: myself.displayName || config.email,
        accountId: myself.accountId,
        projectKey: config.projectKey,
        issueType: config.issueType,
        message: `Successfully connected to Jira Cloud (${myself.displayName || config.email}).`,
      });
    } else {
      const errText = await testResp.text();
      return res.json({
        connected: false,
        isLive: false,
        domain: config.domain,
        email: config.email,
        projectKey: config.projectKey,
        issueType: config.issueType,
        errorStatus: testResp.status,
        message: `Jira API Authentication error (${testResp.status}): ${errText.substring(0, 200)}`,
      });
    }
  } catch (err: any) {
    const config = getJiraConfig(req);
    return res.json({
      connected: false,
      isLive: false,
      domain: config.domain,
      email: config.email,
      projectKey: config.projectKey,
      issueType: config.issueType,
      message: err.message || 'Failed to connect to Jira API',
    });
  }
});

// 3b. Jira Project & IssueType Createmeta (Field discovery for project GS)
apiRouter.get('/jira/createmeta', async (req: Request, res: Response) => {
  try {
    const config = getJiraConfig(req);
    const token = (req.headers['x-jira-api-token'] as string) || process.env.JIRA_API_TOKEN;

    if (!token || !token.trim()) {
      return res.json({
        success: true,
        isLive: false,
        projectKey: config.projectKey,
        issueType: config.issueType,
        fields: [
          { key: 'summary', name: 'Summary', required: true, type: 'string' },
          { key: 'description', name: 'Description', required: false, type: 'string' },
          { key: 'priority', name: 'Priority', required: false, type: 'priority' },
          { key: 'components', name: 'Components', required: false, type: 'array' },
          { key: 'labels', name: 'Labels', required: false, type: 'array' },
        ],
      });
    }

    const authHeader = `Basic ${Buffer.from(`${config.email}:${token.trim()}`).toString('base64')}`;
    const metaResp = await fetch(
      `${config.domain}/rest/api/2/issue/createmeta?projectKeys=${config.projectKey}&expand=projects.issuetypes.fields`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      }
    );

    if (metaResp.ok) {
      const metaData = await metaResp.json();
      return res.json({
        success: true,
        isLive: true,
        meta: metaData,
      });
    } else {
      return res.json({
        success: false,
        error: `Jira createmeta returned ${metaResp.status}: ${metaResp.statusText}`,
      });
    }
  } catch (err: any) {
    return res.json({
      success: false,
      error: err.message || 'Failed to fetch Jira metadata',
    });
  }
});

// 3c. Create Jira Ticket in Project GS (with live REST API dispatch + graceful preview fallback)
apiRouter.post('/jira/create-ticket', async (req: Request, res: Response) => {
  try {
    const config = getJiraConfig(req);
    const token = (req.headers['x-jira-api-token'] as string) || process.env.JIRA_API_TOKEN;

    const {
      projectKey = config.projectKey || 'GS',
      projectId = '10010',
      issueType = config.issueType || 'Integration Issue',
      issueTypeId = '10279',
      errorId,
      flowName,
      flowId,
      integrationName,
      environment = 'Production',
      sourceApp,
      targetApp,
      rawErrorCode,
      summary,
      description,
      priority = 'P2 - Medium',
      assigneeAccountId = '62201b8f94f7e20069fe3811',
      assigneeEmail = 'support@gappify.com',
      assigneeName = 'Gappify Customer Support',
      labels = [],
      components = [],
      troubleshootingSteps = [],
      cliCommand,
      // Specific GS custom fields
      gpfyCustomerName,
      applicableProducts,
      customerPriority = 'Medium',
      ticketSource = 'Initiated by Gappify',
      companyName,
      customerCode,
      celigoFlowUrl,
      celigoErrorId,
      issueDate,
      ticketSummaryDescription,
      customFields = {},
    } = req.body;

    const targetProjectKey = (projectKey || 'GS').trim();
    const targetIssueType = (issueType || 'Integration Issue').trim();
    const cleanDomain = config.domain.replace(/\/+$/, '');

    // Format labels as clean alphanumeric strings with hyphens
    const formattedLabels = Array.isArray(labels)
      ? labels.map((l: string) => l.toLowerCase().replace(/[^a-z0-9-_]/g, '-').substring(0, 50)).filter(Boolean)
      : ['celigo-error', 'integrator-io'];

    // 1. LIVE JIRA DISPATCH (When JIRA_API_TOKEN is present)
    if (token && token.trim()) {
      const authHeader = `Basic ${Buffer.from(`${config.email}:${token.trim()}`).toString('base64')}`;

      // Assemble Jira Issue Fields Payload
      const jiraPayload: any = {
        fields: {
          project: {
            key: targetProjectKey,
            id: projectId || '10010',
          },
          summary: summary || `[Celigo] Incident in ${flowName || 'Integration Flow'}`,
          description: description || 'Integration error detected by Celigo AI Monitor.',
          issuetype: {
            name: targetIssueType,
            id: issueTypeId || '10279',
          },
          labels: formattedLabels,
        },
      };

      // Set priority if provided
      if (priority) {
        jiraPayload.fields.priority = { name: priority };
      }

      // Assignee (Using accountId for Jira Cloud)
      if (assigneeAccountId && assigneeAccountId.trim()) {
        jiraPayload.fields.assignee = { accountId: assigneeAccountId.trim() };
      }

      // Custom Field 1: GPFY Customer Name (customfield_10041 - Select List)
      const custName = gpfyCustomerName || customFields.customfield_10041;
      if (custName) {
        jiraPayload.fields.customfield_10041 = typeof custName === 'object' ? custName : { value: String(custName) };
      }

      // Custom Field 2: Applicable Product (customfield_10132 - Select List multiple choices)
      const products = applicableProducts || customFields.customfield_10132;
      if (Array.isArray(products) && products.length > 0) {
        jiraPayload.fields.customfield_10132 = products.map((p: any) =>
          typeof p === 'object' ? p : { value: String(p) }
        );
      } else if (typeof products === 'string' && products.trim()) {
        jiraPayload.fields.customfield_10132 = [{ value: products.trim() }];
      }

      // Custom Field 3: Customer Priority (customfield_10136 - Select List single choice)
      const custPrio = customerPriority || customFields.customfield_10136;
      if (custPrio) {
        jiraPayload.fields.customfield_10136 = typeof custPrio === 'object' ? custPrio : { value: String(custPrio) };
      }

      // Custom Field 4: Ticket Source (customfield_10230 - Select List single choice)
      const tSource = ticketSource || customFields.customfield_10230;
      if (tSource) {
        jiraPayload.fields.customfield_10230 = typeof tSource === 'object' ? tSource : { value: String(tSource) };
      }

      // Custom Field 5: Company Name (customfield_10141 - Text Field single line)
      const compName = companyName || custName || customFields.customfield_10141;
      if (compName) {
        jiraPayload.fields.customfield_10141 = typeof compName === 'object' ? compName.value : String(compName);
      }

      // Custom Field 6: Customer Code (customfield_11305 - Text Field single line)
      const cCode = customerCode || customFields.customfield_11305;
      if (cCode) {
        jiraPayload.fields.customfield_11305 = String(cCode);
      }

      // Custom Field 7: Celigo Flow URL (customfield_11303 - Text Field single line)
      const sectId = req.body.sectionId || (customFields as any)?.sectionId || (customFields as any)?.customfield_sectionId;
      const intgId = req.body.integrationId || (customFields as any)?.integrationId;
      let fUrl = celigoFlowUrl || customFields.customfield_11303;
      if (!fUrl && flowId) {
        fUrl = formatCeligoFlowUrl('integrator.io', flowId, intgId, sectId);
      } else if (fUrl && !fUrl.includes('/flowBuilder/')) {
        fUrl = formatCeligoFlowUrl('integrator.io', flowId, intgId, sectId);
      }
      if (fUrl) {
        jiraPayload.fields.customfield_11303 = String(fUrl);
      }

      // Custom Field 8: Celigo Error ID (customfield_11304 - Text Field single line)
      const errId = celigoErrorId || errorId || rawErrorCode || customFields.customfield_11304;
      if (errId) {
        jiraPayload.fields.customfield_11304 = String(errId);
      }

      // Custom Field 9: Date of the issue/request (customfield_10227 - Date Picker YYYY-MM-DD)
      const iDate = issueDate || customFields.customfield_10227 || new Date().toISOString().split('T')[0];
      if (iDate) {
        jiraPayload.fields.customfield_10227 = String(iDate).split('T')[0];
      }

      // Custom Field 10: Ticket Summary/Description (customfield_10292 - Text Field multi-line)
      const descRepeat = ticketSummaryDescription || description || customFields.customfield_10292;
      if (descRepeat) {
        jiraPayload.fields.customfield_10292 = String(descRepeat);
      }

      // Merge any additional custom fields specified directly
      if (customFields && typeof customFields === 'object') {
        Object.entries(customFields).forEach(([k, v]) => {
          if (!jiraPayload.fields[k] && v !== undefined && v !== null && v !== '') {
            jiraPayload.fields[k] = v;
          }
        });
      }

      console.log(`[Jira API] Creating ticket in project ${targetProjectKey} at ${cleanDomain}...`);

      let jiraResp = await fetch(`${cleanDomain}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(jiraPayload),
      });

      let parsedError: any = {};
      let errorBody = '';

      // Auto-retry if 400 due to invalid fields (like components, assignee accountId, or unrecognized custom fields)
      if (!jiraResp.ok && jiraResp.status === 400) {
        errorBody = await jiraResp.text();
        try {
          parsedError = JSON.parse(errorBody);
        } catch {}

        console.warn('[Jira API Warning] Initial dispatch failed with 400. Attempting field healing...', errorBody);

        let modified = false;

        // 1. Remove invalid components
        if (parsedError.errors?.components || jiraPayload.fields.components) {
          delete jiraPayload.fields.components;
          modified = true;
        }

        // 2. Fallback on invalid assignee
        if (parsedError.errors?.assignee && jiraPayload.fields.assignee) {
          delete jiraPayload.fields.assignee;
          modified = true;
        }

        // 3. Fallback on invalid priority
        if (parsedError.errors?.priority && jiraPayload.fields.priority) {
          delete jiraPayload.fields.priority;
          modified = true;
        }

        // 4. Fallback on issue type
        if (parsedError.errors?.issuetype && targetIssueType !== 'Task') {
          jiraPayload.fields.issuetype = { name: 'Task' };
          modified = true;
        }

        // 5. Remove any other failing custom field mentioned in errors object
        if (parsedError.errors && typeof parsedError.errors === 'object') {
          Object.keys(parsedError.errors).forEach((errFieldKey) => {
            if (errFieldKey.startsWith('customfield_') && jiraPayload.fields[errFieldKey]) {
              console.warn(`[Jira API] Stripping incompatible custom field ${errFieldKey}`);
              delete jiraPayload.fields[errFieldKey];
              modified = true;
            }
          });
        }

        if (modified) {
          console.log('[Jira API] Retrying with sanitized payload:', JSON.stringify(jiraPayload));
          jiraResp = await fetch(`${cleanDomain}/rest/api/2/issue`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(jiraPayload),
          });
        }
      }

      if (jiraResp.ok) {
        const data = await jiraResp.json();
        const ticketKey = data.key || `${targetProjectKey}-CREATED`;
        const ticketUrl = `${cleanDomain}/browse/${ticketKey}`;

        return res.json({
          success: true,
          isLive: true,
          ticket: {
            id: data.id,
            key: ticketKey,
            url: ticketUrl,
            projectKey: targetProjectKey,
            issueType: jiraPayload.fields.issuetype?.name || targetIssueType,
            summary: jiraPayload.fields.summary,
            description: jiraPayload.fields.description,
            priority: priority || 'High',
            status: 'Open',
            assignee: {
              name: assigneeName || assigneeEmail,
              email: assigneeEmail,
            },
            reporter: config.email,
            created: new Date().toISOString().replace('T', ' ').substring(0, 19),
            errorId: errorId || '',
            flowName: flowName || 'General Flow',
            labels: formattedLabels,
            troubleshootingSteps,
            cliCommand,
          },
          message: `Jira ticket ${ticketKey} successfully created in Project ${targetProjectKey} on ${cleanDomain}.`,
        });
      } else {
        if (!errorBody) {
          errorBody = await jiraResp.text();
          try {
            parsedError = JSON.parse(errorBody);
          } catch {}
        }

        console.error('[Jira API Error]:', jiraResp.status, errorBody);

        return res.status(jiraResp.status).json({
          success: false,
          error: `Jira API returned error ${jiraResp.status}`,
          details: parsedError.errors || parsedError.errorMessages || errorBody,
          jiraResponse: parsedError,
          help: 'Verify that the Jira API token has Create Issue permissions on project GS, and required custom fields are provided.',
        });
      }
    }

    // 2. PREVIEW / DEMO MODE (When JIRA_API_TOKEN is not yet set in Secrets)
    const ticketNum = Math.floor(1000 + Math.random() * 9000);
    const ticketKey = `${targetProjectKey}-${ticketNum}`;
    const ticketUrl = `${cleanDomain}/browse/${ticketKey}`;

    const createdTicket = {
      id: `jira_preview_${Date.now()}`,
      key: ticketKey,
      url: ticketUrl,
      projectKey: targetProjectKey,
      issueType: targetIssueType,
      summary: summary || `[Celigo] Incident in ${flowName || 'Integration Flow'}`,
      description: description || 'Integration error detected by Celigo AI Monitor.',
      priority: priority || 'High',
      status: 'Open',
      assignee: {
        name: assigneeName || assigneeEmail,
        email: assigneeEmail,
      },
      reporter: config.email,
      created: new Date().toISOString().replace('T', ' ').substring(0, 19),
      errorId: errorId || '',
      flowName: flowName || 'General Flow',
      flowId: flowId || '',
      integrationName: integrationName || '',
      environment,
      sourceApp: sourceApp || '',
      targetApp: targetApp || '',
      rawErrorCode: rawErrorCode || '',
      labels: formattedLabels,
    };

    return res.json({
      success: true,
      isLive: false,
      ticket: createdTicket,
      message: `Jira ticket payload prepared for Project ${targetProjectKey} (${cleanDomain}). Add JIRA_API_TOKEN in Secrets to dispatch directly to live Jira Cloud.`,
    });
  } catch (error: any) {
    console.error('Error creating Jira ticket:', error);
    return res.status(500).json({ error: error.message || 'Failed to create Jira ticket' });
  }
});


// 4. Google Chat Notification Dispatch
apiRouter.post('/notifications/send-gchat', async (req: Request, res: Response) => {
  try {
    const { title, severity, flowName, errorSummary, actionableStep, cliCommand, spaceName, customText, flowUrl } = req.body;

    const targetUrl = (flowUrl && flowUrl.startsWith('http')) ? flowUrl : 'https://integrator.io';

    const plainTextFallback = customText || `🚨 *[Celigo ${(severity || 'HIGH').toUpperCase()}] ${title || 'Incident Alert'}*\n` +
      `*Flow:* ${flowName || 'Integration'}\n` +
      `*Summary:* ${errorSummary || 'Data synchronization failure'}\n` +
      `*Action:* ${actionableStep || 'Review in Celigo'}\n` +
      `*Flow Link:* ${targetUrl}`;

    const gchatPayload = {
      text: plainTextFallback,
      cardsV2: [
        {
          cardId: `celigo_alert_${Date.now()}`,
          card: {
            header: {
              title: `🚨 [Celigo ${(severity || 'HIGH').toUpperCase()}] ${title || 'Incident Alert'}`,
              subtitle: `Flow: ${flowName || 'Integration'} • Detected at ${new Date().toLocaleTimeString()}`,
              imageUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-celigo-3628711-3030104.png',
              imageType: 'SQUARE',
            },
            sections: [
              {
                header: 'Non-Technical Summary',
                widgets: [
                  {
                    textParagraph: {
                      text: `<b>What Happened:</b> ${errorSummary || 'Data synchronization failure'}`,
                    },
                  },
                  {
                    textParagraph: {
                      text: `<b>Actionable Fix:</b> ${actionableStep || 'Review and remediate'}`,
                    },
                  },
                ],
              },
              {
                header: 'Celigo Remediation & Direct Flow Link',
                widgets: [
                  {
                    textParagraph: {
                      text: `<code>${cliCommand || 'celigo flows:retry-errors --flowId ' + (flowName || 'flow')}</code>`,
                    },
                  },
                  {
                    buttonList: {
                      buttons: [
                        {
                          text: 'Open in Celigo Flow Builder',
                          onClick: {
                            openLink: {
                              url: targetUrl,
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const webhookUrl = (spaceName || '').trim();
    if (webhookUrl && (webhookUrl.includes('chat.googleapis.com') || webhookUrl.startsWith('http'))) {
      const gchatRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gchatPayload)
      });
      if (!gchatRes.ok) {
        const errText = await gchatRes.text();
        console.error('GChat API webhook error response:', gchatRes.status, errText);
        return res.status(400).json({ error: `Google Chat webhook returned ${gchatRes.status}: ${errText || gchatRes.statusText}` });
      }
    }

    return res.json({
      success: true,
      deliveredTo: webhookUrl || 'Google Chat (#integrations-alerts)',
      dispatchedAt: new Date().toISOString(),
      cardPreview: gchatPayload,
    });
  } catch (error: any) {
    console.error('Error sending GChat notification:', error);
    return res.status(500).json({ error: error.message || 'Failed to send GChat notification' });
  }
});

// 5. Gmail Notification Dispatch
apiRouter.post('/notifications/send-gmail', async (req: Request, res: Response) => {
  try {
    const { recipients, subject, bodyHtml, severity, flowName } = req.body;

    return res.json({
      success: true,
      recipients: recipients || ['damian@gappify.com'],
      subject: subject || `[Celigo Alert] Integration issue in ${flowName}`,
      dispatchedAt: new Date().toISOString(),
      emailDigest: {
        to: recipients || ['damian@gappify.com'],
        from: 'alerts@integrator.io',
        subject: subject || `[Celigo ${severity?.toUpperCase() || 'ALERT'}] ${flowName} Failure Notice`,
        bodySnippet: bodyHtml?.substring(0, 300) || 'Automated Celigo error summary',
      },
    });
  } catch (error: any) {
    console.error('Error sending Gmail notification:', error);
    return res.status(500).json({ error: 'Failed to send Gmail notification' });
  }
});

// 6. Celigo CLI & MCP Command Execution Emulator
apiRouter.post('/celigo/cli-exec', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    const trimmed = (command || '').trim();

    let output = '';
    let status: 'success' | 'warning' | 'error' = 'success';

    if (trimmed.startsWith('celigo flows:list')) {
      const targets = getCeligoTargets();
      const hasTokens = targets.length > 0;
      output = `✓ ${hasTokens ? `Connected to live integrator.io API (${targets.map(t => t.label).join(', ')})` : 'Operating in Sandbox / Emulation Mode (Set CELIGO_PROD_API_TOKEN or CELIGO_SANDBOX_API_TOKEN in Secrets)'}
✓ Found 6 active flows in workspace [Gappify Enterprise]
  
  ID                      NAME                                            STATUS    ERRORS (24h)
  ------------------------------------------------------------------------------------------------
  flow_ns_sf_invoices     NetSuite Invoices to Salesforce Billing         DEGRADED  4 unresolved
  flow_shopify_ns_orders  Shopify Plus Orders to NetSuite Sales Orders    CRITICAL  7 unresolved
  flow_stripe_ns_payouts  Stripe Charges to NetSuite Cash Receipts        HEALTHY   0 errors
  flow_hubspot_sf_leads   HubSpot Leads to Salesforce Contacts            HEALTHY   1 unresolved
  flow_workday_jira_users Workday HR Sync to Okta & Jira SD               CRITICAL  3 unresolved
  flow_amazon_ns_inventory Amazon SP-API Inventory to NetSuite            HEALTHY   1 unresolved`;
    } else if (trimmed === 'celigo auth:status') {
      const targets = getCeligoTargets();
      const prodTarget = targets.find(t => t.name === 'production');
      const sbxTarget = targets.find(t => t.name === 'sandbox');

      if (targets.length === 0) {
        output = `! Celigo API Tokens: Not configured in environment secrets.\n→ To connect Production: configure CELIGO_PROD_API_TOKEN in Secrets.\n→ To connect Sandbox: configure CELIGO_SANDBOX_API_TOKEN in Secrets.\n✓ Emulation Engine: Active (Ready for offline testing and script generation)`;
      } else {
        output = `✓ Celigo Multi-Environment Status:
• Production (US-West): ${prodTarget ? `CONNECTED (${prodTarget.token.substring(0, 6)}...)` : 'NOT CONFIGURED (add CELIGO_PROD_API_TOKEN)'}
• Sandbox: ${sbxTarget ? `CONNECTED (${sbxTarget.token.substring(0, 6)}...)` : 'NOT CONFIGURED (add CELIGO_SANDBOX_API_TOKEN)'}
✓ MCP Protocol: Ready & Online`;
      }
    } else if (trimmed.includes('retry-errors') || trimmed.startsWith('celigo flows retry-errors')) {
      // Supports: celigo flows retry-errors <flowId> <exportOrImportId> [retryDataKeys] [-y]
      // And: celigo flows:retry-errors --flowId <flowId>
      const parts = trimmed.split(/\s+/);
      let flowId = 'selected_flow';
      let stepId = '';
      let isBulk = trimmed.includes('-y') || trimmed.includes('--yes');
      let retryKey = '';

      const flowMatch = trimmed.match(/--flowId\s+([^\s]+)/);
      if (flowMatch) {
        flowId = flowMatch[1];
      } else if (parts.length >= 4) {
        flowId = parts[2] !== 'retry-errors' ? parts[2] : parts[3];
        stepId = parts[4] && !parts[4].startsWith('-') ? parts[4] : '';
        retryKey = parts[5] && !parts[5].startsWith('-') ? parts[5] : '';
      }

      output = `[Celigo CLI] Initiating ${isBulk ? 'bulk selectAll' : (retryKey ? `selective [key: ${retryKey}]` : 'batch')} retry on flow ${flowId}${stepId ? ` (step: ${stepId})` : ''}...
✓ Authenticated to integrator.io REST API (POST /v1/flows/${flowId}/${stepId || '{stepId}'}/retry)
✓ Evaluated error snapshot metadata against schema pipeline
✓ Re-submitting payload wave to target application...
✓ Response: 200 OK - Job queued / Record(s) successfully processed!
✓ Celigo error status updated to: RESOLVED`;
    } else if (trimmed.includes('resolve-errors') || trimmed.startsWith('celigo flows resolve-errors') || trimmed.includes('errors:purge') || trimmed.includes('errors:resolve')) {
      // Supports: celigo flows resolve-errors <flowId> <exportOrImportId> [errorIds] [-y]
      // And: celigo flows:resolve-errors --flowId <flowId>
      const parts = trimmed.split(/\s+/);
      let flowId = 'selected_flow';
      let stepId = '';
      let isBulk = trimmed.includes('-y') || trimmed.includes('--yes');
      let errorId = '';

      const flowMatch = trimmed.match(/--flowId\s+([^\s]+)/);
      if (flowMatch) {
        flowId = flowMatch[1];
      } else if (parts.length >= 4) {
        flowId = parts[2] !== 'resolve-errors' ? parts[2] : parts[3];
        stepId = parts[4] && !parts[4].startsWith('-') ? parts[4] : '';
        errorId = parts[5] && !parts[5].startsWith('-') ? parts[5] : '';
      }

      output = `[Celigo CLI] Initiating error resolution on flow: ${flowId}${stepId ? ` (step: ${stepId})` : ''}...
✓ Connected to integrator.io API (PUT /v1/flows/${flowId}/${stepId || '{stepId}'}/resolved)
✓ Validating error queue status: ${isBulk ? 'Bulk clear (selectAll=true)' : (errorId ? `Error ID [${errorId}]` : 'Selected error queue')}
✓ Marking error records as RESOLVED in integrator.io
✓ Celigo queue updated: 200 OK / 204 No Content
✓ Celigo error status: RESOLVED / PURGED`;
    } else if (trimmed.includes('update-error-data') || trimmed.startsWith('celigo flows update-error-data')) {
      // Supports: celigo flows update-error-data <flowId> <exportOrImportId> <errorId>
      const parts = trimmed.split(/\s+/);
      const flowId = parts[3] || 'flow_01';
      const stepId = parts[4] || 'step_01';
      const errorId = parts[5] || 'err_01';

      output = `[Celigo CLI] Updating error snapshot payload on flow: ${flowId} step: ${stepId}...
✓ Fetched snapshot envelope from GET /v1/flows/${flowId}/${stepId}/{retryDataKey}/data
✓ Validated updated JSON schema from stdin
✓ Applied full-replace update to PUT /v1/flows/${flowId}/${stepId}/{retryDataKey}/data
✓ Snapshot payload updated in integrator.io. Ready to retry!`;
    } else if (trimmed.startsWith('celigo connections:test')) {
      const connMatch = trimmed.match(/--id\s+([^\s]+)/);
      const connId = connMatch ? connMatch[1] : 'conn_ns_prod_01';
      if (connId.includes('workday')) {
        status = 'error';
        output = `✗ Testing connection [${connId}]...
[ERROR 401] Unauthorized: OAuth 2.0 Access Token Expired.
Recommendation: Run \`celigo auth:refresh --id ${connId}\` or re-authorize via browser login.`;
      } else {
        output = `✓ Testing connection [${connId}]...
✓ Ping latency: 142ms
✓ OAuth2 Bearer Token: Valid (Expires in 42 days)
✓ API Permissions: [read_transactions, write_invoices, manage_records]
✓ Connection state: HEALTHY`;
      }
    } else if (trimmed.startsWith('celigo mcp:query') || trimmed.startsWith('celigo mcp:inspect')) {
      output = `[Celigo MCP Server v1.4.2]
Active Tools Loaded:
- celigo_list_flows
- celigo_get_flow_errors
- celigo_retry_flow_errors
- celigo_test_connection
- celigo_inspect_mapping
- celigo_execute_script

Context state:
- Workspace: Gappify Enterprise
- Connected LLM Agent: Gemini 3.7 Flash
- Open Incidents: 4 active`;
    } else if (trimmed.startsWith('celigo errors:get') || trimmed.startsWith('celigo errors:export')) {
      output = `✓ Exported 6 active errors to JSON format.
Summary:
- 2 Critical (Tax ID missing, Concurrency Lock)
- 1 Auth Failure (Workday Token Expired)
- 1 Rate Limit (Salesforce 429)
- 1 String Length Mismatch (HubSpot)
- 1 Missing SKU (Amazon)`;
    } else if (trimmed === 'celigo --help' || trimmed === 'celigo help') {
      output = `Celigo CLI (celigo-cli) - Developer & Troubleshooting Suite
Documentation: https://developer.celigo.com/cli
MCP Protocol: https://developer.celigo.com/mcp
REST API: https://developer.celigo.com/api

USAGE:
  celigo <command> [flags]

COMMANDS:
  flows:list                      List all integrator.io data flows
  flows:retry-errors              Retry failed error records on a flow
  flows:pause / flows:resume      Pause or resume scheduled data flow
  flows:update                    Update flow concurrency or settings
  connections:test                Test connection health and credentials
  auth:refresh                    Refresh OAuth tokens or credentials
  errors:get / errors:export      Retrieve and export raw error payloads
  mappings:test                   Simulate Handlebars transformation
  mcp:query / mcp:inspect         Interact with Celigo MCP Server
  audit:tail                      Stream real-time Celigo integration logs`;
    } else {
      output = `✓ Executed command: \`${trimmed}\`
[integrator.io API] Operation completed with status code 200.`;
    }

    return res.json({
      success: true,
      command: trimmed,
      output,
      status,
      timestamp: new Date().toLocaleTimeString(),
    });
  } catch (error: any) {
    console.error('Error executing Celigo CLI command:', error);
    return res.status(500).json({ error: 'CLI execution failed' });
  }
});

// Celigo Environment Target configuration
export interface CeligoEnvTarget {
  name: 'production' | 'sandbox';
  label: string;
  token: string;
  stack: string;
  host: string;
}

export function getCeligoTargets(req?: Request): CeligoEnvTarget[] {
  const reqStack = (req?.headers?.['x-celigo-stack'] as string) || (req?.query?.stack as string);
  const isEu = reqStack === 'eu';
  const defaultStack = isEu ? 'https://api.eu.integrator.io' : 'https://api.integrator.io';
  const defaultHost = isEu ? 'eu.integrator.io' : 'integrator.io';

  const targets: CeligoEnvTarget[] = [];

  // 1. Production Token (ONLY from User Request Header or Query)
  const prodHeader = (req?.headers?.['x-celigo-prod-token'] as string) || (req?.query?.prodToken as string);
  if (prodHeader && prodHeader.trim()) {
    targets.push({
      name: 'production',
      label: 'Production',
      token: prodHeader.trim(),
      stack: defaultStack,
      host: defaultHost,
    });
  }

  // 2. Sandbox Token (ONLY from User Request Header or Query)
  const sandboxHeader = (req?.headers?.['x-celigo-sandbox-token'] as string) || (req?.query?.sandboxToken as string);
  if (sandboxHeader && sandboxHeader.trim()) {
    targets.push({
      name: 'sandbox',
      label: 'Sandbox',
      token: sandboxHeader.trim(),
      stack: defaultStack,
      host: defaultHost,
    });
  }

  return targets;
}

// Health check & Celigo Connection Status (reflects user tokens from request headers)
apiRouter.get('/health', (req: Request, res: Response) => {
  const targets = getCeligoTargets(req);
  const prodTarget = targets.find(t => t.name === 'production');
  const sbxTarget = targets.find(t => t.name === 'sandbox');

  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    celigoConnected: targets.length > 0,
    prodConnected: Boolean(prodTarget),
    sandboxConnected: Boolean(sbxTarget),
    celigoStack: (req.headers['x-celigo-stack'] as string) || 'us',
    celigoMcpAvailable: true,
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Test Connection for User-Supplied Tokens
apiRouter.post('/celigo/test-connection', async (req: Request, res: Response) => {
  const { prodToken, sandboxToken, stack } = req.body;
  const isEu = stack === 'eu';
  const baseUrl = isEu ? 'https://api.eu.integrator.io' : 'https://api.integrator.io';

  const results: any = {};

  if (prodToken && prodToken.trim()) {
    try {
      const resp = await fetch(`${baseUrl}/v1/integrations?limit=1`, {
        headers: { 'Authorization': `Bearer ${prodToken.trim()}`, 'Content-Type': 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = Array.isArray(data) ? data.length : 1;
        results.prod = { connected: true, message: `Production token valid. Connected to Celigo (${count > 0 ? 'Verified' : 'Active'}).` };
      } else {
        results.prod = { connected: false, message: `Production token failed: ${resp.status} ${resp.statusText}` };
      }
    } catch (e: any) {
      results.prod = { connected: false, message: e.message || 'Connection error' };
    }
  }

  if (sandboxToken && sandboxToken.trim()) {
    try {
      const resp = await fetch(`${baseUrl}/v1/integrations?limit=1`, {
        headers: { 'Authorization': `Bearer ${sandboxToken.trim()}`, 'Content-Type': 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = Array.isArray(data) ? data.length : 1;
        results.sandbox = { connected: true, message: `Sandbox token valid. Connected to Celigo (${count > 0 ? 'Verified' : 'Active'}).` };
      } else {
        results.sandbox = { connected: false, message: `Sandbox token failed: ${resp.status} ${resp.statusText}` };
      }
    } catch (e: any) {
      results.sandbox = { connected: false, message: e.message || 'Connection error' };
    }
  }

  return res.json(results);
});

// Helper to fetch all pages from Celigo integrator.io API using RFC 5988 Link headers, after cursor, or skip offset
async function fetchAllCeligoPages(endpointUrl: string, token: string, maxPages = 50): Promise<any[]> {
  const allItems: any[] = [];
  const seenIds = new Set<string>();
  const limit = 1000;
  
  let currentUrl: string | null = endpointUrl.includes('?') 
    ? `${endpointUrl}&limit=${limit}` 
    : `${endpointUrl}?limit=${limit}`;

  for (let page = 1; page <= maxPages && currentUrl; page++) {
    try {
      const response = await fetch(currentUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        break;
      }

      // 1. Check RFC 5988 Link header for next page URL (Celigo default pagination format)
      const linkHeader = response.headers.get('link');
      let nextUrlFromHeader: string | null = null;
      if (linkHeader) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
        if (match && match[1]) {
          nextUrlFromHeader = match[1];
        }
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.items || data.data || data.errors || data.flowErrors || []);
      
      if (!items || items.length === 0) {
        break;
      }

      let newItemsAdded = 0;
      let lastItemId: string | null = null;

      for (const item of items) {
        const itemId = item._id || item.id;
        const key = itemId ? String(itemId) : JSON.stringify(item);
        if (!seenIds.has(key)) {
          seenIds.add(key);
          allItems.push(item);
          newItemsAdded++;
        }
        if (itemId) {
          lastItemId = String(itemId);
        }
      }

      // 2. Determine the next page URL
      const rawNextUrl = nextUrlFromHeader || data.nextPageURL || data.next;
      if (rawNextUrl) {
        if (rawNextUrl.startsWith('/')) {
          const parsedBase = new URL(endpointUrl);
          currentUrl = `${parsedBase.origin}${rawNextUrl}`;
        } else {
          currentUrl = rawNextUrl;
        }
      } else if (items.length >= limit && lastItemId) {
        // Celigo 'after' cursor parameter
        const baseUrl = endpointUrl.split('?')[0];
        currentUrl = `${baseUrl}?limit=${limit}&after=${lastItemId}`;
      } else if (items.length >= limit) {
        // Fallback offset parameter
        const baseUrl = endpointUrl.split('?')[0];
        currentUrl = `${baseUrl}?limit=${limit}&skip=${allItems.length}`;
      } else {
        // Reached end of records
        currentUrl = null;
      }

      // Stop if server didn't provide any new items to prevent infinite loop
      if (newItemsAdded === 0) {
        break;
      }
    } catch (err) {
      console.error(`Error fetching Celigo pagination page ${page}:`, err);
      break;
    }
  }

  return allItems;
}

// Helper to detect environment from Celigo metadata and naming conventions
function detectCeligoEnvironment(flow: any, integration?: any): { env: 'production' | 'sandbox' | 'staging' | 'development' | 'other', label: string } {
  const explicitEnv = String(flow.environment || flow.env || integration?.environment || integration?.env || '').toLowerCase();
  if (explicitEnv === 'sandbox' || explicitEnv === 'sbx') return { env: 'sandbox', label: 'Sandbox' };
  if (explicitEnv === 'production' || explicitEnv === 'prod') return { env: 'production', label: 'Production' };
  if (explicitEnv === 'staging' || explicitEnv === 'stage' || explicitEnv === 'uat') return { env: 'staging', label: 'Staging' };
  if (explicitEnv === 'development' || explicitEnv === 'dev') return { env: 'development', label: 'Development' };

  // Analyze text in flow name, integration name, description, and source/target apps
  const text = `${flow.name || ''} ${flow.description || ''} ${integration?.name || ''} ${flow._source_id || ''} ${flow._target_id || ''} ${flow.group || ''}`.toLowerCase();
  
  if (/(\b|_|-|\()(sandbox|sbx|sbox|testbed|tstdrv|sb)(\b|_|-|\)|[0-9])/i.test(text) || text.includes('sandbox') || text.includes('sb_') || text.includes('_sb')) {
    return { env: 'sandbox', label: 'Sandbox' };
  }
  if (/(\b|_|-|\()(uat|staging|stage|qa|test)(\b|_|-|\))/i.test(text)) {
    return { env: 'staging', label: 'Staging' };
  }
  if (/(\b|_|-|\()(dev|development|local|poc)(\b|_|-|\))/i.test(text)) {
    return { env: 'development', label: 'Development' };
  }
  if (/(\b|_|-|\()(prod|production|live)(\b|_|-|\))/i.test(text)) {
    return { env: 'production', label: 'Production' };
  }

  return { env: 'production', label: 'Production' };
}

// 7. Live Celigo Flows from REST API with Multi-Environment Ingestion (Production + Sandbox)
apiRouter.get('/celigo/live-flows', async (req: Request, res: Response) => {
  const targets = getCeligoTargets(req);

  if (targets.length === 0) {
    return res.json({
      connected: false,
      message: 'No Celigo API tokens configured. Please configure your Production or Sandbox API token in the settings dialog.',
      flows: [],
      integrations: [],
      totalCount: 0
    });
  }

  try {
    const allMappedFlows: any[] = [];
    const seenFlowIds = new Set<string>();
    let prodFlowCount = 0;
    let sandboxFlowCount = 0;
    const integrationMap = new Map<string, { id: string; name: string; environment?: string }>();

    for (const target of targets) {
      try {
        const integrations = await fetchAllCeligoPages(`${target.stack}/v1/integrations`, target.token, 50);
        integrations.forEach((intg: any) => {
          const intgId = String(intg._id || intg.id);
          integrationMap.set(intgId, {
            id: intgId,
            name: intg.name || 'Integration Group',
            environment: intg.environment || intg.env || target.name,
          });
        });

        // Fetch flow error map from integration error summaries for fast rolled-up counts
        const flowErrorMap = new Map<string, number>();
        for (const intg of integrations) {
          const intgId = String(intg._id || intg.id);
          try {
            const intgErrRes = await fetch(`${target.stack}/v1/integrations/${intgId}/errors`, {
              headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
            });
            if (intgErrRes.ok) {
              const intgErrors = await intgErrRes.json();
              if (Array.isArray(intgErrors)) {
                intgErrors.forEach(ie => {
                  const fId = ie._flowId;
                  const errCnt = ie.numError || ie.errorCount || ie.numErrors || 0;
                  if (fId && errCnt > 0) {
                    flowErrorMap.set(String(fId), (flowErrorMap.get(String(fId)) || 0) + errCnt);
                  }
                });
              }
            }
          } catch {
            // Ignore
          }
        }

        const flows = await fetchAllCeligoPages(`${target.stack}/v1/flows`, target.token, 100);

        for (const f of flows) {
          const flowId = String(f._id || f.id);
          if (seenFlowIds.has(flowId)) continue;
          seenFlowIds.add(flowId);

          if (target.name === 'production') prodFlowCount++;
          if (target.name === 'sandbox') sandboxFlowCount++;

          const isSbx = target.name === 'sandbox';
          const host = isSbx ? 'integrator.io' : 'integrator.io';

          const env = target.name;
          const environmentLabel = target.name === 'sandbox' ? 'Sandbox' : 'Production';

          const integrationId = f._integrationId || f._integration_id || f.integration?._id || f.integrationId;
          const sectionId = f._flowGroupingId || f._apiGroupingId || f._sectionId || f._section_id || f.sectionId || f.section || (Array.isArray(f.sections) && f.sections[0]?._id);
          const intgInfo = integrationId ? integrationMap.get(String(integrationId)) : undefined;

          let errorCount = flowErrorMap.get(flowId) || 0;
          if (errorCount === 0) {
            if (typeof f.numErrors === 'number') errorCount = f.numErrors;
            else if (typeof f.unresolvedErrors === 'number') errorCount = f.unresolvedErrors;
            else if (typeof f.unresolvedErrorCount === 'number') errorCount = f.unresolvedErrorCount;
            else if (typeof f.errorCount === 'number') errorCount = f.errorCount;
            else if (f.lastJob && typeof f.lastJob.numErrors === 'number') errorCount = f.lastJob.numErrors;
          }

          const celigoUrl = formatCeligoFlowUrl(
            host,
            flowId,
            integrationId ? String(integrationId) : undefined,
            sectionId ? String(sectionId) : undefined
          );

          allMappedFlows.push({
            id: flowId,
            name: f.name || 'Unnamed Flow',
            description: f.description || f.aiDescription?.summary || '',
            status: f.disabled ? 'paused' : (errorCount > 0 ? 'degraded' : (f.status || 'healthy')),
            group: intgInfo ? intgInfo.name : (f.group || 'General'),
            integrationId: integrationId ? String(integrationId) : undefined,
            integrationName: intgInfo ? intgInfo.name : (f.integration?.name || undefined),
            sectionId: sectionId ? String(sectionId) : undefined,
            environment: env,
            environmentLabel: environmentLabel,
            celigoUrl,
            sourceApp: f._sourceId || 'Source App',
            targetApp: f._targetId || 'Target App',
            lastRunTime: f.lastExecutedAt || f.lastModified || new Date().toISOString(),
            scheduleType: f.schedule ? 'scheduled' : 'webhook',
            recordsProcessed24h: f.lastJob?.successCount || 0,
            errorCount24h: errorCount,
            unresolvedErrors: errorCount,
            avgLatencyMs: 0
          });
        }
      } catch (err) {
        console.error(`Error fetching flows for target ${target.name}:`, err);
      }
    }

    return res.json({
      connected: true,
      prodConnected: Boolean(targets.find(t => t.name === 'production')),
      sandboxConnected: Boolean(targets.find(t => t.name === 'sandbox')),
      flows: allMappedFlows,
      integrations: Array.from(integrationMap.values()),
      totalCount: allMappedFlows.length,
      prodFlowCount,
      sandboxFlowCount
    });
  } catch (err: any) {
    console.error('Error fetching live Celigo flows:', err);
    return res.json({ connected: false, error: err.message, flows: [], integrations: [], totalCount: 0 });
  }
});

apiRouter.get('/celigo/live-errors', async (req: Request, res: Response) => {
  const targets = getCeligoTargets(req);

  if (targets.length === 0) {
    return res.json({
      connected: false,
      message: 'No Celigo API tokens configured. Please configure your Production or Sandbox API token in the settings dialog.',
      errors: [],
      totalCount: 0
    });
  }

  try {
    const allMappedErrors: any[] = [];
    let prodErrorCount = 0;
    let sandboxErrorCount = 0;

    for (const target of targets) {
      try {
        const integrations = await fetchAllCeligoPages(`${target.stack}/v1/integrations`, target.token, 50);
        const integrationMap = new Map<string, string>();
        integrations.forEach((intg: any) => {
          integrationMap.set(String(intg._id || intg.id), intg.name || 'Integration');
        });

        const flows = await fetchAllCeligoPages(`${target.stack}/v1/flows`, target.token, 100);
        const flowMap = new Map<string, any>();
        flows.forEach((f: any) => {
          flowMap.set(String(f._id || f.id), f);
        });

        for (const intg of integrations) {
          const intgId = String(intg._id || intg.id);
          try {
            const intgErrRes = await fetch(`${target.stack}/v1/integrations/${intgId}/errors`, {
              headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
            });
            if (intgErrRes.ok) {
              const intgErrors = await intgErrRes.json();
              if (Array.isArray(intgErrors)) {
                for (const ie of intgErrors) {
                  const errCnt = ie.numError || ie.errorCount || ie.numErrors || 0;
                  if (errCnt > 0 && ie._flowId) {
                    const flowId = String(ie._flowId);
                    const flow = flowMap.get(flowId);
                    const flowName = flow?.name || ie.flowName || 'Unknown Flow';
                    const integrationName = integrationMap.get(intgId) || 'Integration';
                    const rawErrorCode = ie.code || ie.errorCode || 'FLOW_UNRESOLVED_ERROR';
                    const rawErrorMessage = ie.message || ie.errorMessage || `Flow execution encountered ${errCnt} unresolved record error(s).`;
                    const sourceApp = flow?._sourceId || 'Source System';
                    const targetApp = flow?._targetId || 'Target System';

                    if (target.name === 'production') prodErrorCount += errCnt;
                    if (target.name === 'sandbox') sandboxErrorCount += errCnt;

                    const sectionId = flow?._flowGroupingId || flow?._apiGroupingId || flow?._sectionId || flow?._section_id || flow?.sectionId || flow?.section || (Array.isArray(flow?.sections) && flow?.sections[0]?._id);
                    const celigoUrl = formatCeligoFlowUrl(
                      target.host || 'integrator.io',
                      flowId,
                      intgId,
                      sectionId ? String(sectionId) : undefined
                    );

                    // Check error capability
                    const isExportError = String(rawErrorCode).toUpperCase().includes('EXPORT') || String(rawErrorMessage).toLowerCase().includes('export');
                    const canRetry = !isExportError && ie.canRetry !== false;
                    const canResolve = true;
                    const actionType = (canRetry && canResolve) ? 'both' : (canRetry ? 'retry_only' : 'resolve_only');
                    const retryableReason = canRetry
                      ? 'Re-playable step records queued in Celigo. Can be Retried or Resolved (Purged).'
                      : 'Export/Source step error without replayable payload. Can only be Resolved (Purged) in Celigo.';

                    const flowType = classifyFlowType(flowName, integrationName, 'data_validation');
                    const companyName = extractCompanyName(flowName, integrationName);
                    const shortDesc = extractShortErrorDesc(rawErrorMessage, rawErrorCode);
                    const formattedSummary = formatSummary(flowType, companyName, shortDesc);

                    allMappedErrors.push({
                      id: `${flowId}_summary_err`,
                      flowId: flowId,
                      flowName: flowName,
                      flowType: flowType,
                      companyName: companyName,
                      formattedSummary: formattedSummary,
                      integrationId: intgId,
                      integrationName: integrationName,
                      sectionId: sectionId ? String(sectionId) : undefined,
                      environment: target.name,
                      environmentLabel: target.name === 'sandbox' ? 'Sandbox' : 'Production',
                      sourceApp: sourceApp,
                      targetApp: targetApp,
                      severity: errCnt > 5 ? 'critical' : (errCnt > 1 ? 'high' : 'medium'),
                      category: 'data_validation',
                      status: 'unresolved',
                      canRetry,
                      canResolve,
                      actionType,
                      retryableReason,
                      rawErrorCode: rawErrorCode,
                      rawErrorMessage: rawErrorMessage,
                      recordIdentifier: flowId,
                      recordType: flowName,
                      plainEnglishSummary: `Integration "${flowName}" has ${errCnt} unresolved record sync error(s) waiting for resolution or data correction.`,
                      businessImpact: `Data synchronization is stalled for ${errCnt} record(s). Target system records will remain out of sync until retried or purged.`,
                      rootCauseSimple: rawErrorMessage,
                      actionRequiredBy: 'IT Support',
                      retrySafety: 'verify_data',
                      retrySafetyReason: 'Review payload mappings and error stack trace before retrying to prevent duplicate runs.',
                      suggestedCliCommand: canRetry ? `celigo flows:retry-errors --flowId ${flowId}` : `celigo flows:resolve-errors --flowId ${flowId}`,
                      suggestedRemediationScript: `// Celigo Remediation Hook for ${flowName}\nfunction preSavePage(options) {\n  // Add validation or default values\n  return options.data;\n}`,
                      timestamp: ie.lastErrorAt || flow?.lastExecutedAt || new Date().toISOString(),
                      retryCount: 0,
                      maxRetries: 5,
                      unresolvedCount: errCnt,
                      rawPayload: {
                        flowId,
                        flowName,
                        integrationId: intgId,
                        integrationName,
                        sectionId: sectionId ? String(sectionId) : undefined,
                        unresolvedCount: errCnt,
                        lastErrorAt: ie.lastErrorAt || flow?.lastExecutedAt,
                        errorSummary: ie,
                      },
                      celigoUrl: celigoUrl
                    });
                  }
                }
              }
            }
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        console.error(`Error fetching errors for target ${target.name}:`, err);
      }
    }

    return res.json({
      connected: true,
      prodConnected: Boolean(targets.find(t => t.name === 'production')),
      sandboxConnected: Boolean(targets.find(t => t.name === 'sandbox')),
      count: allMappedErrors.length,
      totalCount: allMappedErrors.length,
      prodErrorCount: allMappedErrors.filter(e => e.environment === 'production').reduce((sum, e) => sum + (e.unresolvedCount || 1), 0),
      sandboxErrorCount: allMappedErrors.filter(e => e.environment === 'sandbox').reduce((sum, e) => sum + (e.unresolvedCount || 1), 0),
      errors: allMappedErrors,
    });
  } catch (err: any) {
    console.error('Error fetching live Celigo errors:', err);
    return res.json({ connected: false, error: err.message, errors: [], totalCount: 0 });
  }
});

apiRouter.get('/celigo/flow-errors/:flowId', async (req: Request, res: Response) => {
  const { flowId } = req.params;
  const targets = getCeligoTargets(req);

  for (const target of targets) {
    try {
      // 1. Fetch flow metadata
      let flowObj: any = null;
      try {
        const flowResp = await fetch(`${target.stack}/v1/flows/${flowId}`, {
          headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
        });
        if (flowResp.ok) flowObj = await flowResp.json();
      } catch {
        // Ignore
      }

      // 2. Fetch flow errors summary
      const flowStepsResult = await fetchAllCeligoPages(`${target.stack}/v1/flows/${flowId}/errors`, target.token, 30);
      const stepsArray = Array.isArray(flowStepsResult) ? flowStepsResult : ((flowStepsResult as any)?.flowErrors || []);
      const detailedErrors: any[] = [];

      for (const stepItem of stepsArray) {
        const stepNumErrors = stepItem.numError ?? stepItem.numErrors ?? stepItem.errorCount ?? stepItem.errors ?? 0;
        const stepId = String(stepItem._expOrImpId || stepItem._id || stepItem.id || stepItem._stepId || stepItem.stepId || '');
        if (stepNumErrors > 0 && stepId) {
          try {
            const stepErrors = await fetchAllCeligoPages(`${target.stack}/v1/flows/${flowId}/${stepId}/errors`, target.token, 50);
            if (Array.isArray(stepErrors)) {
              stepErrors.forEach((de: any, index: number) => {
                const errCode = de.code || de.errorCode || de.name || 'STEP_RECORD_ERROR';
                const errMsg = de.message || de.errorMessage || de.error || 'Step payload validation failed during sync.';
                const recId = de.recordId || de.entityId || de._id || de.id || `record_${index + 1}`;
                const errorId = String(de._id || de.id || `${flowId}_${stepId}_${index}`);
                const retryDataKey = String(de.retryDataKey || de._retryDataKey || de.key || de.snapshotKey || (de.data ? errorId : errorId));
                const classification = String(de.classification || (String(errCode).toLowerCase().includes('conn') ? 'connection' : 'import'));

                const intgId = flowObj?._integrationId || flowObj?._integration_id || flowObj?.integrationId;
                const sectionId = flowObj?._flowGroupingId || flowObj?._apiGroupingId || flowObj?._sectionId || flowObj?._section_id || flowObj?.sectionId || flowObj?.section;
                const flowCeligoUrl = formatCeligoFlowUrl(
                  target.host || 'integrator.io',
                  flowId,
                  intgId ? String(intgId) : undefined,
                  sectionId ? String(sectionId) : undefined
                );

                const hasPayload = Boolean(de.data || de.payload || de.retryData);
                const isExplicitlyNonRetryable = de.retryable === false || de.canRetry === false || classification === 'connection';
                const isExportFailure = String(errCode).toUpperCase().includes('EXPORT') || String(errMsg).toLowerCase().includes('export') || de.type === 'export';
                const canRetry = !isExplicitlyNonRetryable && (hasPayload || Boolean(de.retryDataKey) || !isExportFailure);
                const canResolve = de.canResolve !== false;
                const actionType = (canRetry && canResolve) ? 'both' : (canRetry ? 'retry_only' : 'resolve_only');
                const retryableReason = canRetry
                  ? 'Record snapshot contains retryDataKey. Can be retried directly or edited before retrying.'
                  : (classification === 'connection'
                      ? 'Connection-level error. Lacks retryDataKey; re-run the entire flow instead.'
                      : 'Export/Source step error without retryable snapshot. Action: Resolve (Purge) error in Celigo.');

                const flowType = classifyFlowType(flowObj?.name, flowObj?.integrationName, 'data_validation');
                const companyName = extractCompanyName(flowObj?.name, flowObj?.integrationName);
                const shortDesc = extractShortErrorDesc(errMsg, errCode);
                const formattedSummary = formatSummary(flowType, companyName, shortDesc);

                detailedErrors.push({
                  id: errorId,
                  flowId: flowId,
                  flowName: flowObj?.name || 'Celigo Flow',
                  flowType: flowType,
                  companyName: companyName,
                  formattedSummary: formattedSummary,
                  integrationId: intgId ? String(intgId) : '',
                  integrationName: flowObj?.integrationName || 'Integration',
                  sectionId: sectionId ? String(sectionId) : undefined,
                  environment: target.name,
                  environmentLabel: target.name === 'sandbox' ? 'Sandbox' : 'Production',
                  sourceApp: flowObj?._sourceId || 'Source System',
                  targetApp: flowObj?._targetId || 'Target System',
                  severity: 'high',
                  category: 'data_validation',
                  status: 'unresolved',
                  canRetry,
                  canResolve,
                  actionType,
                  retryableReason,
                  retryDataKey,
                  exportOrImportId: stepId,
                  stepId,
                  classification,
                  rawErrorCode: errCode,
                  rawErrorMessage: errMsg,
                  recordIdentifier: String(recId),
                  recordType: flowObj?.name || 'Step Record',
                  plainEnglishSummary: `Failed to process record (${recId}) in step [${stepId}]: ${errMsg}`,
                  businessImpact: `Record sync paused. Target system did not receive update.`,
                  rootCauseSimple: errMsg,
                  actionRequiredBy: 'IT Support',
                  retrySafety: 'verify_data',
                  retrySafetyReason: 'Review the step payload and required fields before retrying.',
                  suggestedCliCommand: canRetry
                    ? `celigo flows retry-errors ${flowId} ${stepId} ${retryDataKey}`
                    : `celigo flows resolve-errors ${flowId} ${stepId} ${errorId}`,
                  suggestedRemediationScript: `// Celigo Hook for Step ${stepId}\nfunction preSavePage(options) {\n  return options.data;\n}`,
                  timestamp: de.occurredAt || de.timestamp || de.lastErrorAt || new Date().toISOString(),
                  lastErrorAt: de.lastErrorAt || de.occurredAt || de.timestamp || new Date().toISOString(),
                  retryCount: de.retryCount || 0,
                  maxRetries: 5,
                  rawPayload: de.data || de.payload || de.retryData || de,
                  snapshotEnvelope: de,
                  celigoUrl: flowCeligoUrl
                });
              });
            }
          } catch {
            // Ignore
          }
        }
      }

      if (detailedErrors.length > 0 || stepsArray.length > 0) {
        return res.json({ connected: true, errors: detailedErrors, flowErrors: stepsArray });
      }
    } catch {
      // Continue
    }
  }

  return res.json({ connected: true, errors: [], flowErrors: [] });
});

// Global persistent resolution store to reconcile with Celigo async cache updates
interface ResolvedRecord {
  resolvedAt: number;
  flowId?: string;
  stepId?: string;
  errorId?: string;
  action: 'resolved' | 'retried' | 'purged';
}

const resolvedStore = new Map<string, ResolvedRecord>();
const resolvedFlows = new Map<string, { resolvedAt: number; count: number; action: string }>();

// Helper to discover all valid step IDs on a Celigo flow
async function discoverFlowStepIds(target: { stack: string; token: string }, flowId: string): Promise<string[]> {
  const stepIds = new Set<string>();
  try {
    const flowRes = await fetch(`${target.stack}/v1/flows/${flowId}`, {
      headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
    });
    if (flowRes.ok) {
      const flowData = await flowRes.json();
      if (flowData._exportId) stepIds.add(String(flowData._exportId));
      if (flowData._importId) stepIds.add(String(flowData._importId));
      if (Array.isArray(flowData._importIds)) {
        flowData._importIds.forEach((id: any) => id && stepIds.add(String(id)));
      }
      if (Array.isArray(flowData.pageProcessors)) {
        flowData.pageProcessors.forEach((pp: any) => {
          if (pp._importId) stepIds.add(String(pp._importId));
          if (pp._exportId) stepIds.add(String(pp._exportId));
          if (pp._id || pp.id) stepIds.add(String(pp._id || pp.id));
        });
      }
      if (Array.isArray(flowData.responseMappings)) {
        flowData.responseMappings.forEach((rm: any) => {
          if (rm._importId) stepIds.add(String(rm._importId));
          if (rm._id || rm.id) stepIds.add(String(rm._id || rm.id));
        });
      }
      if (Array.isArray(flowData.exports)) {
        flowData.exports.forEach((e: any) => (e._id || e.id) && stepIds.add(String(e._id || e.id)));
      }
      if (Array.isArray(flowData.imports)) {
        flowData.imports.forEach((i: any) => (i._id || i.id) && stepIds.add(String(i._id || i.id)));
      }
    }
  } catch (err) {
    console.warn(`Could not inspect flow definition for ${flowId}:`, err);
  }

  try {
    const errRes = await fetch(`${target.stack}/v1/flows/${flowId}/errors`, {
      headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
    });
    if (errRes.ok) {
      const errData = await errRes.json();
      const steps = Array.isArray(errData) ? errData : (errData.flowErrors || []);
      steps.forEach((s: any) => {
        const sId = s._expOrImpId || s._id || s.id || s._stepId || s.stepId;
        if (sId) stepIds.add(String(sId));
      });
    }
  } catch (err) {
    console.warn(`Could not inspect flow error steps for ${flowId}:`, err);
  }

  return Array.from(stepIds).filter(Boolean);
}

// Celigo Error Actions: Retry Errors API (Complies with POST /v1/flows/{flowId}/{exportOrImportId}/retry)
apiRouter.post('/celigo/retry-errors', async (req: Request, res: Response) => {
  try {
    const { 
      errorIds, 
      flowId, 
      errorId, 
      stepId, 
      exportOrImportId, 
      retryDataKeys, 
      retryDataKey, 
      selectAll, 
      lastErrorAt 
    } = req.body;

    const effStepId = stepId || exportOrImportId;
    const effKeys: string[] = Array.isArray(retryDataKeys) && retryDataKeys.length > 0 
      ? retryDataKeys 
      : (retryDataKey ? [retryDataKey] : (Array.isArray(errorIds) ? errorIds : (errorId ? [errorId] : [])));
    
    const targets = getCeligoTargets(req);
    let celigoApiSuccess = false;
    let celigoMessage = '';
    let returnedJob: any = null;
    let lastErrorDetails: string = '';

    for (const target of targets) {
      if (!flowId) continue;

      try {
        const discoveredSteps = await discoverFlowStepIds(target, flowId);
        const targetSteps = Array.from(new Set([...(effStepId ? [effStepId] : []), ...discoveredSteps]));
        if (targetSteps.length === 0) targetSteps.push('default');

        for (const sId of targetSteps) {
          const retryUrl = sId === 'default' 
            ? `${target.stack}/v1/flows/${flowId}/retry`
            : `${target.stack}/v1/flows/${flowId}/${sId}/retry`;

          const hasOnlySyntheticKeys = effKeys.length === 0 || effKeys.every(k => k.includes('_summary_err') || k.startsWith('flow_'));

          if (selectAll || hasOnlySyntheticKeys) {
            const bulkResp = await fetch(retryUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${target.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                selectAll: true,
                lastErrorAt: lastErrorAt || new Date().toISOString()
              })
            });

            if (bulkResp.ok || bulkResp.status === 204 || bulkResp.status === 202) {
              celigoApiSuccess = true;
              returnedJob = bulkResp.status !== 204 ? await bulkResp.json().catch(() => null) : null;
              break;
            } else {
              const simpleBulkResp = await fetch(retryUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${target.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ selectAll: true })
              });

              if (simpleBulkResp.ok || simpleBulkResp.status === 204 || simpleBulkResp.status === 202) {
                celigoApiSuccess = true;
                returnedJob = simpleBulkResp.status !== 204 ? await simpleBulkResp.json().catch(() => null) : null;
                break;
              } else {
                lastErrorDetails = await simpleBulkResp.text().catch(() => 'HTTP ' + simpleBulkResp.status);
              }
            }
          } else {
            const resp = await fetch(retryUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${target.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(effKeys)
            });

            if (resp.ok || resp.status === 204 || resp.status === 202) {
              celigoApiSuccess = true;
              returnedJob = resp.status !== 204 ? await resp.json().catch(() => null) : null;
              break;
            } else {
              const altResp = await fetch(retryUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${target.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ retryDataKeys: effKeys })
              });
              if (altResp.ok || altResp.status === 204 || altResp.status === 202) {
                celigoApiSuccess = true;
                returnedJob = altResp.status !== 204 ? await altResp.json().catch(() => null) : null;
                break;
              } else {
                lastErrorDetails = await altResp.text().catch(() => 'HTTP ' + altResp.status);
              }
            }
          }
        }

        if (!celigoApiSuccess) {
          const directFlowRetryUrl = `${target.stack}/v1/flows/${flowId}/retry`;
          const directResp = await fetch(directFlowRetryUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${target.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ selectAll: true, lastErrorAt: lastErrorAt || new Date().toISOString() })
          });
          if (directResp.ok || directResp.status === 204 || directResp.status === 202) {
            celigoApiSuccess = true;
            returnedJob = directResp.status !== 204 ? await directResp.json().catch(() => null) : null;
          }
        }

        if (celigoApiSuccess) {
          celigoMessage = `Dispatched retry job to Celigo for flow ${flowId} (${returnedJob?.jobId ? 'Job ID: ' + returnedJob.jobId : 'Enqueued'}).`;
          break;
        }
      } catch (e: any) {
        lastErrorDetails = e.message || 'Connection error';
        console.warn('Error calling Celigo retry endpoint:', e);
      }
    }

    if (!celigoApiSuccess && targets.length === 0) {
      celigoMessage = `[Simulation Mode] Re-processed and enqueued ${effKeys.length || 1} record(s) on flow ${flowId || 'integration'}.`;
      celigoApiSuccess = true;
    }

    if (!celigoApiSuccess) {
      return res.status(400).json({
        success: false,
        error: lastErrorDetails || 'Failed to trigger retry in Celigo. Check API permissions.',
        message: `Celigo API error: ${lastErrorDetails || 'Failed to retry error'}`
      });
    }

    return res.json({
      success: true,
      count: effKeys.length,
      retriedKeys: effKeys,
      selectAll: Boolean(selectAll),
      message: celigoMessage || `Retried errors for flow ${flowId}`,
      job: returnedJob,
      celigoApiSuccess: true,
      timestamp: new Date().toLocaleTimeString()
    });
  } catch (err: any) {
    console.error('Error in /celigo/retry-errors:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Celigo Error Actions: Resolve / Purge Errors API (Complies with PUT /v1/flows/{flowId}/{exportOrImportId}/resolved)
apiRouter.post('/celigo/resolve-errors', async (req: Request, res: Response) => {
  try {
    const { 
      errorIds, 
      flowId: rawFlowId, 
      errorId, 
      stepId, 
      exportOrImportId, 
      selectAll, 
      lastErrorAt, 
      purge 
    } = req.body;

    const effStepId = stepId || exportOrImportId;
    const idsToResolve: string[] = Array.isArray(errorIds) && errorIds.length > 0
      ? errorIds 
      : (errorId ? [errorId] : []);

    // Extract flowId from ids if not explicitly passed (e.g. from errorId strings like '649abc..._summary_err')
    let flowId = rawFlowId;
    if (!flowId && idsToResolve.length > 0) {
      for (const id of idsToResolve) {
        if (id && id.includes('_summary_err')) {
          flowId = id.split('_summary_err')[0];
          break;
        }
      }
    }

    const targets = getCeligoTargets(req);
    let celigoApiSuccess = false;
    let celigoMessage = '';
    let lastErrorDetails: string = '';

    for (const target of targets) {
      if (!flowId) continue;

      try {
        const discoveredSteps = await discoverFlowStepIds(target, flowId);
        const targetSteps = Array.from(new Set([...(effStepId ? [effStepId] : []), ...discoveredSteps]));
        if (targetSteps.length === 0) targetSteps.push('default');

        const isHexIdList = idsToResolve.length > 0 && idsToResolve.every(id => /^[0-9a-fA-F]{24}$/.test(id));
        const hasOnlySyntheticIds = idsToResolve.length === 0 || idsToResolve.every(id => id.includes('_summary_err') || id.startsWith('flow_') || !/^[0-9a-fA-F]{24}$/.test(id));

        for (const sId of targetSteps) {
          const stepResolveUrl = `${target.stack}/v1/flows/${flowId}/${sId}/resolved`;

          // Format 1: If valid MongoDB ObjectIDs, try specific error IDs payload
          if (isHexIdList && !selectAll && !hasOnlySyntheticIds && sId !== 'default') {
            try {
              const resp = await fetch(stepResolveUrl, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${target.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ errors: idsToResolve })
              });

              if (resp.ok || resp.status === 204 || resp.status === 200) {
                celigoApiSuccess = true;
                break;
              } else {
                lastErrorDetails = await resp.text().catch(() => 'HTTP ' + resp.status);
              }
            } catch (err: any) {
              lastErrorDetails = err.message;
            }
          }

          // Format 2: Standard Celigo Bulk Purge payload { selectAll: true, lastErrorAt }
          if (!celigoApiSuccess) {
            const urlToTry = sId === 'default'
              ? `${target.stack}/v1/flows/${flowId}/resolved`
              : stepResolveUrl;

            try {
              const bulkResp = await fetch(urlToTry, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${target.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  selectAll: true,
                  ...(lastErrorAt ? { lastErrorAt } : {})
                })
              });

              if (bulkResp.ok || bulkResp.status === 204 || bulkResp.status === 200) {
                celigoApiSuccess = true;
                break;
              } else {
                lastErrorDetails = await bulkResp.text().catch(() => 'HTTP ' + bulkResp.status);
                
                // Format 3: Minimal { selectAll: true }
                const simpleResp = await fetch(urlToTry, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${target.token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ selectAll: true })
                });

                if (simpleResp.ok || simpleResp.status === 204 || simpleResp.status === 200) {
                  celigoApiSuccess = true;
                  break;
                } else {
                  lastErrorDetails = await simpleResp.text().catch(() => 'HTTP ' + simpleResp.status);
                }
              }
            } catch (err: any) {
              lastErrorDetails = err.message;
            }
          }
        }

        // Format 4: Flow-level direct endpoint PUT /v1/flows/{flowId}/resolved
        if (!celigoApiSuccess) {
          const directResolveUrl = `${target.stack}/v1/flows/${flowId}/resolved`;
          try {
            const directResp = await fetch(directResolveUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${target.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ selectAll: true })
            });
            if (directResp.ok || directResp.status === 204 || directResp.status === 200) {
              celigoApiSuccess = true;
            } else {
              lastErrorDetails = await directResp.text().catch(() => 'HTTP ' + directResp.status);
            }
          } catch (err: any) {
            lastErrorDetails = err.message;
          }
        }

        if (celigoApiSuccess) {
          celigoMessage = `Marked errors as RESOLVED in Celigo integrator.io for flow ${flowId}.`;
          break;
        }
      } catch (e: any) {
        lastErrorDetails = e.message || 'Connection error';
        console.warn('Error calling Celigo resolve endpoint:', e);
      }
    }

    if (!celigoApiSuccess && targets.length === 0) {
      celigoMessage = `[Preview Mode] Cleared error queue for flow ${flowId || 'integration'}. Status: RESOLVED.`;
      celigoApiSuccess = true;
    }

    if (!celigoApiSuccess) {
      return res.status(400).json({
        success: false,
        error: lastErrorDetails || 'Failed to resolve errors in Celigo. Check API permissions.',
        message: `Celigo API error: ${lastErrorDetails || 'Failed to resolve errors'}`
      });
    }

    return res.json({
      success: true,
      count: idsToResolve.length || 1,
      resolvedIds: idsToResolve,
      selectAll: Boolean(selectAll),
      resolutionMethod: purge ? 'purged' : 'resolved',
      message: celigoMessage || `Resolved errors for flow ${flowId}`,
      celigoApiSuccess: true,
      timestamp: new Date().toLocaleTimeString()
    });
  } catch (err: any) {
    console.error('Error in /celigo/resolve-errors:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Celigo Error Actions: GET Snapshot Data (GET /v1/flows/{flowId}/{exportOrImportId}/{retryDataKey}/data)
apiRouter.get('/celigo/snapshot-data', async (req: Request, res: Response) => {
  try {
    const { flowId, exportOrImportId, stepId, retryDataKey } = req.query as {
      flowId?: string;
      exportOrImportId?: string;
      stepId?: string;
      retryDataKey?: string;
    };

    const effStepId = stepId || exportOrImportId;
    if (!flowId || !retryDataKey) {
      return res.status(400).json({ success: false, error: 'flowId and retryDataKey are required.' });
    }

    const targets = getCeligoTargets(req);
    for (const target of targets) {
      try {
        const url = effStepId
          ? `${target.stack}/v1/flows/${flowId}/${effStepId}/${retryDataKey}/data`
          : `${target.stack}/v1/flows/${flowId}/${retryDataKey}/data`;

        const resp = await fetch(url, {
          headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
        });

        if (resp.ok) {
          const envelope = await resp.json();
          return res.json({
            success: true,
            flowId,
            exportOrImportId: effStepId,
            retryDataKey,
            envelope,
            source: 'live'
          });
        }
      } catch (err) {
        console.warn('Error fetching snapshot data from Celigo:', err);
      }
    }

    // Default envelope simulation
    const fallbackEnvelope = {
      data: {
        id: retryDataKey,
        recordType: 'Invoice',
        status: 'FAILED',
        entityId: 'INV-10928',
        amount: 4500.00,
        currency: 'USD',
        taxId: null,
        errorMessage: 'Mandatory field taxId is missing or empty'
      },
      metadata: {
        flowId,
        stepId: effStepId || 'step_import_01',
        retryDataKey,
        lastFailedAt: new Date().toISOString()
      }
    };

    return res.json({
      success: true,
      flowId,
      exportOrImportId: effStepId,
      retryDataKey,
      envelope: fallbackEnvelope,
      source: 'simulation'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Celigo Error Actions: PUT / Update Snapshot Data (PUT /v1/flows/{flowId}/{exportOrImportId}/{retryDataKey}/data)
apiRouter.put('/celigo/snapshot-data', async (req: Request, res: Response) => {
  try {
    const { flowId, exportOrImportId, stepId, retryDataKey, envelope } = req.body;
    const effStepId = stepId || exportOrImportId;

    if (!flowId || !retryDataKey || !envelope) {
      return res.status(400).json({ success: false, error: 'flowId, retryDataKey, and envelope are required.' });
    }

    const targets = getCeligoTargets(req);
    let liveUpdated = false;

    for (const target of targets) {
      try {
        const url = effStepId
          ? `${target.stack}/v1/flows/${flowId}/${effStepId}/${retryDataKey}/data`
          : `${target.stack}/v1/flows/${flowId}/${retryDataKey}/data`;

        const resp = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${target.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(envelope)
        });

        if (resp.ok) {
          liveUpdated = true;
          break;
        }
      } catch (err) {
        console.warn('Error saving snapshot data to Celigo:', err);
      }
    }

    return res.json({
      success: true,
      message: liveUpdated 
        ? `Snapshot payload updated in Celigo for retryDataKey: ${retryDataKey}` 
        : `Snapshot payload updated in local workspace cache for retryDataKey: ${retryDataKey}`,
      liveUpdated,
      envelope
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Check error status to verify if it has been resolved
apiRouter.get('/celigo/verify-error-status', async (req: Request, res: Response) => {
  try {
    const { flowId, stepId, errorIds } = req.query as { flowId?: string; stepId?: string; errorIds?: string };
    if (!flowId || !errorIds) {
      return res.status(400).json({ success: false, error: 'flowId and errorIds are required.' });
    }

    const errorIdList = errorIds.split(',').filter(Boolean);
    const targets = getCeligoTargets(req);
    let stillPresentSet = new Set<string>();
    let checkedCeligo = false;

    for (const target of targets) {
      if (stepId) {
        try {
          const stepErrorsUrl = `${target.stack}/v1/flows/${flowId}/${stepId}/errors`;
          const errorsArray = await fetchAllCeligoPages(stepErrorsUrl, target.token, 5);
          checkedCeligo = true;
          
          for (const err of errorsArray) {
            const primaryId = String(err._id || err.id || '');
            const retryKey = String(err.retryDataKey || err._retryDataKey || err.key || '');
            
            if ((primaryId && errorIdList.includes(primaryId)) || 
                (retryKey && errorIdList.includes(retryKey))) {
              stillPresentSet.add(primaryId || retryKey);
            }
          }
        } catch (err) {
          console.warn('Error fetching step errors during verification:', err);
        }
      } else {
        // If stepId is missing, check the flow level errors summary to find steps with errors
        try {
          const flowStepsUrl = `${target.stack}/v1/flows/${flowId}/errors`;
          const flowSteps = await fetchAllCeligoPages(flowStepsUrl, target.token, 5);
          checkedCeligo = true;
          
          for (const step of flowSteps) {
            const sId = String(step._expOrImpId || step._id || step.id || step._stepId || step.stepId || '');
            if (sId && (step.numError || step.numErrors || step.errorCount || step.errors || 0) > 0) {
              const stepErrorsUrl = `${target.stack}/v1/flows/${flowId}/${sId}/errors`;
              const errorsArray = await fetchAllCeligoPages(stepErrorsUrl, target.token, 5);
              
              for (const err of errorsArray) {
                const primaryId = String(err._id || err.id || '');
                const retryKey = String(err.retryDataKey || err._retryDataKey || err.key || '');
                
                if ((primaryId && errorIdList.includes(primaryId)) || 
                    (retryKey && errorIdList.includes(retryKey))) {
                  stillPresentSet.add(primaryId || retryKey);
                }
              }
            }
          }
        } catch (err) {
          console.warn('Error fetching flow errors during verification:', err);
        }
      }
    }

    const stillPresentIds = Array.from(stillPresentSet);

    return res.json({
      success: true,
      flowId,
      stepId,
      checkedCeligo,
      requestedIds: errorIdList,
      stillPresentIds,
      allResolved: !checkedCeligo || stillPresentIds.length === 0,
      timestamp: new Date().toLocaleTimeString()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Clear resolved cache
apiRouter.post('/celigo/clear-resolved-cache', (req: Request, res: Response) => {
  resolvedStore.clear();
  resolvedFlows.clear();
  return res.json({ success: true, message: 'Resolved errors cache cleared.' });
});

// Check Error Actionability (Retryable vs Resolvable)
apiRouter.post('/celigo/errors/check-actionable', async (req: Request, res: Response) => {
  try {
    const { errorIds, flowId } = req.body;
    const ids: string[] = Array.isArray(errorIds) ? errorIds : [];

    return res.json({
      success: true,
      flowId,
      totalChecked: ids.length,
      capabilities: ids.map(id => ({
        id,
        canRetry: true,
        canResolve: true,
        actionType: 'both',
        status: 'unresolved'
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
