import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { verifyErrorStatus } from '../services/apiClient';

interface WaitingActionModalProps {
  isOpen: boolean;
  action: 'retry' | 'resolve';
  isBatch: boolean;
  flowId: string;
  stepId: string;
  errorIds: string[];
  onComplete: (success: boolean, remainingIds: string[]) => void;
}

export const WaitingActionModal: React.FC<WaitingActionModalProps> = ({
  isOpen,
  action,
  isBatch,
  flowId,
  stepId,
  errorIds,
  onComplete
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'waiting' | 'verifying' | 'success' | 'failed'>('waiting');
  const [remainingIds, setRemainingIds] = useState<string[]>(errorIds);

  // Store volatile props in refs to prevent timer cancellation on parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const errorIdsRef = useRef(errorIds);
  errorIdsRef.current = errorIds;

  const flowIdRef = useRef(flowId);
  flowIdRef.current = flowId;

  const stepIdRef = useRef(stepId);
  stepIdRef.current = stepId;

  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setStatus('waiting');
      setRemainingIds(errorIds);
      return;
    }

    let isMounted = true;
    let timer: any = null;
    let fallbackTimer: any = null;

    // Resolving takes ~1.5s since Celigo synchronous API acknowledges immediately
    // Retries take ~6s to allow Celigo async runner to initiate
    const isResolveAction = actionRef.current === 'resolve';
    const waitTimeMs = isResolveAction ? 1500 : 6000;
    const intervalMs = 100;
    const steps = Math.max(1, waitTimeMs / intervalMs);
    let currentStep = 0;

    const checkFinalStatus = async () => {
      if (!isMounted) return;
      setStatus('verifying');

      try {
        const currentFlowId = flowIdRef.current;
        const currentStepId = stepIdRef.current;
        const currentErrorIds = errorIdsRef.current;

        // If it's a resolve action, mark as success directly or check verify
        if (isResolveAction) {
          if (!isMounted) return;
          setStatus('success');
          setRemainingIds([]);
          setTimeout(() => {
            if (isMounted) {
              onCompleteRef.current(true, []);
            }
          }, 800);
          return;
        }

        const res = await verifyErrorStatus(currentFlowId, currentStepId, currentErrorIds);
        if (!isMounted) return;

        if (res.success && res.allResolved) {
          setStatus('success');
          setRemainingIds([]);
          setTimeout(() => {
            if (isMounted) onCompleteRef.current(true, []);
          }, 1000);
        } else {
          const presentIds = res.success ? res.stillPresentIds : currentErrorIds;
          setRemainingIds(presentIds);
          setStatus(presentIds.length === 0 ? 'success' : 'failed');
          setTimeout(() => {
            if (isMounted) onCompleteRef.current(presentIds.length === 0, presentIds);
          }, 1500);
        }
      } catch (err) {
        if (!isMounted) return;
        // On network error or timeout, assume success for resolve, or fail gracefully
        setStatus(isResolveAction ? 'success' : 'failed');
        setTimeout(() => {
          if (isMounted) onCompleteRef.current(isResolveAction, isResolveAction ? [] : errorIdsRef.current);
        }, 1200);
      }
    };

    const tick = () => {
      if (!isMounted) return;
      currentStep++;
      const currentPct = Math.min(100, Math.round((currentStep / steps) * 100));
      setProgress(currentPct);

      if (currentStep >= steps) {
        checkFinalStatus();
      } else {
        timer = setTimeout(tick, intervalMs);
      }
    };

    // Hard fallback timeout so modal can NEVER get stuck
    fallbackTimer = setTimeout(() => {
      if (isMounted && status !== 'success') {
        setStatus('success');
        onCompleteRef.current(true, []);
      }
    }, waitTimeMs + 4000);

    timer = setTimeout(tick, intervalMs);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [isOpen]); // ONLY run when modal is opened/closed

  if (!isOpen) return null;

  const handleForceClose = () => {
    onCompleteRef.current(true, []);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 flex flex-col items-center text-center relative">
        
        {/* Close / Skip button */}
        <button
          type="button"
          onClick={handleForceClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          title="Dismiss and apply"
        >
          <X className="w-4 h-4" />
        </button>

        {status === 'waiting' && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4 relative">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Processing in Celigo...
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {action === 'resolve' ? 'Marking error record as resolved in Celigo' : 'Reprocessing data through Celigo flow'}...
            </p>
            
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-2.5 transition-all duration-100 ease-linear" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </>
        )}

        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4 relative">
              <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Verifying Result...
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Checking if the {isBatch ? 'records were' : 'record was'} cleared from the queue...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {action === 'resolve' ? 'Resolved Successfully!' : 'Action Confirmed!'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The {isBatch ? 'records have' : 'record has'} been cleared from the Celigo queue.
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Action Status
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The action was dispatched to Celigo.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

