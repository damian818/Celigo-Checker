import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Bot, 
  Terminal, 
  Check, 
  Copy, 
  Code, 
  AlertTriangle,
  Loader2,
  FileCode
} from 'lucide-react';
import { requestErrorAnalysis, AnalysisResponse } from '../services/apiClient';
import { CeligoErrorRecord } from '../types/celigo';

interface CustomErrorAnalyzerModalProps {
  onClose: () => void;
  onRunCliCommand: (command: string) => void;
}

export const CustomErrorAnalyzerModal: React.FC<CustomErrorAnalyzerModalProps> = ({
  onClose,
  onRunCliCommand,
}) => {
  const [sourceApp, setSourceApp] = useState('NetSuite ERP');
  const [targetApp, setTargetApp] = useState('Salesforce CRM');
  const [rawErrorCode, setRawErrorCode] = useState('USER_ERROR: PLEASE_ENTER_VALUE');
  const [rawErrorMessage, setRawErrorMessage] = useState(
    'Please enter value(s) for: Subsidiary on record with entity id 99214. Cannot submit transaction without valid accounting subsidiary mapping.'
  );
  const [rawPayloadText, setRawPayloadText] = useState(
    JSON.stringify({
      orderId: "SO-99214",
      customer: "Acme European Holdings",
      total: 14500.00,
      subsidiaryId: null,
      currency: "EUR"
    }, null, 2)
  );

  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let parsedPayload: any = {};
    try {
      parsedPayload = JSON.parse(rawPayloadText);
    } catch {
      parsedPayload = { rawText: rawPayloadText };
    }

    try {
      const mockRecord: CeligoErrorRecord = {
        id: `custom_${Date.now()}`,
        flowId: 'custom_flow',
        flowName: `${sourceApp} to ${targetApp}`,
        sourceApp,
        targetApp,
        timestamp: new Date().toLocaleTimeString(),
        recordIdentifier: 'Custom Record',
        recordType: 'Transaction',
        severity: 'high',
        category: 'data_validation',
        rawErrorCode,
        rawErrorMessage,
        retryCount: 1,
        maxRetries: 5,
        status: 'unresolved',
        plainEnglishSummary: '',
        businessImpact: '',
        rootCauseSimple: '',
        actionRequiredBy: 'IT Support',
        retrySafety: 'verify_data',
        retrySafetyReason: '',
        rawPayload: parsedPayload,
        suggestedCliCommand: '',
      };

      const result = await requestErrorAnalysis(mockRecord);
      setAnalysis(result);
    } catch (err) {
      console.error('Failed to analyze custom error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Analyze Custom Celigo Error Payload
              </h3>
              <p className="text-xs text-slate-400">
                Paste any raw Celigo error log to generate an instant plain-English translation & CLI script
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Source Application:
                </label>
                <input
                  type="text"
                  value={sourceApp}
                  onChange={(e) => setSourceApp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Application:
                </label>
                <input
                  type="text"
                  value={targetApp}
                  onChange={(e) => setTargetApp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Error Code / Status:
              </label>
              <input
                type="text"
                value={rawErrorCode}
                onChange={(e) => setRawErrorCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-rose-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Raw Error Message / Stack Trace:
              </label>
              <textarea
                rows={3}
                value={rawErrorMessage}
                onChange={(e) => setRawErrorMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Raw Record Payload (JSON):
              </label>
              <textarea
                rows={4}
                value={rawPayloadText}
                onChange={(e) => setRawPayloadText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Synthesizing Celigo Diagnostics...' : 'Translate & Generate Fix'}
            </button>
          </form>

          {/* Results Display */}
          {analysis && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              {/* Plain English Translation */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
                  Plain English Summary (For Business Users):
                </span>
                <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                  {analysis.plainEnglishSummary}
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-700/60">
                  <span className="text-slate-400">
                    Action by: <strong className="text-slate-200">{analysis.actionRequiredBy}</strong>
                  </span>
                  <span className="text-slate-400">
                    Retry: <strong className={analysis.retrySafety === 'safe' ? 'text-emerald-400' : 'text-amber-400'}>
                      {analysis.retrySafety === 'safe' ? 'Safe to retry immediately' : 'Verify data first'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* CLI Command */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" /> Generated Celigo CLI Command:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(analysis.suggestedCliCommand, 'custom_cli')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 border border-slate-700"
                    >
                      {copiedType === 'custom_cli' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        onRunCliCommand(analysis.suggestedCliCommand);
                        onClose();
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center gap-1"
                    >
                      Run in CLI
                    </button>
                  </div>
                </div>
                <pre className="font-mono text-xs text-emerald-300 whitespace-pre-wrap">
                  {analysis.suggestedCliCommand}
                </pre>
              </div>

              {/* Hook Script */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-sky-400 flex items-center gap-1">
                    <Code className="w-3.5 h-3.5" /> Remediation Hook Script:
                  </span>
                  <button
                    onClick={() => handleCopy(analysis.suggestedRemediationScript, 'custom_hook')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 border border-slate-700"
                  >
                    {copiedType === 'custom_hook' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy Hook
                  </button>
                </div>
                <pre className="font-mono text-xs text-sky-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {analysis.suggestedRemediationScript}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
