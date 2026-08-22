import { KnowledgeBaseEntry } from '../types/celigo';

export const CELIGO_KNOWLEDGE_BASE: KnowledgeBaseEntry[] = [
  {
    id: 'kb_ns_rcrd_changed',
    title: 'NetSuite RCRD_HAS_BEEN_CHANGED (Record Concurrency Collision)',
    category: 'duplicate_record',
    app: 'NetSuite ERP',
    errorCode: 'RCRD_HAS_BEEN_CHANGED',
    plainSummary: 'Another user, background script, or automated job updated the NetSuite record while Celigo was trying to save changes to it.',
    technicalDetails: 'NetSuite SuiteScript locks records during execution. If two concurrent threads attempt to mutate the same record version, NetSuite throws RCRD_HAS_BEEN_CHANGED to prevent dirty writes.',
    commonCauses: [
      'Celigo Flow concurrency setting is set too high (e.g. 10+ concurrent threads).',
      'A SuiteScript User Event script or Map/Reduce script is actively running on the record.',
      'A human user in the NetSuite UI edited and saved the customer/order simultaneously.'
    ],
    stepByStepRemediation: [
      'Verify whether the record was successfully updated by the competing process in NetSuite.',
      'If not updated, retry the record in Celigo Hub using the One-Click Retry button.',
      'If this error occurs frequently, reduce flow concurrency in Celigo Flow Settings from 10 to 2 or 4.',
      'Alternatively, configure exponential retry backoff in Celigo export settings.'
    ],
    cliFixCommand: 'celigo flows:update --id <flowId> --concurrency 2 && celigo flows:retry-errors --flowId <flowId>',
    hookSnippet: `// Celigo preSavePage Hook to add timestamp jitter\nfunction preSavePage(options) {\n  // sleep jitter if needed\n  return options.data;\n}`
  },
  {
    id: 'kb_ns_invalid_key',
    title: 'NetSuite INVALID_KEY_OR_REF (Missing Subsidiary or Entity Reference)',
    category: 'data_validation',
    app: 'NetSuite ERP',
    errorCode: 'INVALID_KEY_OR_REF',
    plainSummary: 'Celigo is attempting to link a record (like a Customer, Vendor, or Currency) to an internal NetSuite ID that does not exist in the designated subsidiary.',
    technicalDetails: 'Occurs when an external lookup fails, a required multi-subsidiary relation is missing, or a static ID mapping points to a deleted Sandbox record.',
    commonCauses: [
      'Customer record is not assigned to the NetSuite subsidiary specified on the transaction.',
      'Field mapping references a hardcoded Sandbox Internal ID rather than a dynamic lookup.',
      'Item or Currency has been marked as Inactive in NetSuite.'
    ],
    stepByStepRemediation: [
      'Locate the Entity or Item ID reported in the error message.',
      'Check in NetSuite (Lists > Relationships > Customers) to ensure the entity is active and assigned to the right subsidiary.',
      'If using Celigo dynamic mapping, verify that the Lookup Field expression matches the external key.'
    ],
    cliFixCommand: 'celigo mappings:test --flowId <flowId> --field "entity.internalId" --value "<external_id>"'
  },
  {
    id: 'kb_sf_duplicate',
    title: 'Salesforce DUPLICATE_VALUE / Duplicate Rule Detected',
    category: 'duplicate_record',
    app: 'Salesforce CRM',
    errorCode: 'DUPLICATE_VALUE',
    plainSummary: 'Salesforce blocked creating a new Contact or Account because a record with the same email or tax ID already exists.',
    technicalDetails: 'Salesforce Duplicate Management Rules or Unique Field constraints (such as an External_ID__c field) rejected the insert operation.',
    commonCauses: [
      'Lead or Contact already exists in Salesforce with identical email.',
      'Celigo import is configured to "Insert" instead of "Upsert (Insert or Update)".'
    ],
    stepByStepRemediation: [
      'Change Celigo Import operation from "Add" to "Add or Update (Upsert)" using External ID.',
      'Review Salesforce Matching & Duplicate Rules in Setup > Duplicate Rules.',
      'Replay the error record.'
    ],
    cliFixCommand: 'celigo imports:update --id <importId> --operationType "upsert" --matchField "Email"'
  },
  {
    id: 'kb_shopify_429',
    title: 'Shopify Plus / REST API 429 Too Many Requests (Rate Limit)',
    category: 'rate_limit',
    app: 'Shopify Plus',
    errorCode: 'HTTP_429_TOO_MANY_REQUESTS',
    plainSummary: 'Celigo sent requests faster than the Shopify API quota allows (leaky bucket rate limit exceeded).',
    technicalDetails: 'Shopify allows 2 to 4 requests per second per standard storefront or 20 calls/sec for Shopify Plus. Exceeding this triggers HTTP 429 with a "Retry-After" header.',
    commonCauses: [
      'Multiple Celigo flows running simultaneously against the same Shopify store.',
      'Third-party marketing or inventory apps consuming Shopify API budget at the same time.'
    ],
    stepByStepRemediation: [
      'Enable "Auto-retry on 429" with exponential backoff in Celigo connection settings.',
      'Spread out scheduled flow execution intervals (e.g. staggering by 10 minutes).',
      'The records are completely safe to retry once the rate-limit window resets.'
    ],
    cliFixCommand: 'celigo connections:update <connId> --rateLimit 10 --autoRetry=true'
  },
  {
    id: 'kb_auth_token_expired',
    title: 'OAuth 2.0 Token Revoked or Certificate Expired (HTTP 401)',
    category: 'authentication',
    app: 'General / REST / Workday / NetSuite',
    errorCode: 'AUTH_TOKEN_EXPIRED / 401',
    plainSummary: 'The connection credentials, API secret key, or OAuth certificate used to talk to the external system have expired or been revoked.',
    technicalDetails: 'The remote system rejected the Authorization Bearer header or TBA signature. Refresh token grant failed or security policy forced re-login.',
    commonCauses: [
      'Admin password changed or MFA policy refreshed.',
      'Scheduled 90-day API token expiration reached in external SaaS.',
      'Celigo TBA token secret was rotated without updating integrator.io.'
    ],
    stepByStepRemediation: [
      'Open Celigo Connections menu.',
      'Click "Authorize" or "Test Connection" on the affected connection.',
      'Log into the target platform with Admin credentials to generate a fresh token.',
      'Resume the flow and retry queued records.'
    ],
    cliFixCommand: 'celigo connections:test --id <connId> && celigo auth:refresh --id <connId>'
  },
  {
    id: 'kb_handlebars_syntax',
    title: 'Celigo Handlebars Expression Parse Error',
    category: 'script_exception',
    app: 'Celigo integrator.io',
    errorCode: 'HANDLEBARS_SYNTAX_ERROR',
    plainSummary: 'A custom formula or transformation rule in Celigo contains a typo in the handlebars curly braces.',
    technicalDetails: 'The Celigo Handlebars parser failed while compiling a field transformation template (e.g. unclosed {{#if}}, misspelled helper, or invalid JSON dot-path).',
    commonCauses: [
      'Missing closing bracket `}}` or unclosed block `{{/if}}`.',
      'Referencing a nested object property that is undefined without null-safe operator.'
    ],
    stepByStepRemediation: [
      'Inspect the failed mapping expression in Celigo Flow Builder.',
      'Use the built-in Celigo Expression Previewer to test against sample JSON.',
      'Apply safe lookup helpers like `{{lookup field defaultVal}}`.'
    ],
    cliFixCommand: 'celigo mappings:validate --flowId <flowId>'
  }
];
