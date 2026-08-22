import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bot, 
  Terminal, 
  Code, 
  Check, 
  Copy, 
  Zap, 
  Sparkles, 
  AlertTriangle, 
  Layers,
  ArrowRight,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { CeligoErrorRecord } from '../types/celigo';
import { requestErrorAnalysis, AnalysisResponse } from '../services/apiClient';

interface AutomatedRemediationModalProps {
  error: CeligoErrorRecord;
  onClose: () => void;
  onRunCliCommand: (command: string) => void;
  onResolveError: (errorId: string) => void;
}

export const AutomatedRemediationModal: React.FC<AutomatedRemediationModalProps> = ({
  error,
  onClose,
  onRunCliCommand,
  onResolveError,
}) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cli' | 'hook' | 'mcp' | 'troubleshooting'>('cli');

  useEffect(() => {
    let isMounted = true;
    async function fetchDeepAnalysis() {
      setLoading(true);
      try {
        const result = await requestErrorAnalysis(error);
        if (isMounted) setAnalysis(result);
      } catch (err) {
        console.error('Failed to run automated analysis:', err);
        // Fallback default from error record
        if (isMounted) {
          setAnalysis({
            plainEnglishSummary: error.plainEnglishSummary,
            businessImpact: error.businessImpact,
            rootCause: error.rootCauseSimple,
            actionRequiredBy: error.actionRequiredBy,
            retrySafety: error.retrySafety,
            retrySafetyReason: error.retrySafetyReason,
            suggestedCliCommand: error.suggestedCliCommand,
            suggestedRemediationScript: error.suggestedRemediationScript || `// Celigo Hook\nfunction preSavePage(options) {\n  return options.data;\n}`,
            jiraTroubleshootingSteps: [
              'Verify customer and item IDs in source system',
              'Check tax registration and mapping table in integrator.io',
              'Run celigo-cli retry command'
            ],
            mcpToolToExecute: 'celigo_retry_flow_errors',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDeepAnalysis();
    return () => { isMounted = false; };
  }, [error]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const cliCommand = analysis?.suggestedCliCommand || error.suggestedCliCommand;
  const scriptHook = analysis?.suggestedRemediationScript || error.suggestedRemediationScript || `// Celigo Hook snippet`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Automated Remediation & Script Generator
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {error.flowName} • Record: <strong className="text-slate-200">{error.recordIdentifier}</strong>
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

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-200">
                Analyzing error against Celigo MCP & CLI Knowledge Base...
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Extracting schema mapping differences and generating automated recovery scripts.
              </p>
            </div>
          ) : (
            <>
              {/* Executive Overview */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-400 uppercase tracking-wider">
                    Root Cause Diagnosis:
                  </span>
                  <span className="text-slate-400">
                    Target: <strong className="text-slate-200">{error.targetApp}</strong>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  {analysis?.plainEnglishSummary}
                </p>
                <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    Assigned Action: <strong className="text-slate-200">{analysis?.actionRequiredBy || error.actionRequiredBy}</strong>
                  </span>
                  <span className="text-slate-400">
                    Retry Verdict: <strong className={analysis?.retrySafety === 'safe' ? 'text-emerald-400' : 'text-amber-400'}>
                      {analysis?.retrySafety === 'safe' ? 'Safe for immediate 1-click retry' : 'Verify data before retrying'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Tabs for Remediation Formats */}
              <div>
                <div className="flex border-b border-slate-800 gap-2">
                  <button
                    onClick={() => setActiveTab('cli')}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'cli'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Celigo CLI Command
                  </button>

                  <button
                    onClick={() => setActiveTab('hook')}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'hook'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5 text-sky-400" />
                    JavaScript Hook / Handlebars Fix
                  </button>

                  <button
                    onClick={() => setActiveTab('troubleshooting')}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'troubleshooting'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Step-by-Step Checklist
                  </button>

                  <button
                    onClick={() => setActiveTab('mcp')}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'mcp'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Celigo MCP Agent Query
                  </button>
                </div>

                {/* Tab Content */}
                <div className="pt-4">
                  {activeTab === 'cli' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Copy and run in Celigo CLI terminal (<a href="https://developer.celigo.com/cli" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5">cli docs <ExternalLink className="w-3 h-3" /></a>):</span>
                        <button
                          onClick={() => handleCopy(cliCommand, 'cli')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                        >
                          {copiedType === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy Command
                        </button>
                      </div>
                      <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap select-all">
                        {cliCommand}
                      </pre>
                      <p className="text-[11px] text-slate-400">
                        This command sends an API retry payload through integrator.io to re-validate against the target endpoint.
                      </p>
                    </div>
                  )}

                  {activeTab === 'hook' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Pre-Save Page / Post-Map Transformation Hook:</span>
                        <button
                          onClick={() => handleCopy(scriptHook, 'hook')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                        >
                          {copiedType === 'hook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy Script
                        </button>
                      </div>
                      <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 max-h-60 overflow-y-auto whitespace-pre-wrap">
                        {scriptHook}
                      </pre>
                      <p className="text-[11px] text-slate-400">
                        Paste this into Celigo Flow Builder ➔ Transform ➔ Scripts to automatically sanitize missing fields before downstream submission.
                      </p>
                    </div>
                  )}

                  {activeTab === 'troubleshooting' && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-300 block mb-2">
                        Actionable Resolution Steps for Support & Business Teams:
                      </span>
                      {(analysis?.jiraTroubleshootingSteps || []).map((step, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'mcp' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-800/40 text-xs text-purple-300">
                        <span className="font-semibold block mb-1">Celigo MCP Server Protocol Call:</span>
                        <code>{analysis?.mcpToolToExecute || 'celigo_retry_flow_errors'}({`{ flowId: "${error.flowId}", errorId: "${error.id}" }`})</code>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        MCP allows LLMs and agents to query Celigo directly at <a href="https://developer.celigo.com/mcp" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">developer.celigo.com/mcp</a> to orchestrate live retries and schema inspection.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900 sticky bottom-0 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onRunCliCommand(cliCommand);
                onClose();
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Execute in Celigo CLI
            </button>

            <button
              onClick={() => {
                onResolveError(error.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Apply Fix & Retry Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
