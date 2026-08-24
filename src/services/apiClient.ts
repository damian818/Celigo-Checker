import { CeligoErrorRecord, JiraTicket, NotificationPayload } from '../types/celigo';
import { getCeligoHeaders } from './tokenStorage';
import { refreshGoogleAccessToken } from './firebase';

export interface AnalysisResponse {
  plainEnglishSummary: string;
  businessImpact: string;
  rootCause: string;
  actionRequiredBy: 'Accounting' | 'Sales Ops' | 'IT Support' | 'Warehouse' | 'Customer Success';
  retrySafety: 'safe' | 'verify_data' | 'manual_intervention';
  retrySafetyReason: string;
  suggestedCliCommand: string;
  suggestedRemediationScript: string;
  jiraTroubleshootingSteps: string[];
  mcpToolToExecute?: string;
}

export async function requestErrorAnalysis(error: CeligoErrorRecord): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyze-error', {
    method: 'POST',
    headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawErrorCode: error.rawErrorCode || 'FLOW_UNRESOLVED_ERROR',
      rawErrorMessage: error.rawErrorMessage || error.plainEnglishSummary || 'Flow synchronization error',
      flowName: error.flowName || 'Celigo Flow',
      sourceApp: error.sourceApp?.name || error.sourceApp || 'Source System',
      targetApp: error.targetApp?.name || error.targetApp || 'Target System',
      rawPayload: error.rawPayload || {},
      mappingFieldFailed: error.mappingFieldFailed,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to analyze error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.analysis;
}

export async function sendChatMessage(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  userMessage: string,
  contextData?: any
): Promise<{ text: string; cliCommandSnippet?: string; scriptSnippet?: string }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      userMessage,
      contextData,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send chat message: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

export async function getJiraStatus(): Promise<{
  connected: boolean;
  isLive: boolean;
  domain: string;
  email: string;
  projectKey: string;
  issueType: string;
  message?: string;
  displayName?: string;
}> {
  try {
    const response = await fetch('/api/jira/status');
    if (!response.ok) {
      return {
        connected: false,
        isLive: false,
        domain: 'https://gappify.atlassian.net',
        email: 'damian@gappify.com',
        projectKey: 'GS',
        issueType: 'Integration Issue',
        message: 'Could not fetch Jira status',
      };
    }
    return await response.json();
  } catch (err: any) {
    return {
      connected: false,
      isLive: false,
      domain: 'https://gappify.atlassian.net',
      email: 'damian@gappify.com',
      projectKey: 'GS',
      issueType: 'Integration Issue',
      message: err.message || 'Error checking Jira status',
    };
  }
}

export async function createJiraTicket(ticketData: Partial<JiraTicket> & Record<string, any>): Promise<{
  ticket: JiraTicket;
  isLive: boolean;
  message: string;
}> {
  const response = await fetch('/api/jira/create-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorDetails = data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details, null, 2) : data.details) : '';
    throw new Error(data.error ? `${data.error}${errorDetails ? `: ${errorDetails}` : ''}` : `Failed to create Jira ticket: ${response.statusText}`);
  }

  return {
    ticket: data.ticket,
    isLive: data.isLive,
    message: data.message,
  };
}

export async function sendGChatAlert(payload: {
  title: string;
  severity: string;
  flowName: string;
  errorSummary: string;
  actionableStep: string;
  cliCommand?: string;
  spaceName?: string;
  customText?: string;
  flowUrl?: string;
}) {
  const response = await fetch('/api/notifications/send-gchat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to send Google Chat alert: ${response.statusText}`);
  }

  return await response.json();
}

export async function sendGmailAlert(payload: {
  recipients: string[];
  subject: string;
  bodyHtml: string;
  severity: string;
  flowName: string;
  flowUrl?: string;
}) {
  let token = localStorage.getItem('google_access_token');
  
  if (!token) {
    // Attempt automatic token acquisition
    try {
      token = await refreshGoogleAccessToken();
    } catch (err: any) {
      throw new Error(`Google Workspace authentication required: ${err.message || 'Please log in with your @gappify.com account.'}`);
    }
  }

  // Helper to construct raw RFC 2822 email
  const constructRawEmail = () => {
    const to = payload.recipients.join(', ');
    const emailLines = [
      `To: ${to}`,
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      `Subject: ${payload.subject}`,
      '',
      payload.bodyHtml
    ];
    const email = emailLines.join('\n');
    return btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const sendRequest = async (accessToken: string) => {
    return await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: constructRawEmail()
      })
    });
  };

  let response = await sendRequest(token);

  // If 401 Unauthorized (expired token), automatically refresh and retry once
  if (response.status === 401) {
    console.warn('[Gmail API] Access token expired (401). Requesting refreshed token...');
    try {
      token = await refreshGoogleAccessToken();
      response = await sendRequest(token);
    } catch (refreshErr: any) {
      console.error('[Gmail API] Token refresh failed:', refreshErr);
      throw new Error('Google OAuth session expired. Please re-authenticate your @gappify.com account to send emails.');
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gmail API Error Response:', response.status, errorText);
    let detailedMsg = response.statusText;
    try {
      const parsed = JSON.parse(errorText);
      detailedMsg = parsed.error?.message || detailedMsg;
    } catch {}
    throw new Error(`Gmail API error (${response.status}): ${detailedMsg}`);
  }

  return await response.json();
}

export interface RetryOptions {
  errorId?: string;
  errorIds?: string[];
  flowId?: string;
  stepId?: string;
  exportOrImportId?: string;
  environment?: string;
  retryDataKey?: string;
  retryDataKeys?: string[];
  selectAll?: boolean;
  lastErrorAt?: string;
}

export interface ResolveOptions {
  errorId?: string;
  errorIds?: string[];
  flowId?: string;
  stepId?: string;
  exportOrImportId?: string;
  environment?: string;
  selectAll?: boolean;
  lastErrorAt?: string;
  purge?: boolean;
}

export async function triggerErrorRetry(
  errorIdOrOptions: string | RetryOptions, 
  flowId?: string,
  stepId?: string,
  retryDataKey?: string
): Promise<{ success: boolean; message: string; timestamp: string; job?: any }> {
  try {
    const payload = typeof errorIdOrOptions === 'object'
      ? errorIdOrOptions
      : { errorId: errorIdOrOptions, flowId, stepId, retryDataKey: retryDataKey || errorIdOrOptions };

    const response = await fetch('/api/celigo/retry-errors', {
      method: 'POST',
      headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const errMsg = errBody?.error || errBody?.message || response.statusText || 'Failed to retry error';
      return { success: false, message: errMsg, timestamp: new Date().toLocaleTimeString() };
    }
    const data = await response.json();
    return {
      success: data.success,
      message: data.message || `Dispatched retry for error`,
      job: data.job,
      timestamp: data.timestamp || new Date().toLocaleTimeString(),
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error', timestamp: new Date().toLocaleTimeString() };
  }
}

export async function triggerBatchRetry(
  errorIdsOrOptions: string[] | RetryOptions, 
  flowId?: string, 
  stepId?: string
): Promise<{ success: boolean; count: number; message: string; timestamp: string; job?: any }> {
  try {
    const payload = Array.isArray(errorIdsOrOptions)
      ? { errorIds: errorIdsOrOptions, flowId, stepId }
      : errorIdsOrOptions;

    const response = await fetch('/api/celigo/retry-errors', {
      method: 'POST',
      headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const errMsg = errBody?.error || errBody?.message || response.statusText || 'Failed to retry errors';
      return { success: false, count: 0, message: errMsg, timestamp: new Date().toLocaleTimeString() };
    }
    const data = await response.json();
    return {
      success: data.success,
      count: data.count || (payload.errorIds ? payload.errorIds.length : 1),
      message: data.message || `Dispatched batch retry`,
      job: data.job,
      timestamp: data.timestamp || new Date().toLocaleTimeString(),
    };
  } catch (err: any) {
    return { success: false, count: 0, message: err.message || 'Network error', timestamp: new Date().toLocaleTimeString() };
  }
}

export async function triggerErrorResolve(
  errorIdOrOptions: string | ResolveOptions, 
  flowId?: string, 
  purge = false,
  stepId?: string
): Promise<{ success: boolean; message: string; timestamp: string }> {
  try {
    const payload = typeof errorIdOrOptions === 'object'
      ? errorIdOrOptions
      : { errorId: errorIdOrOptions, flowId, purge, stepId };

    const response = await fetch('/api/celigo/resolve-errors', {
      method: 'POST',
      headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const errMsg = errBody?.error || errBody?.message || response.statusText || 'Failed to resolve error';
      return { success: false, message: errMsg, timestamp: new Date().toLocaleTimeString() };
    }
    const data = await response.json();
    return {
      success: data.success,
      message: data.message || `Marked error as resolved in Celigo`,
      timestamp: data.timestamp || new Date().toLocaleTimeString(),
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error', timestamp: new Date().toLocaleTimeString() };
  }
}

export async function triggerBatchResolve(
  errorIdsOrOptions: string[] | ResolveOptions, 
  flowId?: string, 
  purge = false,
  stepId?: string
): Promise<{ success: boolean; count: number; message: string; timestamp: string }> {
  try {
    const payload = Array.isArray(errorIdsOrOptions)
      ? { errorIds: errorIdsOrOptions, flowId, purge, stepId }
      : errorIdsOrOptions;

    const response = await fetch('/api/celigo/resolve-errors', {
      method: 'POST',
      headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const errMsg = errBody?.error || errBody?.message || response.statusText || 'Failed to resolve errors';
      return { success: false, count: 0, message: errMsg, timestamp: new Date().toLocaleTimeString() };
    }
    const data = await response.json();
    return {
      success: data.success,
      count: data.count || (payload.errorIds ? payload.errorIds.length : 1),
      message: data.message || `Marked errors as resolved in Celigo`,
      timestamp: data.timestamp || new Date().toLocaleTimeString(),
    };
  } catch (err: any) {
    return { success: false, count: 0, message: err.message || 'Network error', timestamp: new Date().toLocaleTimeString() };
  }
}

export async function verifyErrorStatus(
  flowId: string,
  stepId: string,
  errorIds: string[]
): Promise<{ success: boolean; allResolved: boolean; stillPresentIds: string[]; checkedCeligo?: boolean }> {
  try {
    const params = new URLSearchParams({ 
      flowId, 
      stepId, 
      errorIds: errorIds.join(',') 
    });

    const response = await fetch(`/api/celigo/verify-error-status?${params.toString()}`, {
      headers: getCeligoHeaders(),
    });
    if (!response.ok) {
      return { success: false, allResolved: false, stillPresentIds: errorIds };
    }
    return await response.json();
  } catch (err: any) {
    return { success: false, allResolved: false, stillPresentIds: errorIds };
  }
}

export async function fetchSnapshotData(
  flowId: string, 
  retryDataKey: string, 
  stepId?: string
): Promise<{ success: boolean; envelope?: any; error?: string; source?: 'live' | 'simulation' }> {
  try {
    const params = new URLSearchParams({ flowId, retryDataKey });
    if (stepId) params.append('stepId', stepId);

    const response = await fetch(`/api/celigo/snapshot-data?${params.toString()}`, {
      headers: getCeligoHeaders(),
    });
    if (!response.ok) {
      return { success: false, error: response.statusText };
    }
    return await response.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch snapshot' };
  }
}

export async function updateSnapshotData(
  flowId: string, 
  retryDataKey: string, 
  envelope: any, 
  stepId?: string
): Promise<{ success: boolean; message?: string; error?: string; liveUpdated?: boolean }> {
  try {
    const response = await fetch('/api/celigo/snapshot-data', {
      method: 'PUT',
      headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId, retryDataKey, envelope, stepId }),
    });
    if (!response.ok) {
      return { success: false, error: response.statusText };
    }
    return await response.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update snapshot' };
  }
}

export async function checkErrorActionability(errorIds: string[], flowId?: string) {
  try {
    const response = await fetch('/api/celigo/errors/check-actionable', {
      method: 'POST',
      headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorIds, flowId }),
    });
    if (!response.ok) return { success: false, capabilities: [] };
    return await response.json();
  } catch {
    return { success: false, capabilities: [] };
  }
}

export async function fetchCeligoHealth(): Promise<{
  status: string;
  celigoConnected: boolean;
  prodConnected?: boolean;
  sandboxConnected?: boolean;
  celigoStack: string;
  celigoMcpAvailable: boolean;
}> {
  try {
    const res = await fetch('/api/health', {
      headers: getCeligoHeaders(),
    });
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'error', celigoConnected: false, prodConnected: false, sandboxConnected: false, celigoStack: 'us', celigoMcpAvailable: false };
  }
}

export async function fetchLiveFlows(): Promise<{
  connected: boolean;
  prodConnected?: boolean;
  sandboxConnected?: boolean;
  count?: number;
  totalCount?: number;
  prodFlowCount?: number;
  sandboxFlowCount?: number;
  flows: any[];
  integrations?: import("../types/celigo").CeligoIntegration[];
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/celigo/live-flows', {
      headers: getCeligoHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch live flows');
    return await res.json();
  } catch (err: any) {
    return { connected: false, flows: [], error: err.message };
  }
}

export async function fetchLiveErrors(): Promise<{
  connected: boolean;
  prodConnected?: boolean;
  sandboxConnected?: boolean;
  count?: number;
  totalCount?: number;
  prodErrorCount?: number;
  sandboxErrorCount?: number;
  errors: any[];
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/celigo/live-errors', {
      headers: getCeligoHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch live errors');
    return await res.json();
  } catch (err: any) {
    return { connected: false, errors: [], error: err.message };
  }
}

export async function fetchFlowErrors(flowId: string): Promise<{
  connected: boolean;
  errors: CeligoErrorRecord[];
  flowErrors?: any[];
  error?: string;
}> {
  try {
    const res = await fetch(`/api/celigo/flow-errors/${flowId}`, {
      headers: getCeligoHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch errors for flow ${flowId}`);
    return await res.json();
  } catch (err: any) {
    return { connected: false, errors: [], error: err.message };
  }
}

export async function executeCliCommand(command: string): Promise<{
  command: string;
  output: string;
  status: 'success' | 'warning' | 'error';
  timestamp: string;
}> {
  const response = await fetch('/api/celigo/cli-exec', {
    method: 'POST',
    headers: { ...getCeligoHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute CLI command: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
