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
  Info
} from 'lucide-react';
import { getStoredTokens, saveTokens, clearTokens, StoredTokens, testCeligoTokens } from '../services/tokenStorage';

interface CeligoTokensModalProps {
  onClose: () => void;
  onTokensUpdated: () => void;
  prodConnected: boolean;
  sandboxConnected: boolean;
}

export const CeligoTokensModal: React.FC<CeligoTokensModalProps> = ({
  onClose,
  onTokensUpdated,
  prodConnected,
  sandboxConnected,
}) => {
  const [prodToken, setProdToken] = useState('');
  const [sandboxToken, setSandboxToken] = useState('');
  const [gchatWebhookUrl, setGchatWebhookUrl] = useState('');
  const [stack, setStack] = useState<'us' | 'eu'>('us');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    prod?: { connected: boolean; message?: string };
    sandbox?: { connected: boolean; message?: string };
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const stored = getStoredTokens();
    if (stored.prodToken) setProdToken(stored.prodToken);
    if (stored.sandboxToken) setSandboxToken(stored.sandboxToken);
    if (stored.gchatWebhookUrl) setGchatWebhookUrl(stored.gchatWebhookUrl);
    if (stored.celigoStack) setStack(stored.celigoStack);
  }, []);

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

  const handleSave = () => {
    saveTokens({
      prodToken: prodToken.trim(),
      sandboxToken: sandboxToken.trim(),
      gchatWebhookUrl: gchatWebhookUrl.trim(),
      celigoStack: stack,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onTokensUpdated();
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    clearTokens();
    setProdToken('');
    setSandboxToken('');
    setGchatWebhookUrl('');
    setTestResult(null);
    onTokensUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Celigo API Tokens & Stack Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Add your personal or team Celigo tokens to sync live integrations & flows
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Current Status Banner */}
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

          {/* Form */}
          <div className="space-y-4">
            {/* Region / Stack */}
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
                  Production API Token (CELIGO_PROD_API_TOKEN):
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
                Used to read live Production flows, error summaries, and retry records.
              </p>
            </div>

            {/* Sandbox API Token */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Sandbox API Token (CELIGO_SANDBOX_API_TOKEN):
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
                Used to ingest Sandbox test flows and stage remediation tests safely.
              </p>
            </div>

            {/* Google Chat Webhook URL */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Google Chat Webhook URL (Optional):
              </label>
              <input
                type="text"
                placeholder="https://chat.googleapis.com/v1/spaces/.../messages?key=..."
                value={gchatWebhookUrl}
                onChange={(e) => setGchatWebhookUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Used to broadcast instant interactive alerts to your team space.
              </p>
            </div>
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

          {/* Info note */}
          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-2.5 text-[11px] text-indigo-300">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              Your tokens are stored in your browser session and transmitted directly to the Celigo API proxy to fetch your company's flows and error logs.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || (!prodToken && !sandboxToken)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>

              {(prodToken || sandboxToken) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
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
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                {saveSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <ShieldCheck className="w-4 h-4" />}
                {saveSuccess ? 'Saved & Applied!' : 'Save & Sync Live Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
