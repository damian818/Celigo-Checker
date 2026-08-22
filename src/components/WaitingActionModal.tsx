import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setStatus('waiting');
      setRemainingIds(errorIds);
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout;
    
    // We wait 12 seconds before checking, as Celigo takes time to process
    // and errors drop out of the queue immediately and return if failed.
    const waitTimeMs = 12000;
    const intervalMs = 100;
    const steps = waitTimeMs / intervalMs;
    let currentStep = 0;

    const tick = () => {
      if (!isMounted) return;
      
      currentStep++;
      setProgress(Math.min(100, (currentStep / steps) * 100));

      if (currentStep >= steps) {
        setStatus('verifying');
        checkFinalStatus();
      } else {
        timer = setTimeout(tick, intervalMs);
      }
    };

    const checkFinalStatus = async () => {
      try {
        const res = await verifyErrorStatus(flowId, stepId, errorIds);
        if (!isMounted) return;

        if (res.success && res.allResolved) {
          setStatus('success');
          setRemainingIds([]);
          setTimeout(() => {
            if (isMounted) onComplete(true, []);
          }, 1500);
        } else {
          // If it failed or still present
          const presentIds = res.success ? res.stillPresentIds : errorIds;
          setRemainingIds(presentIds);
          setStatus('failed');
          setTimeout(() => {
            if (isMounted) onComplete(false, presentIds);
          }, 2500);
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus('failed');
        setTimeout(() => {
          if (isMounted) onComplete(false, errorIds);
        }, 2500);
      }
    };

    timer = setTimeout(tick, intervalMs);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, action, flowId, stepId, errorIds, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 flex flex-col items-center text-center">
        
        {status === 'waiting' && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4 relative">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Processing in Celigo...
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Celigo is processing the {action} request. This usually takes about 10-12 seconds.
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
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4 relative">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
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
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Action Confirmed!
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The {isBatch ? 'records have' : 'record has'} been cleared from the error queue.
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Action Failed
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The action was dispatched, but {remainingIds.length} record(s) returned to the queue.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
