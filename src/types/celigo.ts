export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorCategory = string;
export type FlowStatus = string;
export type RetrySafety = string;
export type EnvironmentType = string;

export interface CeligoIntegration {
  id?: string;
  name?: string;
  environment?: EnvironmentType;
  environmentLabel?: string;
  celigoUrl?: string;
  totalFlows?: number;
  healthyFlows?: number;
  criticalFlows?: number;
  degradedFlows?: number;
  totalErrors?: number;
  totalThroughput?: number;
  [key: string]: any;
}

export interface CeligoErrorRecord {
  id?: string;
  flowId?: string;
  flowName?: string;
  flowType?: 'VMAC' | 'JE' | 'Other';
  companyName?: string;
  formattedSummary?: string;
  integrationId?: string;
  integrationName?: string;
  sectionId?: string;
  environment?: EnvironmentType;
  celigoUrl?: string;
  sourceApp?: any;
  targetApp?: any;
  timestamp?: string;
  recordIdentifier?: string;
  recordType?: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  rawErrorCode?: string;
  rawErrorMessage?: string;
  httpStatus?: number;
  retryCount?: number;
  maxRetries?: number;
  status?: string;
  plainEnglishSummary?: string;
  businessImpact?: string;
  estimatedRiskAmount?: string;
  rootCauseSimple?: string;
  actionRequiredBy?: string;
  retrySafety?: RetrySafety;
  retrySafetyReason?: string;
  canRetry?: boolean;
  canResolve?: boolean;
  actionType?: 'both' | 'retry_only' | 'resolve_only';
  resolutionMethod?: 'retried' | 'purged' | 'manual';
  retryableReason?: string;
  retryDataKey?: string;
  exportOrImportId?: string;
  stepId?: string;
  classification?: string;
  lastErrorAt?: string;
  snapshotEnvelope?: Record<string, any>;
  rawPayload?: Record<string, any>;
  mappingFieldFailed?: string;
  suggestedCliCommand?: string;
  suggestedRemediationScript?: string;
  jiraTicketId?: string;
  jiraTicketUrl?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  [key: string]: any;
}

export interface CeligoFlow {
  id?: string;
  name?: string;
  description?: string;
  status?: FlowStatus;
  group?: string;
  integrationId?: string;
  integrationName?: string;
  sectionId?: string;
  environment?: EnvironmentType;
  environmentLabel?: string;
  celigoUrl?: string;
  sourceApp?: any;
  targetApp?: any;
  lastRunTime?: string;
  scheduleType?: string;
  recordsProcessed24h?: number;
  errorCount24h?: number;
  unresolvedErrors?: number;
  avgLatencyMs?: number;
  [key: string]: any;
}

export interface JiraTicket {
  id?: string;
  key?: string;
  summary?: string;
  status?: string;
  url?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface AlertRule {
  id?: string;
  name?: string;
  enabled?: boolean;
  channel?: string;
  threshold?: number;
  [key: string]: any;
}

export interface ChatMessage {
  id?: string;
  sender?: string;
  text?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface KnowledgeBaseEntry {
  id?: string;
  title?: string;
  content?: string;
  category?: string;
  [key: string]: any;
}

export interface NotificationPayload {
  recipient?: string;
  message?: string;
  [key: string]: any;
}
