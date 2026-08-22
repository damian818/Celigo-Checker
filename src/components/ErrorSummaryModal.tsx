import React from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Zap, 
  ArrowRight, 
  ExternalLink, 
  Layers, 
  Activity, 
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  Trash2,
  Tag
} from 'lucide-react';
import { CeligoErrorRecord, CeligoFlow, CeligoIntegration } from '../types/celigo';
import {
  identifyFlowType,
  getCompanyNameOrIntegration,
  getShortErrorDescription,
  formatErrorSummary,
  getFlowTypeBadgeStyle,
  FlowClassificationType,
} from '../utils/errorSummaryFormatter';

export interface ErrorSummaryScope {
  type: 'global' | 'integration' | 'flow';
  id?: string;
  title: string;
  subtitle?: string;
  integrationName?: string;
  flowName?: string;
}

interface ErrorSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ErrorSummaryScope;
  errors: CeligoErrorRecord[];
  flows?: CeligoFlow[];
  onNavigateToErrors: (flowId?: string) => void;
  onQuickRetry?: (errorId: string) => void;
  onQuickResolve?: (errorId: string, purge?: boolean) => void;
}

export const ErrorSummaryModal: React.FC<ErrorSummaryModalProps> = ({
  isOpen,
  onClose,
  scope,
  errors,
  flows = [],
  onNavigateToErrors,
  onQuickRetry,
  onQuickResolve,
}) => {
  if (!isOpen) return null;

  // Filter errors based on scope
  const filteredErrors = errors.filter(err => {
    if (scope.type === 'flow' && scope.id) {
      return err.flowId === scope.id;
    }
    if (scope.type === 'integration' && scope.id) {
      if (err.integrationId && err.integrationId === scope.id) return true;
      if (err.integrationName && scope.integrationName && err.integrationName.toLowerCase() === scope.integrationName.toLowerCase()) return true;
      // Also check if error flow belongs to this integration
      const errFlow = flows.find(f => f.id === err.flowId);
      if (errFlow && (errFlow.integrationId === scope.id || (errFlow.integrationName && scope.integrationName && errFlow.integrationName.toLowerCase() === scope.integrationName.toLowerCase()))) {
        return true;
      }
      return false;
    }
    return true;
  });

  const unresolved = filteredErrors.filter(e => e.status !== 'resolved');
  const critical = unresolved.filter(e => e.severity === 'critical');
  const high = unresolved.filter(e => e.severity === 'high');
  const safeRetry = unresolved.filter(e => {
    const isExport = String(e.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(e.rawErrorMessage || '').toLowerCase().includes('export');
    return e.canRetry !== false && !isExport;
  });

  // Group by message / error code pattern
  const groupedSummary = React.useMemo(() => {
    const map = new Map<string, {
      flowId?: string;
      flowName?: string;
      flowType: FlowClassificationType;
      companyName: string;
      formattedSummary: string;
      rawErrorCode?: string;
      rawErrorMessage?: string;
      plainEnglishSummary?: string;
      severity: string;
      retrySafety?: string;
      canRetry: boolean;
      canResolve: boolean;
      count: number;
      records: CeligoErrorRecord[];
    }>();

    unresolved.forEach(err => {
      const msg = (err.plainEnglishSummary || err.rawErrorMessage || err.rawErrorCode || 'Unknown error').trim();
      const key = `${err.flowId || ''}:::${msg.toLowerCase()}`;
      
      const isExport = String(err.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(err.rawErrorMessage || '').toLowerCase().includes('export');
      const recCanRetry = err.canRetry !== false && !isExport;
      const recCanResolve = err.canResolve !== false;

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.records.push(err);
        if (recCanRetry) existing.canRetry = true;
        if (recCanResolve) existing.canResolve = true;
      } else {
        const flowType = identifyFlowType(err);
        const companyName = getCompanyNameOrIntegration(err, 'Gappify Account');
        const shortDesc = getShortErrorDescription(err);
        const formattedSummary = formatErrorSummary(err, companyName, shortDesc);

        map.set(key, {
          flowId: err.flowId,
          flowName: err.flowName,
          flowType,
          companyName,
          formattedSummary,
          rawErrorCode: err.rawErrorCode,
          rawErrorMessage: err.rawErrorMessage,
          plainEnglishSummary: err.plainEnglishSummary,
          severity: err.severity || 'high',
          retrySafety: err.retrySafety || 'verify_data',
          canRetry: recCanRetry,
          canResolve: recCanResolve,
          count: 1,
          records: [err],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [unresolved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {scope.title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {unresolved.length} {unresolved.length === 1 ? 'Error' : 'Errors'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {scope.subtitle || 'Review summarized error patterns and root causes before remediation.'}
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Blocked Records</span>
              <span className="text-base font-bold text-white mt-0.5 block">{unresolved.length}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-rose-900/40 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block">Critical Severity</span>
              <span className="text-base font-bold text-rose-300 mt-0.5 block">{critical.length}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/40 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">1-Click Safe Retry</span>
              <span className="text-base font-bold text-emerald-300 mt-0.5 block">{safeRetry.length}</span>
            </div>
          </div>

          {/* Grouped Error Breakdown */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Active Error Patterns ({groupedSummary.length})
            </span>

            {groupedSummary.length === 0 ? (
              <div className="bg-slate-950/60 p-6 rounded-xl border border-slate-800 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-white">No Unresolved Errors</p>
                <p className="text-[11px] text-slate-400 mt-0.5">All records have synced successfully without failures.</p>
              </div>
            ) : (
              groupedSummary.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : item.severity === 'high'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                        }`}>
                          {item.severity}
                        </span>

                        {(() => {
                          const badge = getFlowTypeBadgeStyle(item.flowType);
                          return (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${badge.pillClass}`}>
                              <Tag className="w-2.5 h-2.5" />
                              <span>{item.flowType}</span>
                            </span>
                          );
                        })()}

                        <span className="text-xs font-bold text-white">
                          {item.flowName || 'Integration Flow'}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          {item.count} record{item.count === 1 ? '' : 's'}
                        </span>

                        {item.canRetry ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            Retryable
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Trash2 className="w-2.5 h-2.5" />
                            Resolve (Purge)
                          </span>
                        )}
                      </div>

                      {/* Standard Summary Tag */}
                      <div className="bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono text-[11px] text-sky-300 font-semibold mb-1.5 select-all">
                        {item.formattedSummary}
                      </div>

                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        {item.plainEnglishSummary || item.rawErrorMessage || 'Integration exception occurred during payload delivery.'}
                      </p>

                      {item.rawErrorCode && (
                        <span className="text-[11px] font-mono text-slate-500 block mt-1">
                          Code: {item.rawErrorCode}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToErrors(item.flowId);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold shrink-0 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>Fix</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              onNavigateToErrors(scope.type === 'flow' ? scope.id : undefined);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open in Error Review Tab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
