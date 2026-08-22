import React, { useState, useEffect } from 'react';
import { 
  X, 
  Code2, 
  Play, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Terminal, 
  RefreshCw,
  FileJson,
  Layers,
  Sparkles
} from 'lucide-react';
import { CeligoErrorRecord } from '../types/celigo';
import { fetchSnapshotData, updateSnapshotData, triggerErrorRetry } from '../services/apiClient';

interface EditPayloadModalProps {
  error: CeligoErrorRecord;
  isOpen: boolean;
  onClose: () => void;
  onSuccessRetry?: (errorId: string) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const EditPayloadModal: React.FC<EditPayloadModalProps> = ({
  error,
  isOpen,
  onClose,
  onSuccessRetry,
  onToast,
}) => {
  const flowId = error.flowId || '';
  const stepId = error.exportOrImportId || error.stepId || 'import_step_01';
  const retryDataKey = error.retryDataKey || error.id || 'snapshot_key_01';
  const errorId = error.id || 'err_01';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [rawEnvelopeText, setRawEnvelopeText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [snapshotSource, setSnapshotSource] = useState<'live' | 'simulation'>('simulation');

  // Load snapshot data on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setJsonError(null);

    async function loadData() {
      try {
        const result = await fetchSnapshotData(flowId, retryDataKey, stepId);
        if (!isMounted) return;

        if (result.success && result.envelope) {
          setRawEnvelopeText(JSON.stringify(result.envelope, null, 2));
          setSnapshotSource(result.source || 'simulation');
        } else {
          // Construct default envelope from error record
          const fallbackEnvelope = {
            data: error.rawPayload || {
              recordId: error.recordIdentifier || retryDataKey,
              flowName: error.flowName,
              status: 'FAILED',
              errorMessage: error.rawErrorMessage || 'Field validation error',
              missingField: error.mappingFieldFailed || 'taxId',
              payload: {
                id: error.recordIdentifier || 'REC-90412',
                customer: error.companyName || 'Apex Corp',
                amount: 1450.00,
                currency: 'USD'
              }
            },
            metadata: {
              flowId: flowId,
              stepId: stepId,
              retryDataKey: retryDataKey,
              errorId: errorId,
              classification: error.classification || 'import',
              lastFailedAt: error.timestamp || new Date().toISOString()
            }
          };
          setRawEnvelopeText(JSON.stringify(fallbackEnvelope, null, 2));
          setSnapshotSource('simulation');
        }
      } catch (err) {
        if (!isMounted) return;
        setRawEnvelopeText(JSON.stringify(error.rawPayload || {}, null, 2));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, flowId, retryDataKey, stepId, error]);

  if (!isOpen) return null;

  const cliUpdateCommand = `celigo flows update-error-data ${flowId} ${stepId} ${errorId}`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliUpdateCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawEnvelopeText(text);
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawEnvelopeText);
      setRawEnvelopeText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  // Save changes to Celigo snapshot envelope (PUT /v1/flows/{_id}/{_exportOrImportId}/{retryDataKey}/data)
  const handleSavePayload = async (): Promise<boolean> => {
    let parsed: any;
    try {
      parsed = JSON.parse(rawEnvelopeText);
    } catch (err: any) {
      setJsonError(err.message);
      if (onToast) onToast('Cannot save invalid JSON payload.', 'error');
      return false;
    }

    setIsSaving(true);
    try {
      const res = await updateSnapshotData(flowId, retryDataKey, parsed, stepId);
      if (res.success) {
        if (onToast) onToast('✓ Snapshot envelope updated successfully in Celigo.', 'success');
        return true;
      } else {
        if (onToast) onToast(res.error || 'Failed to update snapshot envelope', 'error');
        return false;
      }
    } catch (err: any) {
      if (onToast) onToast(err.message || 'Save error', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Save changes and immediately trigger retry (POST /v1/flows/{_id}/{_exportOrImportId}/retry)
  const handleSaveAndRetry = async () => {
    const saved = await handleSavePayload();
    if (!saved) return;

    setIsRetrying(true);
    try {
      const res = await triggerErrorRetry({
        flowId,
        stepId,
        retryDataKey,
        retryDataKeys: [retryDataKey],
        errorId
      });

      if (res.success) {
        if (onToast) onToast(`✓ Reprocessed payload snapshot [${retryDataKey}]! Celigo status: RESOLVED.`, 'success');
        if (onSuccessRetry) onSuccessRetry(errorId);
        onClose();
      } else {
        if (onToast) onToast(`Retry request failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      if (onToast) onToast(err.message || 'Retry error', 'error');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Modify Failed Snapshot Payload & Retry
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  PUT /v1/flows/.../data
                </span>
                {snapshotSource === 'live' ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Live Integrator.io Envelope
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    Snapshot Sandbox
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Flow: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{error.flowName || flowId}</span> &bull; Retry Key: <span className="font-mono text-amber-600 dark:text-amber-400">{retryDataKey}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Instructions Banner */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-xl flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              <span className="font-semibold">Full Envelope Replacement:</span> Edit the failed record fields inside the <code className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded font-mono">data</code> block. Celigo requires submitting the entire envelope so metadata remains synchronized with the step pipeline.
            </div>
          </div>

          {/* Editor Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-slate-400" />
                Snapshot Envelope JSON
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                >
                  Format JSON
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2 text-blue-500" />
                <span className="text-xs">Fetching stored snapshot envelope from Celigo...</span>
              </div>
            ) : (
              <div className="relative">
                <textarea
                  value={rawEnvelopeText}
                  onChange={handleTextChange}
                  rows={14}
                  spellCheck={false}
                  className="w-full font-mono text-xs p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none leading-relaxed shadow-inner"
                />
              </div>
            )}

            {jsonError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>JSON Syntax Error: {jsonError}</span>
              </div>
            )}
          </div>

          {/* Celigo CLI Pipe Equivalent */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Celigo CLI Update Command
              </span>
              <button
                type="button"
                onClick={handleCopyCli}
                className="text-[11px] font-medium flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
              >
                {copiedCli ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedCli ? 'Copied' : 'Copy command'}
              </button>
            </div>
            <code className="block text-xs font-mono bg-slate-900 text-slate-200 px-3 py-2 rounded-lg overflow-x-auto">
              cat payload.json | {cliUpdateCommand}
            </code>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Target Step: <strong className="text-slate-700 dark:text-slate-300 font-mono">{stepId}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isRetrying}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSavePayload()}
              disabled={isSaving || isRetrying || Boolean(jsonError)}
              className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Payload Only
            </button>
            <button
              type="button"
              onClick={handleSaveAndRetry}
              disabled={isSaving || isRetrying || Boolean(jsonError)}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {isRetrying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Save & Retry Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
