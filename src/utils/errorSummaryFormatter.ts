/**
 * Error Summary Formatter Utility
 * 
 * Implements the standard naming convention:
 * "VMAC/JE/Other _Error: [Name] > Short error description"
 * 
 * Examples:
 * - VMAC_Error: [Internal Test Account] > Vendor tax ID validation failed
 * - JE_Error: [NetSuite Integration] > GL Account period is locked
 * - Other_Error: [Salesforce Sync] > Duplicate customer email record
 */

export type FlowClassificationType = 'VMAC' | 'JE' | 'Other';

/**
 * Identifies whether a flow or error record is related to VMAC (Vendor Master / AP / Bills),
 * JE (Journal Entry / GL / Accruals), or Other.
 */
export function identifyFlowType(recordOrFlow: any): FlowClassificationType {
  if (!recordOrFlow) return 'Other';

  // Check explicit properties if present
  if (recordOrFlow.flowType && ['VMAC', 'JE', 'Other'].includes(recordOrFlow.flowType)) {
    return recordOrFlow.flowType as FlowClassificationType;
  }

  // Aggregate all possible text identifiers
  const textsToScan: string[] = [
    typeof recordOrFlow === 'string' ? recordOrFlow : '',
    recordOrFlow.flowName || '',
    recordOrFlow.name || '',
    recordOrFlow.group || '',
    recordOrFlow.description || '',
    recordOrFlow.integrationName || '',
    recordOrFlow.recordType || '',
    recordOrFlow.rawErrorCode || '',
    recordOrFlow.rawErrorMessage || '',
    recordOrFlow.plainEnglishSummary || '',
    recordOrFlow.category || '',
    typeof recordOrFlow.sourceApp === 'string' ? recordOrFlow.sourceApp : (recordOrFlow.sourceApp?.name || ''),
    typeof recordOrFlow.targetApp === 'string' ? recordOrFlow.targetApp : (recordOrFlow.targetApp?.name || ''),
  ].filter(Boolean);

  const combined = textsToScan.join(' ').toLowerCase();

  // 1. VMAC Detection (Vendor Master Action Center, Vendors, Bills, AP, Suppliers, Purchase Orders)
  const vmacPattern = /\b(vmac|vendor|vendors|vendormaster|supplier|suppliers|supplier_portal|bills?|ap_invoice|ap_invoices|purchase_orders?|po_sync|vendor_sync|bill_payments?)\b/i;
  
  // 2. JE Detection (Journal Entries, General Ledger, GL, Accruals, Accounting Books, Adjusting Journals)
  const jePattern = /\b(je|journal|journals|journal\s*entry|journal_entries|journal_entry|journal_postings?|general\s*ledger|gl|accrual|accruals|accrual_cloud|adjusting_journal|ledger_postings?)\b/i;

  const isVmac = vmacPattern.test(combined);
  const isJe = jePattern.test(combined);

  if (isVmac && !isJe) {
    return 'VMAC';
  }
  if (isJe && !isVmac) {
    return 'JE';
  }
  if (isVmac && isJe) {
    // If both match, check priority based on flowName
    const flowNameLower = (recordOrFlow.flowName || recordOrFlow.name || '').toLowerCase();
    if (vmacPattern.test(flowNameLower)) return 'VMAC';
    if (jePattern.test(flowNameLower)) return 'JE';
    return 'VMAC'; // default to VMAC if vendor related
  }

  return 'Other';
}

/**
 * Extracts company name or integration name from record metadata.
 */
export function getCompanyNameOrIntegration(recordOrFlow: any, fallbackName = 'Gappify Enterprise'): string {
  if (!recordOrFlow) return fallbackName;

  if (typeof recordOrFlow === 'string') return recordOrFlow;

  // Check explicit customer/company fields
  if (recordOrFlow.companyName && typeof recordOrFlow.companyName === 'string' && recordOrFlow.companyName.trim()) {
    return recordOrFlow.companyName.trim();
  }
  if (recordOrFlow.gpfyCustomerName && typeof recordOrFlow.gpfyCustomerName === 'string' && recordOrFlow.gpfyCustomerName.trim()) {
    return recordOrFlow.gpfyCustomerName.trim();
  }

  // Check integration name
  if (recordOrFlow.integrationName && typeof recordOrFlow.integrationName === 'string' && recordOrFlow.integrationName.trim()) {
    const intg = recordOrFlow.integrationName.trim();
    if (intg !== 'Enterprise Integrations' && intg !== 'Celigo Integration' && intg !== 'Default Integration') {
      return intg;
    }
  }

  // Check flow group or bracketed tag e.g. "[Acme Corp] NetSuite Sync"
  const flowName = recordOrFlow.flowName || recordOrFlow.name || '';
  const bracketMatch = flowName.match(/^\[(.*?)\]/);
  if (bracketMatch && bracketMatch[1]) {
    return bracketMatch[1].trim();
  }

  if (recordOrFlow.group && typeof recordOrFlow.group === 'string' && recordOrFlow.group.trim()) {
    return recordOrFlow.group.trim();
  }

  if (recordOrFlow.integrationName && typeof recordOrFlow.integrationName === 'string' && recordOrFlow.integrationName.trim()) {
    return recordOrFlow.integrationName.trim();
  }

  return fallbackName;
}

/**
 * Extracts a short, clean, human-readable error description without noisy prefixes.
 */
export function getShortErrorDescription(record: any): string {
  if (!record) return 'Integration payload error';

  if (typeof record === 'string') {
    return cleanErrorDescription(record);
  }

  // 1. Prefer plainEnglishSummary if available and concise
  if (record.plainEnglishSummary && typeof record.plainEnglishSummary === 'string') {
    const cleaned = cleanErrorDescription(record.plainEnglishSummary);
    if (cleaned.length > 5 && cleaned.length < 120) return cleaned;
    if (cleaned.length >= 120) {
      // Return first complete sentence
      const firstSentence = cleaned.split(/[.!?]\s+/)[0];
      if (firstSentence && firstSentence.length > 5 && firstSentence.length < 100) {
        return firstSentence.trim();
      }
      return cleaned.slice(0, 95).trim() + '...';
    }
  }

  // 2. Root cause simple
  if (record.rootCauseSimple && typeof record.rootCauseSimple === 'string') {
    const cleaned = cleanErrorDescription(record.rootCauseSimple);
    if (cleaned.length > 5 && cleaned.length < 100) return cleaned;
  }

  // 3. Raw Error Message
  if (record.rawErrorMessage && typeof record.rawErrorMessage === 'string') {
    return cleanErrorDescription(record.rawErrorMessage);
  }

  // 4. Raw Error Code
  if (record.rawErrorCode && typeof record.rawErrorCode === 'string') {
    return record.rawErrorCode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  return 'Data mapping or API rejection';
}

/**
 * Cleans up raw error strings, removing boilerplate and HTML/JSON formatting.
 */
function cleanErrorDescription(raw: string): string {
  if (!raw) return 'Integration synchronization error';

  let text = String(raw).trim();

  // Strip leading prefixes like "Integration "..." encountered ...", "Failed to process record ...: ", "Error: "
  text = text.replace(/^Integration\s+["'][^"']+["']\s+(has|encountered)\s+\d+\s+unresolved\s+error\(s\)[^:]*:\s*/i, '');
  text = text.replace(/^Failed\s+to\s+process\s+record\s+\([^)]+\)\s+in\s+step\s+\[[^\]]+\]:\s*/i, '');
  text = text.replace(/^Error:\s*/i, '');
  text = text.replace(/^(Celigo|Integrator\.io)\s+Error:\s*/i, '');
  text = text.replace(/^\{.*"message":\s*"([^"]+)".*\}$/, '$1');

  // Strip bracketed prefixes e.g. "[INVALID_FLD] "
  text = text.replace(/^\[[A-Z0-9_-]+\]\s*/i, '');

  // Strip excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();

  if (!text) return 'Integration synchronization error';

  // Capitalize first character
  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (text.length > 100) {
    text = text.slice(0, 97).trim() + '...';
  }

  return text;
}

/**
 * Formats standard Error Summary according to:
 * "VMAC/JE/Other _Error: [Name] > Short error description"
 * 
 * Format:
 * `${flowType}_Error: [${companyNameOrIntegration}] > ${shortErrorDescription}`
 */
export function formatErrorSummary(
  recordOrFlow: any,
  customCompanyName?: string,
  customShortDesc?: string
): string {
  const flowType = identifyFlowType(recordOrFlow);
  const companyName = customCompanyName && customCompanyName.trim()
    ? customCompanyName.trim()
    : getCompanyNameOrIntegration(recordOrFlow);
  const shortDesc = customShortDesc && customShortDesc.trim()
    ? cleanErrorDescription(customShortDesc)
    : getShortErrorDescription(recordOrFlow);

  return `${flowType}_Error: [${companyName}] > ${shortDesc}`;
}

/**
 * Styling helper for the flow classification badge
 */
export function getFlowTypeBadgeStyle(type: FlowClassificationType): {
  bg: string;
  text: string;
  border: string;
  pillClass: string;
  label: string;
  iconText: string;
} {
  switch (type) {
    case 'VMAC':
      return {
        bg: 'bg-purple-500/15',
        text: 'text-purple-300',
        border: 'border-purple-500/30',
        pillClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
        label: 'VMAC',
        iconText: 'Vendor / AP',
      };
    case 'JE':
      return {
        bg: 'bg-cyan-500/15',
        text: 'text-cyan-300',
        border: 'border-cyan-500/30',
        pillClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        label: 'JE',
        iconText: 'Journal Entry / GL',
      };
    case 'Other':
    default:
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-300',
        border: 'border-blue-500/30',
        pillClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
        label: 'Other',
        iconText: 'Integration Flow',
      };
  }
}
