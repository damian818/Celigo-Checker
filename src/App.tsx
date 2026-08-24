import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Terminal as TerminalIcon, 
  Sparkles, 
  ExternalLink,
  Zap
} from 'lucide-react';
import { CeligoErrorRecord, CeligoFlow, JiraTicket } from './types/celigo';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ErrorAnalysisView } from './components/ErrorAnalysisView';
import { AutomatedRemediationModal } from './components/AutomatedRemediationModal';
import { JiraTicketModal } from './components/JiraTicketModal';
import { NotificationModal } from './components/NotificationModal';
import { CustomErrorAnalyzerModal } from './components/CustomErrorAnalyzerModal';
import { SyncProgressModal } from './components/SyncProgressModal';
import { CeligoTokensModal } from './components/CeligoTokensModal';
import { WaitingActionModal } from './components/WaitingActionModal';
import { 
  triggerErrorRetry, 
  triggerBatchRetry,
  triggerErrorResolve, 
  triggerBatchResolve,
  fetchCeligoHealth, 
  fetchLiveFlows, 
  fetchLiveErrors, 
  fetchFlowErrors 
} from './services/apiClient';
import { buildCeligoFlowUrl } from './utils/celigoUrl';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
import {
  identifyFlowType,
  getCompanyNameOrIntegration,
  getShortErrorDescription,
  formatErrorSummary,
} from './utils/errorSummaryFormatter';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'errors'>('dashboard');
  const [waitingState, setWaitingState] = useState<{
    isOpen: boolean;
    action: 'retry' | 'resolve';
    isBatch: boolean;
    flowId: string;
    stepId: string;
    errorIds: string[];
    purgeFlag?: boolean;
  }>({
    isOpen: false,
    action: 'retry',
    isBatch: false,
    flowId: '',
    stepId: '',
    errorIds: []
  });
  const [flows, setFlows] = useState<CeligoFlow[]>([]);
  const [integrations, setIntegrations] = useState<import("./types/celigo").CeligoIntegration[]>([]);
  const [errors, setErrors] = useState<CeligoErrorRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedFlowFilter, setSelectedFlowFilter] = useState<string>('all');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [prodConnected, setProdConnected] = useState<boolean>(false);
  const [sandboxConnected, setSandboxConnected] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'live' | 'sandbox'>('live');

  // Sync Progress State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStep, setSyncStep] = useState<number>(1);
  const [syncStepMessage, setSyncStepMessage] = useState<string>('');
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [syncStats, setSyncStats] = useState<{ flowsCount?: number; errorsCount?: number; integrationsCount?: number }>({});
  
  // CLI Command injection state
  const [cliInitialCommand, setCliInitialCommand] = useState<string>('celigo flows:list');

  // Modals state
  const [selectedErrorForRemediation, setSelectedErrorForRemediation] = useState<CeligoErrorRecord | null>(null);
  const [selectedErrorForJira, setSelectedErrorForJira] = useState<CeligoErrorRecord | null>(null);
  const [selectedErrorForNotification, setSelectedErrorForNotification] = useState<CeligoErrorRecord | null>(null);
  const [showCustomAnalyzerModal, setShowCustomAnalyzerModal] = useState<boolean>(false);
  const [showTokensModal, setShowTokensModal] = useState<boolean>(false);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync with live Celigo REST API with multi-environment ingestion & real-time progress updates
  const syncCeligoData = async (isManual = false) => {
    setIsLoading(true);
    setIsSyncing(true);
    setSyncProgress(12);
    setSyncStep(1);
    setSyncStepMessage('Connecting to Celigo integrator.io API & verifying tokens...');
    if (isManual) {
      setShowSyncModal(true);
    }

    try {
      // Step 1: Health check & Token Handshake
      const health = await fetchCeligoHealth();
      setIsLiveConnected(health.celigoConnected);
      setProdConnected(Boolean(health.prodConnected));
      setSandboxConnected(Boolean(health.sandboxConnected));

      setSyncProgress(35);
      setSyncStep(2);
      setSyncStepMessage('Handshake verified. Querying active integration flows across Production & Sandbox...');

      if (health.celigoConnected) {
        // Step 2 & 3: Parallel Ingestion of Flows & Error Queues
        const liveFlowsPromise = fetchLiveFlows().then(res => {
          setSyncProgress(prev => Math.max(prev, 60));
          return res;
        });

        const liveErrorsPromise = fetchLiveErrors().then(res => {
          setSyncProgress(prev => Math.max(prev, 82));
          return res;
        });

        setSyncStepMessage('Ingesting execution logs and retrieving failed payload queues...');
        const [liveFlowsRes, liveErrorsRes] = await Promise.all([
          liveFlowsPromise,
          liveErrorsPromise,
        ]);

        // Step 4: Clustering & Grouping
        setSyncStep(4);
        setSyncProgress(92);
        setSyncStepMessage('Aggregating duplicate errors and computing blast radius...');

        const fetchedFlows = liveFlowsRes.flows || [];
        const fetchedIntegrations = liveFlowsRes.integrations || [];
        const fetchedErrors = liveErrorsRes.errors || [];

        if (liveFlowsRes.connected) {
          setFlows(fetchedFlows);
          setIntegrations(fetchedIntegrations);
          setDataSource('live');
        }

        if (liveErrorsRes.connected) {
          const enrichedErrors = fetchedErrors.map((err: CeligoErrorRecord) => {
            const flowType = identifyFlowType(err);
            const companyName = getCompanyNameOrIntegration(err, 'Gappify Account');
            const shortDesc = getShortErrorDescription(err);
            const formattedSummary = formatErrorSummary(err, companyName, shortDesc);
            return {
              ...err,
              flowType,
              companyName,
              formattedSummary,
            };
          });
          setErrors(enrichedErrors);
          setDataSource('live');
        }

        setSyncStats({
          flowsCount: fetchedFlows.length,
          integrationsCount: fetchedIntegrations.length,
          errorsCount: fetchedErrors.length,
        });

        // Step 5: Finalized
        setSyncProgress(100);
        setSyncStepMessage('✓ Synchronization Complete!');

        if (isManual) {
          const prodFlows = liveFlowsRes.prodFlowCount ?? fetchedFlows.filter((f: any) => f.environment === 'production').length;
          const sbxFlows = liveFlowsRes.sandboxFlowCount ?? fetchedFlows.filter((f: any) => f.environment === 'sandbox').length;
          showToast(`✓ Synced ${fetchedFlows.length} flows (${prodFlows} Prod, ${sbxFlows} Sandbox) & ${fetchedErrors.length} errors from Celigo!`, 'success');
        }

        // Brief delay before smoothly closing modal so user sees the 100% completion
        setTimeout(() => {
          setShowSyncModal(false);
          setIsSyncing(false);
        }, 700);
      } else {
        setDataSource('sandbox');
        setFlows([]);
        setIntegrations([]);
        setErrors([]);
        setSyncProgress(100);
        setSyncStepMessage('No live tokens configured');
        if (isManual) {
          showToast('Configure your Celigo Tokens via "API Tokens" to sync live data.', 'info');
        }
        setTimeout(() => {
          setShowSyncModal(false);
          setIsSyncing(false);
        }, 600);
      }
    } catch (err: any) {
      console.error('Error syncing Celigo data:', err);
      setSyncStepMessage(`Sync error: ${err.message}`);
      if (isManual) {
        showToast(`Sync failed: ${err.message}`, 'error');
      }
      setTimeout(() => {
        setShowSyncModal(false);
        setIsSyncing(false);
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncCeligoData(false);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
      }
      showToast('Successfully authenticated with Google Workspace', 'success');
    } catch (error: any) {
      console.error('Login error', error);
      if (error.code === 'auth/unauthorized-domain') {
        showToast(
          `Domain not authorized in Firebase: Please add "${window.location.hostname}" to Firebase Console -> Authentication -> Settings -> Authorized domains`,
          'error'
        );
      } else if (error.code === 'auth/popup-blocked') {
        showToast('OAuth popup was blocked by browser. Please allow popups for this domain and try again.', 'error');
      } else {
        showToast(`Login failed: ${error.message}`, 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('google_access_token');
      showToast('Logged out successfully', 'info');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  // Handler when user clicks "Analyze" on a flow in Dashboard
  const handleSelectFlowForAnalysis = async (flowId: string) => {
    setSelectedFlowFilter(flowId);
    setActiveTab('errors');

    const targetFlow = flows.find(f => f.id === flowId);
    const flowName = targetFlow?.name || 'Selected Flow';

    try {
      const res = await fetchFlowErrors(flowId);
      if (res.connected && res.errors && res.errors.length > 0) {
        setErrors(prev => {
          const others = prev.filter(e => e.flowId !== flowId);
          return [...others, ...res.errors];
        });
        showToast(`Loaded ${res.errors.length} detailed error records for "${flowName}"`, 'success');
      } else {
        // If detailed step errors API didn't return items but the flow has errors, synthesize an actionable record
        setErrors(prev => {
          const existing = prev.find(e => e.flowId === flowId);
          if (!existing) {
            const errCount = (targetFlow?.unresolvedErrors || 0) > 0 
              ? targetFlow?.unresolvedErrors 
              : (targetFlow?.errorCount24h || 1);
            
            const syntheticRecord: CeligoErrorRecord = {
              id: `flow_${flowId}_err`,
              flowId: flowId,
              flowName: targetFlow?.name || 'Celigo Flow',
              integrationId: targetFlow?.integrationId,
              integrationName: targetFlow?.integrationName || targetFlow?.group || 'Celigo Integration',
              sectionId: targetFlow?.sectionId,
              environment: targetFlow?.environment || 'production',
              environmentLabel: targetFlow?.environmentLabel || 'Production',
              sourceApp: targetFlow?.sourceApp?.name || targetFlow?.sourceApp || 'Source App',
              targetApp: targetFlow?.targetApp?.name || targetFlow?.targetApp || 'Target App',
              severity: (errCount || 1) > 5 ? 'critical' : 'high',
              category: 'data_validation',
              status: 'unresolved',
              rawErrorCode: 'UNRESOLVED_FLOW_EXECUTION_ERROR',
              rawErrorMessage: `Flow execution encountered ${errCount} unresolved error(s). Review target application payload and mappings in Celigo.`,
              recordIdentifier: flowId.slice(-8).toUpperCase(),
              recordType: targetFlow?.name || 'Flow Record',
              plainEnglishSummary: `The "${flowName}" integration encountered ${errCount} sync error(s). Records were rejected by ${targetFlow?.targetApp?.name || 'target system'} during execution.`,
              businessImpact: `Data synchronization is halted for ${errCount} record(s). Dependent downstream workflows are delayed.`,
              rootCauseSimple: `Data mapping or schema validation error during page processing.`,
              actionRequiredBy: 'IT Support',
              retrySafety: 'verify_data',
              retrySafetyReason: 'Review payload mappings and required fields before initiating one-click retry.',
              suggestedCliCommand: `celigo flows:retry-errors --flowId ${flowId}`,
              suggestedRemediationScript: `// Celigo PreSavePage Hook for ${flowName}\nfunction preSavePage(options) {\n  // Validate required payload properties\n  return options.data;\n}`,
              timestamp: targetFlow?.lastRunTime || new Date().toISOString(),
              retryCount: 0,
              maxRetries: 5,
              unresolvedCount: errCount,
              rawPayload: {
                flowId: flowId,
                flowName: targetFlow?.name,
                integrationId: targetFlow?.integrationId,
                sectionId: targetFlow?.sectionId,
                unresolvedErrors: targetFlow?.unresolvedErrors,
                errorCount24h: targetFlow?.errorCount24h,
                lastRunTime: targetFlow?.lastRunTime,
                sourceApp: targetFlow?.sourceApp,
                targetApp: targetFlow?.targetApp,
              },
              celigoUrl: buildCeligoFlowUrl(targetFlow || { flowId }),
            };
            return [syntheticRecord, ...prev];
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error('Error fetching flow errors on select:', err);
    }
  };

  // Quick 1-Click Retry Handler (POST /v1/flows/{flowId}/{exportOrImportId}/retry with retryDataKey)
  const handleQuickRetry = async (errorId: string) => {
    const errorRecord = errors.find(e => e.id === errorId);
    if (!errorRecord) return;

    showToast(`Dispatched retry payload for ${errorRecord.recordIdentifier || errorId} to Celigo...`, 'info');

    try {
      const stepId = errorRecord.exportOrImportId || errorRecord.stepId || '';
      const retryKey = errorRecord.retryDataKey || errorRecord.id || '';

      const res = await triggerErrorRetry({
        errorId,
        flowId: errorRecord.flowId,
        stepId,
        retryDataKey: retryKey,
        retryDataKeys: retryKey ? [retryKey] : undefined,
      });

      if (res.success) {
        setWaitingState({
          isOpen: true,
          action: 'retry',
          isBatch: false,
          flowId: errorRecord.flowId || '',
          stepId,
          errorIds: [retryKey],
        });
      } else {
        showToast(`Retry failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Retry failed: ${err.message || 'Server error'}`, 'error');
    }
  };

  // Batch Retry Handler for groups of error records
  const handleBatchRetry = async (errorIds: string[], flowId?: string) => {
    if (!errorIds || errorIds.length === 0) return;
    showToast(`Initiating batch retry for ${errorIds.length} records in Celigo...`, 'info');

    try {
      const relevantRecords = errors.filter(e => errorIds.includes(e.id || ''));
      const firstRecord = relevantRecords[0];
      const stepId = firstRecord?.exportOrImportId || firstRecord?.stepId || '';
      const retryDataKeys = relevantRecords.map(r => r.retryDataKey || r.id).filter(Boolean) as string[];

      const res = await triggerBatchRetry({
        errorIds,
        flowId,
        stepId,
        retryDataKeys: retryDataKeys.length > 0 ? retryDataKeys : undefined,
      });

      if (res.success) {
        setWaitingState({
          isOpen: true,
          action: 'retry',
          isBatch: true,
          flowId: flowId || '',
          stepId,
          errorIds: retryDataKeys,
        });
      } else {
        showToast(`Batch retry failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Batch retry failed: ${err.message || 'Server error'}`, 'error');
    }
  };

  // Resolve / Purge Error in Celigo (PUT /v1/flows/{flowId}/{exportOrImportId}/resolved)
  const handleQuickResolve = async (errorId: string, purge = false) => {
    const errorRecord = errors.find(e => e.id === errorId);
    if (!errorRecord) return;

    showToast(`Marking error ${errorRecord.recordIdentifier || errorId} as resolved in Celigo...`, 'info');

    try {
      const stepId = errorRecord.exportOrImportId || errorRecord.stepId || '';
      const res = await triggerErrorResolve({
        errorId,
        flowId: errorRecord.flowId,
        stepId,
        purge,
      });

      if (res.success) {
        setWaitingState({
          isOpen: true,
          action: 'resolve',
          isBatch: false,
          flowId: errorRecord.flowId || '',
          stepId,
          errorIds: [errorId],
          purgeFlag: purge
        });
      } else {
        showToast(`Resolve failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Resolve failed: ${err.message || 'Server error'}`, 'error');
    }
  };

  // Resolve Error after manual fix
  const handleResolveError = (errorId: string) => {
    handleQuickResolve(errorId, false);
  };

  // Batch Resolve / Purge for group of error records
  const handleBatchResolve = async (errorIds: string[], flowId?: string, purge = false) => {
    if (!errorIds || errorIds.length === 0) return;
    showToast(`Resolving & purging ${errorIds.length} error records in Celigo...`, 'info');

    try {
      const relevantRecords = errors.filter(e => errorIds.includes(e.id || ''));
      const firstRecord = relevantRecords[0];
      const stepId = firstRecord?.exportOrImportId || firstRecord?.stepId || '';

      const res = await triggerBatchResolve({
        errorIds,
        flowId,
        stepId,
        purge,
      });

      if (res.success) {
        setWaitingState({
          isOpen: true,
          action: 'resolve',
          isBatch: true,
          flowId: flowId || '',
          stepId,
          errorIds,
          purgeFlag: purge
        });
      } else {
        showToast(`Batch resolve failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Batch resolve failed: ${err.message || 'Server error'}`, 'error');
    }
  };

  const handleWaitingComplete = (success: boolean, remainingIds: string[]) => {
    if (success) {
      const { errorIds, flowId, action, isBatch, purgeFlag } = waitingState;
      
      const updatedErrorIds = new Set(errorIds);

      setErrors(prev =>
        prev.map(e => {
          const matchId = action === 'retry' ? (e.retryDataKey || e.id || '') : (e.id || '');
          if (updatedErrorIds.has(matchId)) {
            return {
              ...e, 
              status: 'resolved', 
              retryCount: action === 'retry' ? ((e.retryCount || 0) + 1) : e.retryCount,
              resolutionMethod: action === 'resolve' && purgeFlag ? 'purged' : e.resolutionMethod
            };
          }
          return e;
        })
      );

      if (flowId) {
        setFlows(prev =>
          prev.map(f => f.id === flowId ? { ...f, unresolvedErrors: Math.max(0, (f.unresolvedErrors || 0) - errorIds.length) } : f)
        );
      }

      if (action === 'retry') {
        confetti({ particleCount: isBatch ? 60 : 50, spread: isBatch ? 70 : 60, origin: { y: 0.7 } });
        showToast(`✓ Successfully reprocessed ${isBatch ? errorIds.length + ' records' : 'record'} in Celigo!`, 'success');
      } else {
        showToast(`✓ Resolved ${isBatch ? errorIds.length + ' records' : 'record'} in Celigo queue.`, 'success');
      }
    }
    setWaitingState(prev => ({ ...prev, isOpen: false }));
  };

  // Update single error record (e.g. from AI analysis)
  const handleUpdateError = (updatedError: CeligoErrorRecord) => {
    setErrors(prev =>
      prev.map(e => e.id === updatedError.id ? updatedError : e)
    );
    showToast(`AI Root Cause Analysis updated for ${updatedError.recordIdentifier}`, 'success');
  };

  // Update entire group of errors with AI analysis
  const handleUpdateGroup = (updatedError: CeligoErrorRecord, groupKey: string) => {
    setErrors(prev =>
      prev.map(e => {
        const key = `${e.flowId || 'unknown_flow'}:::${(e.rawErrorMessage || e.rawErrorCode || 'unknown_error').trim().replace(/\s+/g, ' ').toLowerCase()}`;
        if (key === groupKey || e.id === updatedError.id) {
          return {
            ...e,
            plainEnglishSummary: updatedError.plainEnglishSummary || e.plainEnglishSummary,
            businessImpact: updatedError.businessImpact || e.businessImpact,
            rootCauseSimple: updatedError.rootCauseSimple || e.rootCauseSimple,
            actionRequiredBy: updatedError.actionRequiredBy || e.actionRequiredBy,
            retrySafety: updatedError.retrySafety || e.retrySafety,
            retrySafetyReason: updatedError.retrySafetyReason || e.retrySafetyReason,
            suggestedCliCommand: updatedError.suggestedCliCommand || e.suggestedCliCommand,
            suggestedRemediationScript: updatedError.suggestedRemediationScript || e.suggestedRemediationScript,
          };
        }
        return e;
      })
    );
    showToast(`Updated AI analysis for all records in this error group`, 'success');
  };


  // Add newly fetched step errors
  const handleAddErrors = (newErrors: CeligoErrorRecord[]) => {
    setErrors(prev => {
      const newIds = new Set(newErrors.map(e => e.id));
      const filtered = prev.filter(e => !newIds.has(e.id));
      return [...newErrors, ...filtered];
    });
    showToast(`Loaded ${newErrors.length} error records from Celigo`, 'success');
  };

  // Ignore Error
  const handleIgnoreError = (errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
    showToast(`Error archived and ignored.`, 'info');
  };

  // Run in CLI Terminal
  const handleRunInCli = (command: string) => {
    setCliInitialCommand(command);
    setActiveTab('cli');
    showToast(`Loaded "${command}" into Celigo CLI Terminal`, 'info');
  };

  // Jira Ticket Created Callback
  const handleJiraTicketCreated = (ticket: JiraTicket, errorId: string) => {
    setErrors(prev =>
      prev.map(e => e.id === errorId ? { ...e, jiraTicketId: ticket.key } : e)
    );
    showToast(`Jira Ticket ${ticket.key} created for ${ticket.assignee.name}!`, 'success');
  };

  const [environment, setEnvironment] = useState<string>('Production');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  const handleManualRefresh = () => {
    syncCeligoData(true);
  };

  const unresolvedCount = errors.filter(e => e.status === 'unresolved').length;

  return (
    <div id="celigo-hub-root" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unresolvedCount={unresolvedCount}
        environment={environment}
        setEnvironment={setEnvironment}
        onManualRefresh={handleManualRefresh}
        prodConnected={prodConnected}
        sandboxConnected={sandboxConnected}
        onOpenCustomAnalyzer={() => setShowCustomAnalyzerModal(true)}
        onOpenTokensModal={() => setShowTokensModal(true)}
        isSyncing={isSyncing}
        syncProgress={syncProgress}
        syncStepMessage={syncStepMessage}
        onShowSyncModal={() => setShowSyncModal(true)}
        user={user}
        isLoggingIn={isLoggingIn}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        {isAuthChecking ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-400">Verifying Google Workspace session...</p>
          </div>
        ) : !user ? (
          /* Google Workspace Required Login Gate */
          <div className="max-w-2xl mx-auto my-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-8 text-center relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Logo / Badge */}
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shadow-inner">
                  <Zap className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 inline-block">
                  Authentication Required
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Sign in to Celigo Incident Hub
                </h2>
                <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                  To protect integration credentials and live customer payloads, sign in with your corporate Google Workspace account before accessing the monitoring dashboard and error queues.
                </p>
              </div>

              {/* Sign In Button */}
              <div className="pt-2 flex flex-col items-center justify-center gap-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>{isLoggingIn ? 'Authenticating...' : 'Sign in with Google Workspace'}</span>
                </button>
              </div>

              {/* Security & Features Checklist */}
              <div className="pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Real-Time Health</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Live monitoring of flows & sync velocity across environments.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Payload Triage</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Inspect raw failed JSON payloads with 1-click batch retries.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Jira & Alerts</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Automated incident tickets & Google Workspace notifications.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Application Views */
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                integrations={integrations}
                flows={flows}
                errors={errors}
                onSelectFlow={handleSelectFlowForAnalysis}
                onSelectError={(err) => setSelectedErrorForRemediation(err)}
                onOpenJiraModal={(err) => setSelectedErrorForJira(err)}
                onOpenRemediationModal={(err) => setSelectedErrorForRemediation(err)}
                onOpenNotificationModal={(err) => setSelectedErrorForNotification(err)}
                onSwitchTab={setActiveTab}
                onQuickRetry={handleQuickRetry}
                onQuickResolve={handleQuickResolve}
                onBatchRetry={handleBatchRetry}
                onBatchResolve={handleBatchResolve}
                isLiveConnected={isLiveConnected}
                dataSource={dataSource}
                onRefreshLive={() => syncCeligoData(true)}
                isSyncing={isSyncing}
                syncProgress={syncProgress}
                syncStepMessage={syncStepMessage}
                onShowSyncModal={() => setShowSyncModal(true)}
              />
            )}

            {activeTab === 'errors' && (
              <ErrorAnalysisView
                errors={errors}
                flows={flows}
                integrations={integrations}
                selectedFlowFilter={selectedFlowFilter}
                setSelectedFlowFilter={setSelectedFlowFilter}
                onOpenJiraModal={(err) => setSelectedErrorForJira(err)}
                onOpenRemediationModal={(err) => setSelectedErrorForRemediation(err)}
                onOpenNotificationModal={(err) => setSelectedErrorForNotification(err)}
                onQuickRetry={handleQuickRetry}
                onBatchRetry={handleBatchRetry}
                onQuickResolve={handleQuickResolve}
                onBatchResolve={handleBatchResolve}
                onRunInCli={handleRunInCli}
                onIgnoreError={handleIgnoreError}
                onUpdateError={handleUpdateError}
                onUpdateGroup={handleUpdateGroup}
                onAddErrors={handleAddErrors}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>Celigo Enterprise Integration Hub</span>
          <span>•</span>
          <span className="text-emerald-400">● Live MCP Protocol v1.4</span>
          <span>•</span>
          <span>integrator.io connected</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <a href="https://developer.celigo.com/mcp" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-400 hover:underline flex items-center gap-0.5">
            MCP Docs <ExternalLink className="w-3 h-3" />
          </a>
          <a href="https://developer.celigo.com/cli" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-400 hover:underline flex items-center gap-0.5">
            Celigo CLI <ExternalLink className="w-3 h-3" />
          </a>
          <a href="https://developer.celigo.com/api" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-400 hover:underline flex items-center gap-0.5">
            REST API Spec <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950 border-rose-700 text-rose-200'
                : 'bg-slate-900 border-indigo-700 text-slate-100'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toastMessage.type === 'info' && <Zap className="w-4 h-4 text-indigo-400" />}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 hover:opacity-80 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showSyncModal}
        progress={syncProgress}
        currentStep={syncStep}
        stepMessage={syncStepMessage}
        stats={syncStats}
        onMinimize={() => setShowSyncModal(false)}
      />

      {/* Celigo Tokens Modal */}
      {showTokensModal && (
        <CeligoTokensModal
          onClose={() => setShowTokensModal(false)}
          onTokensUpdated={() => {
            setShowTokensModal(false);
            syncCeligoData(true);
          }}
          prodConnected={prodConnected}
          sandboxConnected={sandboxConnected}
        />
      )}

      {/* Modals */}
      {selectedErrorForRemediation && (
        <AutomatedRemediationModal
          error={selectedErrorForRemediation}
          onClose={() => setSelectedErrorForRemediation(null)}
          onRunCliCommand={handleRunInCli}
          onResolveError={handleResolveError}
        />
      )}

      {selectedErrorForJira && (
        <JiraTicketModal
          error={selectedErrorForJira}
          onClose={() => setSelectedErrorForJira(null)}
          onTicketCreated={handleJiraTicketCreated}
        />
      )}

      {selectedErrorForNotification && (
        <NotificationModal
          error={selectedErrorForNotification}
          onClose={() => setSelectedErrorForNotification(null)}
        />
      )}

      {showCustomAnalyzerModal && (
        <CustomErrorAnalyzerModal
          onClose={() => setShowCustomAnalyzerModal(false)}
          onRunCliCommand={handleRunInCli}
        />
      )}

      {/* Waiting Action Modal */}
      <WaitingActionModal
        isOpen={waitingState.isOpen}
        action={waitingState.action}
        isBatch={waitingState.isBatch}
        flowId={waitingState.flowId}
        stepId={waitingState.stepId}
        errorIds={waitingState.errorIds}
        onComplete={handleWaitingComplete}
      />
    </div>
  );
}
