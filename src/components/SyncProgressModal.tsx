import React from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  Loader2, 
  Layers, 
  Database, 
  AlertTriangle, 
  ShieldCheck, 
  X, 
  Minimize2,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export interface SyncStepInfo {
  id: number;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface SyncProgressModalProps {
  isOpen: boolean;
  progress: number;
  currentStep: number;
  stepMessage: string;
  stats?: {
    flowsCount?: number;
    errorsCount?: number;
    integrationsCount?: number;
  };
  onMinimize: () => void;
  isManual?: boolean;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isOpen,
  progress,
  currentStep,
  stepMessage,
  stats,
  onMinimize,
}) => {
  if (!isOpen) return null;

  const steps: SyncStepInfo[] = [
    {
      id: 1,
      label: 'API Token Handshake',
      description: 'Connecting to integrator.io Production & Sandbox endpoints',
      status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'in_progress' : 'pending',
    },
    {
      id: 2,
      label: 'Flow & Integration Extraction',
      description: 'Ingesting all active flows, webhooks, and sync schedules',
      status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'in_progress' : 'pending',
    },
    {
      id: 3,
      label: 'Error Queue & Log Ingestion',
      description: 'Querying failed execution payloads, HTTP status & retry records',
      status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'in_progress' : 'pending',
    },
    {
      id: 4,
      label: 'Incident Pattern Grouping',
      description: 'Consolidating duplicate error messages & computing blast radius',
      status: currentStep > 4 ? 'completed' : currentStep === 4 ? 'in_progress' : 'pending',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden text-white relative">
        {/* Top Gradient Shimmer Bar */}
        <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.6)]"
            style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Syncing Celigo Integrations</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {Math.round(progress)}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Fetching real-time integration state, error logs, and metrics
              </p>
            </div>
          </div>

          <button
            onClick={onMinimize}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Minimize to background progress bar"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Main Animated Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-indigo-300 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                {stepMessage || 'Processing sync step...'}
              </span>
              <span className="text-slate-400 font-mono">{Math.round(progress)}%</span>
            </div>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
              />
            </div>
          </div>

          {/* Step Milestones Checklist */}
          <div className="space-y-2.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            {steps.map((step) => {
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in_progress';

              return (
                <div 
                  key={step.id} 
                  className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                    isInProgress 
                      ? 'bg-indigo-950/40 border border-indigo-800/40' 
                      : isCompleted 
                      ? 'text-slate-300' 
                      : 'text-slate-500 opacity-60'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isInProgress ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px] font-mono">
                        {step.id}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold ${isInProgress ? 'text-indigo-200' : isCompleted ? 'text-slate-200' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                      {isInProgress && (
                        <span className="text-[10px] text-indigo-400 font-medium animate-pulse">
                          In progress
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Micro stats banner if available */}
          {stats && (stats.flowsCount !== undefined || stats.errorsCount !== undefined) && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Flows Discovered</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{stats.flowsCount || 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Integrations</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{stats.integrationsCount || 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Errors Ingested</span>
                <span className="text-xs font-bold text-rose-400 mt-0.5 block">{stats.errorsCount || 0}</span>
              </div>
            </div>
          )}

          {/* Reassurance text & Background Action */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">
              Syncing takes 2-5 seconds depending on flow volume.
            </span>
            <button
              onClick={onMinimize}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Work in Background</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
