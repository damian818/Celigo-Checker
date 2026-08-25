import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set. Using intelligent rule-based Celigo fallback.');
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    return aiClient;
  } catch (err) {
    console.error('Error initializing GoogleGenAI:', err);
    return null;
  }
}

// Candidate models in preference order with high-throughput and flash variants
const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanJsonText(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return clean.trim();
}

async function generateContentWithFallback(
  client: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  }
): Promise<{ text?: string }> {
  let lastError: any = null;

  for (const model of TEXT_MODELS) {
    // Attempt with retry on 503 / 429
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        if (isTransient && attempt === 0) {
          await sleep(600);
          continue;
        }
        // If not recoverable or 2nd attempt, proceed to next model in list
        break;
      }
    }
  }

  throw lastError || new Error('All model attempts failed');
}

export interface ErrorAnalysisResult {
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

export async function analyzeCeligoErrorWithGemini(errorData: {
  rawErrorCode: string;
  rawErrorMessage: string;
  flowName: string;
  sourceApp: string;
  targetApp: string;
  rawPayload: any;
  mappingFieldFailed?: string;
}): Promise<ErrorAnalysisResult> {
  const client = getGeminiClient();

  const prompt = `You are a Principal Integration Engineer and Celigo integrator.io Expert specializing in translating complex ERP/CRM errors into plain English for non-technical business stakeholders (finance, sales ops, warehouse) and generating actionable Celigo CLI commands (https://developer.celigo.com/cli) and Celigo MCP queries (https://developer.celigo.com/mcp) for IT Support staff.

Analyze the following Celigo integration error:
- Flow Name: ${errorData.flowName}
- Source Application: ${errorData.sourceApp}
- Target Application: ${errorData.targetApp}
- Error Code: ${errorData.rawErrorCode}
- Error Message: ${errorData.rawErrorMessage}
- Failed Mapping Field: ${errorData.mappingFieldFailed || 'N/A'}
- Raw Payload Context: ${JSON.stringify(errorData.rawPayload, null, 2)}

Provide your response in JSON with the following exact keys:
{
  "plainEnglishSummary": "2-3 sentences in simple non-technical terms describing what failed and which business document is affected",
  "businessImpact": "The real business impact (e.g. invoice not posted, shipment delayed, customer account blocked)",
  "rootCause": "Clear explanation of why this happened in 1-2 sentences",
  "actionRequiredBy": "One of: Accounting, Sales Ops, IT Support, Warehouse, Customer Success",
  "retrySafety": "One of: safe, verify_data, manual_intervention",
  "retrySafetyReason": "Detailed reason why it is safe or unsafe to retry immediately",
  "suggestedCliCommand": "Exact celigo-cli command (e.g. celigo flows:retry-errors --flowId ...)",
  "suggestedRemediationScript": "JavaScript preSavePage or postMap hook or Celigo handlebars expression to fix the data structure",
  "jiraTroubleshootingSteps": [
    "Step 1: Exactly what to check in source or target system",
    "Step 2: What field value to correct",
    "Step 3: Verification step",
    "Step 4: Celigo CLI or Hub retry instruction"
  ],
  "mcpToolToExecute": "celigo_retry_flow_errors or celigo_inspect_mapping or celigo_test_connection"
}

Respond ONLY with valid JSON.`;

  if (client) {
    try {
      const response = await generateContentWithFallback(client, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = cleanJsonText(response.text || '');
      const parsed = JSON.parse(text);
      return {
        plainEnglishSummary: parsed.plainEnglishSummary || 'Integration sync halted due to data validation error.',
        businessImpact: parsed.businessImpact || 'Record processing delayed in target system.',
        rootCause: parsed.rootCause || errorData.rawErrorMessage,
        actionRequiredBy: parsed.actionRequiredBy || 'IT Support',
        retrySafety: parsed.retrySafety || 'verify_data',
        retrySafetyReason: parsed.retrySafetyReason || 'Verify required fields before replaying.',
        suggestedCliCommand: parsed.suggestedCliCommand || `celigo flows:retry-errors --flowId <flowId>`,
        suggestedRemediationScript: parsed.suggestedRemediationScript || `// Celigo Hook\nfunction preSavePage(options) {\n  return options.data;\n}`,
        jiraTroubleshootingSteps: Array.isArray(parsed.jiraTroubleshootingSteps) ? parsed.jiraTroubleshootingSteps : [
          'Inspect the record in source system',
          'Fix the missing or invalid field',
          'Execute retry in Celigo Hub'
        ],
        mcpToolToExecute: parsed.mcpToolToExecute || 'celigo_retry_flow_errors',
      };
    } catch (err) {
      console.warn('Gemini API call returned transient error, seamlessly using heuristic rules engine:', err);
    }
  }

  // Heuristic Fallback
  return fallbackAnalyzeError(errorData);
}

export async function chatWithCeligoCopilot(
  history: { role: 'user' | 'assistant' | 'system'; content: string }[],
  userMessage: string,
  contextData?: any
): Promise<{ text: string; cliCommandSnippet?: string; scriptSnippet?: string }> {
  const client = getGeminiClient();

  const systemInstruction = `You are Celigo Copilot, an AI Integration Architect and Support Assistant for Celigo integrator.io, Celigo CLI (https://developer.celigo.com/cli), Celigo MCP tools (https://developer.celigo.com/mcp), and integrator.io REST APIs (https://developer.celigo.com/api).
You assist IT support and non-technical business users to:
1. Explain obscure NetSuite, Salesforce, Shopify, Stripe, Workday, and REST API error codes in friendly, accessible language.
2. Provide copy-paste ready Celigo CLI commands (e.g. \`celigo flows:retry-errors\`, \`celigo connections:test\`, \`celigo errors:export\`, \`celigo scripts:test\`).
3. Write clean Celigo JavaScript hooks (preSavePage, postMap, preSubmit) and Handlebars lookup helpers (e.g. \`{{lookup table key default}}\`, \`{{timestamp}}\`, \`{{join}}\`).
4. Guide users through Jira ticket creation and automated remediation steps.

Keep responses concise, clear, and structured with bold headers, step-by-step instructions, and formatted code blocks.`;

  if (client) {
    try {
      const messagesFormatted = history.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      const prompt = `${messagesFormatted}\n\nContext Data:\n${JSON.stringify(contextData || {}, null, 2)}\n\nUser Question: ${userMessage}\n\nProvide an expert, helpful answer with actionable Celigo CLI commands and hook snippets where appropriate.`;

      const response = await generateContentWithFallback(client, {
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      const responseText = response.text || 'I analyzed your request. How else can I assist with your Celigo integrations?';

      // Extract CLI commands or scripts if present
      let cliCommandSnippet: string | undefined;
      let scriptSnippet: string | undefined;

      const cliMatch = responseText.match(/`celigo [^`]+`/);
      if (cliMatch) {
        cliCommandSnippet = cliMatch[0].replace(/`/g, '');
      }

      const scriptMatch = responseText.match(/```(?:javascript|js)\n([\s\S]*?)```/);
      if (scriptMatch) {
        scriptSnippet = scriptMatch[1].trim();
      }

      return {
        text: responseText,
        cliCommandSnippet,
        scriptSnippet,
      };
    } catch (err) {
      console.warn('Gemini chat returned transient error, using fallback response:', err);
    }
  }

  return {
    text: `**Celigo Diagnostic Summary**\n\nI analyzed your query: "${userMessage}".\n\n- **Recommended Next Step**: Check the connection health status in Celigo integrator.io and inspect the raw record payload.\n- **Celigo CLI Action**: Run the diagnostic command below to tail live execution logs.`,
    cliCommandSnippet: `celigo flows:inspect --flowId flow_ns_sf_invoices --verbose`,
    scriptSnippet: `// Celigo Hook snippet\nfunction preSavePage(options) {\n  return options.data.map(rec => {\n    // custom validation logic\n    return rec;\n  });\n}`,
  };
}

function fallbackAnalyzeError(errorData: {
  rawErrorCode: string;
  rawErrorMessage: string;
  flowName: string;
  sourceApp: string;
  targetApp: string;
  rawPayload: any;
  mappingFieldFailed?: string;
}): ErrorAnalysisResult {
  const code = errorData.rawErrorCode.toUpperCase();
  const msg = errorData.rawErrorMessage.toLowerCase();

  if (code.includes('INVALID_KEY') || msg.includes('tax') || msg.includes('subsidiary')) {
    return {
      plainEnglishSummary: `The target system (${errorData.targetApp}) could not process this record because a linked account, tax ID, or subsidiary reference is missing.`,
      businessImpact: `Transaction posting is temporarily blocked in ${errorData.targetApp}.`,
      rootCause: `Entity reference or tax registration lookup returned no match.`,
      actionRequiredBy: 'Accounting',
      retrySafety: 'verify_data',
      retrySafetyReason: 'Update the missing reference on the customer or item record before clicking retry.',
      suggestedCliCommand: `celigo flows:retry-errors --flowId <flowId> --skipValidation=false`,
      suggestedRemediationScript: `// Celigo Hook Fallback\nfunction preSavePage(options) {\n  return options.data.map(item => {\n    if (!item.taxCode) item.taxCode = 'DEFAULT_TAX';\n    return item;\n  });\n}`,
      jiraTroubleshootingSteps: [
        `Open ${errorData.sourceApp} record and check tax/subsidiary settings.`,
        `Verify internal ID matches in ${errorData.targetApp}.`,
        `Execute Celigo retry in Hub or terminal.`
      ],
      mcpToolToExecute: 'celigo_inspect_mapping',
    };
  }

  if (code.includes('401') || msg.includes('token') || msg.includes('unauthorized')) {
    return {
      plainEnglishSummary: `Communication with ${errorData.sourceApp} / ${errorData.targetApp} was rejected because the API authorization token or security certificate has expired.`,
      businessImpact: `All scheduled sync jobs for this integration are paused until re-authenticated.`,
      rootCause: `OAuth 2.0 Access Token or TBA signature is no longer valid.`,
      actionRequiredBy: 'IT Support',
      retrySafety: 'manual_intervention',
      retrySafetyReason: 'Connection must be re-authorized with admin credentials before retrying.',
      suggestedCliCommand: `celigo connections:test --id <connId> && celigo auth:refresh --id <connId>`,
      suggestedRemediationScript: `// Re-authenticate via CLI:\nceligo connections:update <connId> --authType oauth2`,
      jiraTroubleshootingSteps: [
        `Navigate to Celigo integrator.io Connections tab.`,
        `Click Authorize on connection and complete OAuth login.`,
        `Verify connection status turns green.`,
        `Resume flow and replay pending error queue.`
      ],
      mcpToolToExecute: 'celigo_test_connection',
    };
  }

  if (code.includes('429') || msg.includes('limit') || msg.includes('rate')) {
    return {
      plainEnglishSummary: `The target service (${errorData.targetApp}) received too many requests in a short timeframe and asked Celigo to pause briefly.`,
      businessImpact: `Minor delivery delay; records will resume automatically without data loss.`,
      rootCause: `Hourly or per-second API quota saturated by concurrent operations.`,
      actionRequiredBy: 'IT Support',
      retrySafety: 'safe',
      retrySafetyReason: '100% safe to retry. Data is valid; will succeed as soon as the API rate-limit window resets.',
      suggestedCliCommand: `celigo flows:retry-errors --flowId <flowId> --delay 120`,
      suggestedRemediationScript: `// Celigo Concurrency Tuning:\nceligo flows:update --id <flowId> --concurrency 2`,
      jiraTroubleshootingSteps: [
        `Verify API usage in ${errorData.targetApp} Developer Dashboard.`,
        `Ensure no rogue batch scripts are consuming API quota.`,
        `Retry errors with exponential backoff.`
      ],
      mcpToolToExecute: 'celigo_retry_flow_errors',
    };
  }

  return {
    plainEnglishSummary: `An unexpected data discrepancy occurred while transferring records between ${errorData.sourceApp} and ${errorData.targetApp}.`,
    businessImpact: `1 record held in Celigo error quarantine to prevent downstream data corruption.`,
    rootCause: errorData.rawErrorMessage || 'Data schema validation constraint violation.',
    actionRequiredBy: 'IT Support',
    retrySafety: 'verify_data',
    retrySafetyReason: 'Inspect the raw payload to confirm all required fields are present.',
    suggestedCliCommand: `celigo flows:retry-errors --flowId <flowId>`,
    suggestedRemediationScript: `// Celigo Data Sanitization Hook\nfunction preSavePage(options) {\n  return options.data;\n}`,
    jiraTroubleshootingSteps: [
      `Review error payload in Celigo Error Inspector.`,
      `Validate field mapping in integrator.io Flow Builder.`,
      `Test mapping with sample payload and retry record.`
    ],
    mcpToolToExecute: 'celigo_inspect_mapping',
  };
}
