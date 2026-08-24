import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CeligoErrorRecord } from '../types/celigo';

export interface UserSettings {
  userId: string;
  email?: string;
  prodToken?: string;
  sandboxToken?: string;
  celigoStack?: 'us' | 'eu';
  gchatWebhookUrl?: string;
  gmailDefaultRecipients?: string;
  gchatMessageTemplate?: string;
  gmailSubjectTemplate?: string;
  gmailBodyTemplate?: string;
  autoSyncIntervalMinutes?: number;
  updatedAt?: string;
}

export const DEFAULT_GMAIL_RECIPIENTS = 'damian@gappify.com, support@gappify.com';

export const DEFAULT_GCHAT_TEMPLATE = `🚨 *[Celigo {{severity}}] Incident Alert*
*Flow:* {{flowName}} ({{environment}})
*Record:* \`{{recordIdentifier}}\`
*Summary:* {{plainEnglishSummary}}
*Root Cause:* {{rootCauseSimple}}
*Action Required:* {{actionRequiredBy}}
*Timestamp:* {{occurredAt}}`;

export const DEFAULT_GMAIL_SUBJECT = `[Celigo {{severity}}] Incident in {{flowName}} - {{recordIdentifier}}`;

export const DEFAULT_GMAIL_BODY = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; color: #1e293b; line-height: 1.6; margin: 0 auto;">
  <div style="background-color: #0f172a; padding: 20px; border-radius: 10px 10px 0 0; color: #f8fafc;">
    <h2 style="margin: 0; font-size: 18px; color: #fb7185; display: flex; align-items: center; gap: 8px;">
      🚨 Celigo Integration Incident Alert
    </h2>
    <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">
      Automated root cause diagnosis and remediation context by Gappify Hub
    </p>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 10px 10px; background: #ffffff;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px;">
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Integration Flow:</strong></td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">{{flowName}} <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">{{environment}}</span></td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;"><strong>Record Identifier:</strong></td>
          <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-size: 12px; font-weight: bold;">{{recordIdentifier}}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;"><strong>Severity:</strong></td>
          <td style="padding: 8px 0; color: #e11d48; font-weight: bold; text-transform: uppercase;">{{severity}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;"><strong>Detected At:</strong></td>
          <td style="padding: 8px 0; color: #475569;">{{occurredAt}}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
      <div style="color: #1e293b; font-size: 13px; font-weight: 700; margin-bottom: 4px;">Plain-English Summary</div>
      <div style="font-size: 13px; color: #334155;">{{plainEnglishSummary}}</div>
    </div>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
      <div style="color: #991b1b; font-size: 13px; font-weight: 700; margin-bottom: 4px;">Root Cause & Actionable Fix</div>
      <div style="font-size: 13px; color: #7f1d1d;">{{rootCauseSimple}}</div>
      <div style="margin-top: 6px; font-size: 12px; color: #991b1b;">Responsible Team: <strong>{{actionRequiredBy}}</strong></div>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
      Dispatched via Gappify Celigo Remediation Hub • Real-Time Synchronization Across Devices
    </div>
  </div>
</div>`;

export const TEMPLATE_VARIABLES = [
  { token: '{{flowName}}', label: 'Flow Name', desc: 'e.g. NetSuite to Salesforce Customer Sync' },
  { token: '{{recordIdentifier}}', label: 'Record ID / Code', desc: 'e.g. SO-849204, CUST-1049' },
  { token: '{{severity}}', label: 'Severity Level', desc: 'CRITICAL, HIGH, MEDIUM, LOW' },
  { token: '{{environment}}', label: 'Environment', desc: 'Production or Sandbox' },
  { token: '{{plainEnglishSummary}}', label: 'Plain-English Summary', desc: 'Human-readable explanation of failure' },
  { token: '{{rootCauseSimple}}', label: 'Root Cause & Fix', desc: 'Direct root cause & actionable guidance' },
  { token: '{{actionRequiredBy}}', label: 'Responsible Entity', desc: 'e.g. Finance Ops, Salesforce Admin' },
  { token: '{{occurredAt}}', label: 'Occurred Timestamp', desc: 'Timestamp of error occurrence' },
  { token: '{{suggestedCliCommand}}', label: 'CLI Fix Command', desc: 'Remediation command string' },
];

/**
 * Replace placeholders in template with actual error record values
 */
export function interpolateTemplate(template: string, error: CeligoErrorRecord): string {
  if (!template) return '';
  return template
    .replace(/\{\{flowName\}\}/g, error.flowName || 'Integration Flow')
    .replace(/\{\{recordIdentifier\}\}/g, error.recordIdentifier || error.id || 'N/A')
    .replace(/\{\{severity\}\}/g, (error.severity || 'HIGH').toUpperCase())
    .replace(/\{\{environment\}\}/g, error.environment === 'sandbox' ? 'Sandbox' : 'Production')
    .replace(/\{\{plainEnglishSummary\}\}/g, error.plainEnglishSummary || error.message || '')
    .replace(/\{\{rootCauseSimple\}\}/g, error.rootCauseSimple || error.message || '')
    .replace(/\{\{actionRequiredBy\}\}/g, error.actionRequiredBy || 'Integration Specialist')
    .replace(/\{\{occurredAt\}\}/g, error.occurredAt || new Date().toLocaleString())
    .replace(/\{\{suggestedCliCommand\}\}/g, error.suggestedCliCommand || `celigo retry --id ${error.id}`);
}

/**
 * Save user settings to Firestore (cross-device sync)
 */
export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
  const path = `user_settings/${userId}`;
  try {
    const payload: UserSettings = {
      userId,
      email: settings.email,
      prodToken: settings.prodToken || '',
      sandboxToken: settings.sandboxToken || '',
      celigoStack: settings.celigoStack || 'us',
      gchatWebhookUrl: settings.gchatWebhookUrl || '',
      gmailDefaultRecipients: settings.gmailDefaultRecipients || DEFAULT_GMAIL_RECIPIENTS,
      gchatMessageTemplate: settings.gchatMessageTemplate || DEFAULT_GCHAT_TEMPLATE,
      gmailSubjectTemplate: settings.gmailSubjectTemplate || DEFAULT_GMAIL_SUBJECT,
      gmailBodyTemplate: settings.gmailBodyTemplate || DEFAULT_GMAIL_BODY,
      autoSyncIntervalMinutes: settings.autoSyncIntervalMinutes || 30,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'user_settings', userId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Load user settings from Firestore
 */
export async function loadUserSettings(userId: string): Promise<UserSettings | null> {
  const path = `user_settings/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'user_settings', userId));
    if (docSnap.exists()) {
      return docSnap.data() as UserSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Realtime listener for user settings (instant sync across open tabs and devices)
 */
export function subscribeToUserSettings(
  userId: string,
  onUpdate: (settings: UserSettings) => void
): () => void {
  const path = `user_settings/${userId}`;
  return onSnapshot(
    doc(db, 'user_settings', userId),
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as UserSettings);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
