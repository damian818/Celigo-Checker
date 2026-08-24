import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  Trash2, 
  ExternalLink,
  Info,
  MessageSquare,
  Mail,
  FileText,
  Cloud,
  Layers,
  RotateCcw,
  Eye,
  Code
} from 'lucide-react';
import { getStoredTokens, saveTokens, clearTokens, testCeligoTokens } from '../services/tokenStorage';
import { 
  saveUserSettings, 
  loadUserSettings, 
  DEFAULT_GCHAT_TEMPLATE, 
  DEFAULT_GMAIL_SUBJECT, 
  DEFAULT_GMAIL_BODY,
  DEFAULT_GMAIL_RECIPIENTS,
  TEMPLATE_VARIABLES,
  interpolateTemplate
} from '../services/userSettingsService';
import { User } from '../services/firebase';

interface CeligoTokensModalProps {
  onClose: () => void;
  onTokensUpdated: () => void;
  prodConnected: boolean;
  sandboxConnected: boolean;
  user?: User | null;
}

type TabType = 'tokens' | 'endpoints' | 'templates';

export const CeligoTokensModal: React.FC<CeligoTokensModalProps> = ({
  onClose,
  onTokensUpdated,
  prodConnected,
  sandboxConnected,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tokens');
  
  // Form fields
  const [prodToken, setProdToken] = useState('');
  const [sandboxToken, setSandboxToken] = useState('');
  const [stack, setStack] = useState<'us' | 'eu'>('us');
  const [gchatWebhookUrl, setGchatWebhookUrl] = useState('');
  const [gmailRecipients, setGmailRecipients] = useState(DEFAULT_GMAIL_RECIPIENTS);
  const [gchatTemplate, setGchatTemplate] = useState(DEFAULT_GCHAT_TEMPLATE);
  const [gmailSubjectTemplate, setGmailSubjectTemplate] = useState(DEFAULT_GMAIL_SUBJECT);
  const [gmailBodyTemplate, setGmailBodyTemplate] = useState(DEFAULT_GMAIL_BODY);

  // States
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    prod?: { connected: boolean; message?: string };
    sandbox?: { connected: boolean; message?: string };
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'gchat' | 'gmail'>('gchat');

  // Dummy sample error for live preview
  const sampleError = {
    id: 'err-demo-9921',
    flowName: 'NetSuite to Salesforce Customer Sync',
    recordIdentifier: 'CUST-84920',
    severity: 'critical' as const,
    environment: 'production' as const,
    plainEnglishSummary: 'Customer account payload rejected by NetSuite due to missing mandatory Currency / Subsidiary reference.',
    rootCauseSimple: 'Update the NetSuite customer master mapping to include subsidiary internalId: 1',
    actionRequiredBy: 'Salesforce Admin & NetSuite Ops',
    occurredAt: new Date().toLocaleString(),
    suggestedCliCommand: 'celigo retry --flow ns-sf-sync --id CUST-84920',
    message: 'INVALID_KEY_OR_REF: Subsidiary reference is missing'
  };

  useEffect(() => {
    // 1. Initial load from local storage
    const stored = getStoredTokens();
    if (stored.prodToken) setProdToken(stored.prodToken);
    if (stored.sandboxToken) setSandboxToken(stored.sandboxToken);
    if (stored.gchatWebhookUrl) setGchatWebhookUrl(stored.gchatWebhookUrl);
    if (stored.celigoStack) setStack(stored.celigoStack);
    if (stored.gmailDefaultRecipients) setGmailRecipients(stored.gmailDefaultRecipients);
    if (stored.gchatMessageTemplate) setGchatTemplate(stored.gchatMessageTemplate);
    if (stored.gmailSubjectTemplate) setGmailSubjectTemplate(stored.gmailSubjectTemplate);
    if (stored.gmailBodyTemplate) setGmailBodyTemplate(stored.gmailBodyTemplate);

    // 2. Hydrate from Firebase Firestore if user logged in
    if (user?.uid) {
      loadUserSettings(user.uid).then((settings) => {
        if (settings) {
          if (settings.prodToken) setProdToken(settings.prodToken);
          if (settings.sandboxToken) setSandboxToken(settings.sandboxToken);
          if (settings.celigoStack) setStack(settings.celigoStack);
          if (settings.gchatWebhookUrl) setGchatWebhookUrl(settings.gchatWebhookUrl);
          if (settings.gmailDefaultRecipients) setGmailRecipients(settings.gmailDefaultRecipients);
          if (settings.gchatMessageTemplate) setGchatTemplate(settings.gchatMessageTemplate);
          if (settings.gmailSubjectTemplate) setGmailSubjectTemplate(settings.gmailSubjectTemplate);
          if (settings.gmailBodyTemplate) setGmailBodyTemplate(settings.gmailBodyTemplate);
        }
      }).catch(err => {
        console.warn('Could not load user settings from Firestore:', err);
      });
    }
  }, [user]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testCeligoTokens(prodToken, sandboxToken, stack);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        prod: { connected: false, message: err.message || 'Network error during test' },
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInsertToken = (token: string, target: 'gchat' | 'gmailSubject' | 'gmailBody') => {
    if (target === 'gchat') {
      setGchatTemplate(prev => prev + ' ' + token);
    } else if (target === 'gmailSubject') {
      setGmailSubjectTemplate(prev => prev + ' ' + token);
    } else {
      setGmailBodyTemplate(prev => prev + ' ' + token);
    }
  };

  const handleResetTemplates = () => {
    if (window.confirm('Reset all message templates to default Gappify format?')) {
      setGchatTemplate(DEFAULT_GCHAT_TEMPLATE);
      setGmailSubjectTemplate(DEFAULT_GMAIL_SUBJECT);
      setGmailBodyTemplate(DEFAULT_GMAIL_BODY);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsPayload = {
        prodToken: prodToken.trim(),
        sandboxToken: sandboxToken.trim(),
        celigoStack: stack,
        gchatWebhookUrl: gchatWebhookUrl.trim(),
        gmailDefaultRecipients: gmailRecipients.trim(),
        gchatMessageTemplate: gchatTemplate,
        gmailSubjectTemplate: gmailSubjectTemplate,
        gmailBodyTemplate: gmailBodyTemplate,
      };

      // 1. Save locally for instant session access
      saveTokens(settingsPayload);

      // 2. Save to Firestore for cross-device cloud persistence
      if (user?.uid) {
        await saveUserSettings(user.uid, {
          ...settingsPayload,
          email: user.email || undefined,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onTokensUpdated();
        onClose();
      }, 900);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error saving settings to cloud: ' + (err as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all stored Celigo tokens from this browser?')) {
      clearTokens();
      setProdToken('');
      setSandboxToken('');
      setTestResult(null);
      onTokensUpdated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Settings & Cloud Integrations
                {user?.email && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> Cross-Device Sync Active
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Configure Celigo API tokens, Google Chat webhooks, default Gmail recipients & message templates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 bg-slate-900/50 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('tokens')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'tokens'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4 text-indigo-400" />
            Celigo API Tokens & Stack
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('endpoints')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'endpoints'
                ? 'border-emerald-500 text-emerald-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Alert Endpoints (GChat & Gmail)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'templates'
                ? 'border-purple-500 text-purple-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-400" />
            Customizable Message Templates
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 space-y-6 flex-1">
          {/* TAB 1: CELIGO TOKENS & STACK */}
          {activeTab === 'tokens' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${prodConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                    <span className="text-slate-300">Production: <strong>{prodConnected ? 'Active' : 'Unset'}</strong></span>
                  </div>
                  <span className="text-slate-700">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sandboxConnected ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></span>
                    <span className="text-slate-300">Sandbox: <strong>{sandboxConnected ? 'Active' : 'Unset'}</strong></span>
                  </div>
                </div>
                <a
                  href="https://integrator.io/#/account/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline text-[11px]"
                >
                  Get tokens from Celigo <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Stack Region */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  Celigo Data Center / Stack
                </label>
                <select
                  value={stack}
                  onChange={(e) => setStack(e.target.value as 'us' | 'eu')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="us">US Stack (https://api.integrator.io)</option>
                  <option value="eu">EU Stack (https://api.eu.integrator.io)</option>
                </select>
              </div>

              {/* Production API Token */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Production API Bearer Token:
                  </label>
                  {prodConnected && !prodToken && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      Configured in Server Secrets
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  placeholder={prodConnected ? "•••••••••••••••••••••••• (Active in Server)" : "Paste Production Bearer Token..."}
                  value={prodToken}
                  onChange={(e) => setProdToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Used to read live Production flows, error queues, and trigger automatic retries.
                </p>
              </div>

              {/* Sandbox API Token */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Sandbox API Bearer Token:
                  </label>
                  {sandboxConnected && !sandboxToken && (
                    <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                      Configured in Server Secrets
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  placeholder={sandboxConnected ? "•••••••••••••••••••••••• (Active in Server)" : "Paste Sandbox Bearer Token..."}
                  value={sandboxToken}
                  onChange={(e) => setSandboxToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Used to ingest Sandbox test flows and stage remediation payloads safely.
                </p>
              </div>

              {/* Test Connection Results */}
              {testResult && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="font-semibold text-slate-300 block">Connection Test Results:</span>
                  {testResult.prod && (
                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                      testResult.prod.connected 
                        ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300' 
                        : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
                    }`}>
                      {testResult.prod.connected ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      <span><strong>Production:</strong> {testResult.prod.message}</span>
                    </div>
                  )}
                  {testResult.sandbox && (
                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                      testResult.sandbox.connected 
                        ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300' 
                        : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
                    }`}>
                      {testResult.sandbox.connected ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      <span><strong>Sandbox:</strong> {testResult.sandbox.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cloud Sync info */}
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-2.5 text-[11px] text-indigo-300">
                <Cloud className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  All tokens and configurations are saved to your Firebase Firestore cloud record (<code>user_settings/{user?.uid || 'user'}</code>) and sync automatically whenever you log into any workstation or mobile device.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: ALERT CHANNELS & ENDPOINTS */}
          {activeTab === 'endpoints' && (
            <div className="space-y-5">
              {/* Google Chat Webhook Hook */}
              <div>
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  Google Chat Space Webhook URL (GChat Hook):
                </label>
                <input
                  type="text"
                  placeholder="https://chat.googleapis.com/v1/spaces/AAAA.../messages?key=...&token=..."
                  value={gchatWebhookUrl}
                  onChange={(e) => setGchatWebhookUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  When Celigo integration errors arise, instant interactive message cards will be dispatched to this Google Chat space.
                </p>
              </div>

              {/* Default Gmail Notification Recipients */}
              <div>
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                  <Mail className="w-4 h-4 text-rose-400" />
                  Default Notification Recipients for Gmail Messages:
                </label>
                <input
                  type="text"
                  placeholder="e.g. damian@gappify.com, support@gappify.com, integrations@gappify.com"
                  value={gmailRecipients}
                  onChange={(e) => setGmailRecipients(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Comma-separated list of team email addresses who receive automated email incident digests and escalation alerts.
                </p>
              </div>

              {/* Helpful Webhook Guide Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                <span className="font-semibold text-slate-200 block flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" /> How to get your Google Chat Incoming Webhook URL:
                </span>
                <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1">
                  <li>Open Google Chat and go to your target team space (e.g. <code>#celigo-alerts</code>).</li>
                  <li>Click the Space name at the top &gt; <strong>Apps & Integrations</strong> &gt; <strong>Manage webhooks</strong>.</li>
                  <li>Click <strong>Add webhook</strong>, name it <em>Gappify Celigo Alert Bot</em>, and copy the URL.</li>
                  <li>Paste the URL above and click <strong>Save & Sync Across Devices</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMIZABLE MESSAGE TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-5">
              {/* Dynamic Tokens Cheat-sheet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    Available Dynamic Placeholders (Click to insert):
                  </span>
                  <button
                    type="button"
                    onClick={handleResetTemplates}
                    className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Templates to Defaults
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => handleInsertToken(v.token, 'gchat')}
                      title={v.desc}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Google Chat Message Template */}
              <div>
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  Google Chat Message Template (Markdown):
                </label>
                <textarea
                  rows={4}
                  value={gchatTemplate}
                  onChange={(e) => setGchatTemplate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-y leading-relaxed"
                />
              </div>

              {/* Gmail Subject Template */}
              <div>
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                  <Mail className="w-4 h-4 text-rose-400" />
                  Gmail Subject Template:
                </label>
                <input
                  type="text"
                  value={gmailSubjectTemplate}
                  onChange={(e) => setGmailSubjectTemplate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Gmail HTML Body Template */}
              <div>
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Gmail Email Body Template (HTML / CSS):
                </label>
                <textarea
                  rows={6}
                  value={gmailBodyTemplate}
                  onChange={(e) => setGmailBodyTemplate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-y leading-relaxed"
                />
              </div>

              {/* Live Render Preview Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-amber-400" /> Live Interpolation Preview:
                  </span>
                  <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('gchat')}
                      className={`px-2.5 py-1 rounded-md transition ${previewMode === 'gchat' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                    >
                      Google Chat Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('gmail')}
                      className={`px-2.5 py-1 rounded-md transition ${previewMode === 'gmail' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                    >
                      Gmail HTML Preview
                    </button>
                  </div>
                </div>

                {previewMode === 'gchat' ? (
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {interpolateTemplate(gchatTemplate, sampleError as any)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Subject: <span className="font-normal text-rose-300">{interpolateTemplate(gmailSubjectTemplate, sampleError as any)}</span>
                    </div>
                    <div 
                      className="p-3 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto text-xs"
                      dangerouslySetInnerHTML={{ __html: interpolateTemplate(gmailBodyTemplate, sampleError as any) }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 sticky bottom-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeTab === 'tokens' && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || (!prodToken && !sandboxToken)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
            )}

            {(prodToken || sandboxToken) && activeTab === 'tokens' && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Local
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (saveSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <ShieldCheck className="w-4 h-4" />)}
              {isSaving ? 'Syncing to Firebase...' : (saveSuccess ? 'Saved & Synced Across Devices!' : 'Save & Sync Across Devices')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
