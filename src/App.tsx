import React, { useState, useEffect, useRef } from 'react';
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
import { SignInPage } from './components/SignInPage';
import { DashboardView } from './components/DashboardView';
import { ErrorAnalysisView } from './components/ErrorAnalysisView';
import { AutomatedRemediationModal } from './components/AutomatedRemediationModal';
import { JiraTicketModal } from './components/JiraTicketModal';
import { NotificationModal } from './components/NotificationModal';
import { CustomErrorAnalyzerModal } from './components/CustomErrorAnalyzerModal';
import { SyncProgressModal } from './components/SyncProgressModal';
import { CeligoTokensModal } from './components/CeligoTokensModal';
import { WaitingActionModal } from './components/WaitingActionModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { NotificationService } from './services/notificationService';
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
import { auth, googleProvider, isAllowedEmail, ALLOWED_DOMAIN } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
import {
  identifyFlowType,
  getCompanyNameOrIntegration,
  getShortErrorDescription,
  formatErrorSummary,
} from './utils/errorSummaryFormatter';

interface LocalResolvedCache {
  resolvedFlowIds: Record<string, number>;
  resolvedErrorIds: Record<string, number>;
}

const LOCAL_RESOLVED_KEY = 'celigo_resolved_cache_v1';

function getLocalResolvedCache(): LocalResolvedCache {
  try {
    const raw = localStorage.getItem(LOCAL_RESOLVED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;
      const resolvedFlowIds: Record<string, number> = {};
      const resolvedErrorIds: Record<string, number> = {};
      Object.entries(parsed.resolvedFlowIds || {}).forEach(([k, v]) => {
        if (now - (v as number) < maxAge) resolvedFlowIds[k] = v as number;
      });
      Object.entries(parsed.resolvedErrorIds || {}).forEach(([k, v]) => {
        if (now - (v as number) < maxAge) resolvedErrorIds[k] = v as number;
      });
      return { resolvedFlowIds, resolvedErrorIds };
    }
  } catch {}
  return { resolvedFlowIds: {}, resolvedErrorIds: {} };
}

function saveToLocalResolvedCache(flowId?: string, errorIds?: string[]) {
  try {
    const current = getLocalResolvedCache();
    const now = Date.now();
    if (flowId) {
      current.resolvedFlowIds[flowId] = now;
    }
    if (errorIds) {
      errorIds.forEach(id => {
        if (id) current.resolvedErrorIds[id] = now;
      });
    }
    localStorage.setItem(LOCAL_RESOLVED_KEY, JSON.stringify(current));
  } catch {}
}

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

  // PWA Web App Installation Hook
  const { isInstallable, isInstalled, installApp } = usePWAInstall();

  // Auto-sync frequency (defaults to 30 minutes) & countdown ticker
  const [autoSyncIntervalMinutes, setAutoSyncIntervalMinutes] = useState<number>(30);
  const [nextSyncSecondsRemaining, setNextSyncSecondsRemaining] = useState<number>(30 * 60);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return NotificationService.getPermissionState() === 'granted';
  });

  // Track known error IDs to detect new errors during background syncs
  const prevErrorIdsRef = useRef<Set<string>>(new Set());
  const isInitialSyncRef = useRef<boolean>(true);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRequestNotificationPermission = async () => {
    const permission = await NotificationService.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      NotificationService.playAlertChime();
      NotificationService.notifyNewErrors(0, []);
      showToast('✓ Browser notifications enabled! You will be alerted when new errors are found.', 'success');
    } else {
      setNotificationsEnabled(false);
      showToast('Notifications permission was blocked or dismissed.', 'info');
    }
  };

  const handleInstallPWA = async () => {
    if (isInstallable) {
      const installed = await installApp();
      if (installed) {
        showToast('✓ Gappify Celigo Remediation Hub installed as a Web App!', 'success');
      }
    } else {
      showToast('To install: click the Install icon in your browser address bar or menu ("Install Gappify Celigo Hub").', 'info');
    }
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
        const resolvedCache = getLocalResolvedCache();

        // Apply local resolution cache filter to flows and errors
        const activeFlows = fetchedFlows.map((f: any) => {
          if (resolvedCache.resolvedFlowIds[f.id]) {
            return { ...f, unresolvedErrors: 0, errorCount24h: 0, status: 'healthy' };
          }
          return f;
        });

        const activeErrors = fetchedErrors.filter((err: any) => {
          if (err.flowId && resolvedCache.resolvedFlowIds[err.flowId]) return false;
          if (err.id && resolvedCache.resolvedErrorIds[err.id]) return false;
          if (err.retryDataKey && resolvedCache.resolvedErrorIds[err.retryDataKey]) return false;
          return true;
        });

        if (liveFlowsRes.connected) {
          setFlows(activeFlows);
          setIntegrations(fetchedIntegrations);
          setDataSource('live');
        }

        if (liveErrorsRes.connected) {
          const enrichedErrors = activeErrors.map((err: CeligoErrorRecord) => {
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

          // Detect new errors since last sync
          const currentErrorIds = new Set<string>();
          const newlyDiscoveredErrors: CeligoErrorRecord[] = [];

          enrichedErrors.forEach((err: CeligoErrorRecord) => {
            const errorKey = err.id || err.retryDataKey || `${err.flowId}_${err.occurredAt}_${err.message}`;
            currentErrorIds.add(errorKey);
            if (!isInitialSyncRef.current && !prevErrorIdsRef.current.has(errorKey)) {
              newlyDiscoveredErrors.push(err);
            }
          });

          prevErrorIdsRef.current = currentErrorIds;

          if (!isInitialSyncRef.current && newlyDiscoveredErrors.length > 0) {
            const affectedFlows = Array.from(new Set(newlyDiscoveredErrors.map(e => e.flowName || 'Integration Flow')));
            // Play alert sound
            NotificationService.playAlertChime();
            // Dispatch browser OS notification
            NotificationService.notifyNewErrors(newlyDiscoveredErrors.length, affectedFlows);
            // In-app alert
            showToast(`⚠️ ${newlyDiscoveredErrors.length} new Celigo integration error(s) detected during sync!`, 'error');
          }

          isInitialSyncRef.current = false;
        }

        setSyncStats({
          flowsCount: activeFlows.length,
          integrationsCount: fetchedIntegrations.length,
          errorsCount: activeErrors.length,
        });

        // Step 5: Finalized
        setSyncProgress(100);
        setSyncStepMessage('✓ Synchronization Complete!');

        if (isManual) {
          const prodFlows = liveFlowsRes.prodFlowCount ?? fetchedFlows.filter((f: any) => f.environment === 'production').length;
          const sbxFlows = liveFlowsRes.sandboxFlowCount ?? fetchedFlows.filter((f: any) => f.environment === 'sandbox').length;
          showToast(`✓ Synced ${fetchedFlows.length} flows (${prodFlows} Prod, ${sbxFlows} Sandbox) & ${fetchedErrors.length} errors from Celigo!`, 'success');
        }

        // Reset next sync timer countdown
        setNextSyncSecondsRemaining(autoSyncIntervalMinutes * 60);

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

  // Automatic Background Periodic Sync Timer (every 30 minutes or selected interval)
  useEffect(() => {
    if (!user) return;

    const timer = setInterval(() => {
      setNextSyncSecondsRemaining(prev => {
        if (prev <= 1) {
          // Perform automatic background sync
          syncCeligoData(false);
          return autoSyncIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [user, autoSyncIntervalMinutes]);

  // Reset countdown when interval setting is changed
  useEffect(() => {
    setNextSyncSecondsRemaining(autoSyncIntervalMinutes * 60);
  }, [autoSyncIntervalMinutes]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!isAllowedEmail(currentUser.email)) {
          console.warn(`User ${currentUser.email} is not from @${ALLOWED_DOMAIN}. Signing out.`);
          await signOut(auth);
          localStorage.removeItem('google_access_token');
          setUser(null);
          setFlows([]);
          setErrors([]);
          setIntegrations([]);
          setProdConnected(false);
          setSandboxConnected(false);
          showToast(`Access Restricted: Only @${ALLOWED_DOMAIN} accounts are authorized to access this hub.`, 'error');
        } else {
          setUser(currentUser);
          // Only fetch Celigo data after successful domain authentication
          syncCeligoData(false);
        }
      } else {
        setUser(null);
        setFlows([]);
        setErrors([]);
        setIntegrations([]);
        setProdConnected(false);
        setSandboxConnected(false);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Strict Domain Validation: Only @gappify.com allowed
      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth);
        localStorage.removeItem('google_access_token');
        setUser(null);
        setFlows([]);
        setErrors([]);
        setIntegrations([]);
        showToast(`Access Restricted: Login is limited to @${ALLOWED_DOMAIN} email accounts only. (${result.user.email} is not authorized)`, 'error');
        return;
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
      }
      setUser(result.user);
      showToast(`Welcome ${result.user.displayName || result.user.email}! Authenticated with Gappify Workspace.`, 'success');
      syncCeligoData(false);
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
      setUser(null);
      setFlows([]);
      setErrors([]);
      setIntegrations([]);
      setProdConnected(false);
      setSandboxConnected(false);
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
    const resolvedCache = getLocalResolvedCache();

    // If flow is already resolved, don't synthesize false errors
    if (resolvedCache.resolvedFlowIds[flowId] || targetFlow?.unresolvedErrors === 0) {
      setErrors(prev => prev.filter(e => e.flowId !== flowId));
      return;
    }

    try {
      const res = await fetchFlowErrors(flowId);
      if (res.connected && res.errors && res.errors.length > 0) {
        const activeResErrors = res.errors.filter((e: CeligoErrorRecord) => {
          if (resolvedCache.resolvedFlowIds[flowId]) return false;
          if (e.id && resolvedCache.resolvedErrorIds[e.id]) return false;
          if (e.retryDataKey && resolvedCache.resolvedErrorIds[e.retryDataKey]) return false;
          return true;
        });

        setErrors(prev => {
          const others = prev.filter(e => e.flowId !== flowId);
          return [...others, ...activeResErrors];
        });
        if (activeResErrors.length > 0) {
          showToast(`Loaded ${activeResErrors.length} detailed error records for "${flowName}"`, 'success');
        }
      } else if ((targetFlow?.unresolvedErrors || 0) > 0 && !resolvedCache.resolvedFlowIds[flowId]) {
        // If detailed step errors API didn't return items but the flow genuinely has unresolved errors
        setErrors(prev => {
          const existing = prev.find(e => e.flowId === flowId);
          if (!existing) {
            const errCount = targetFlow?.unresolvedErrors || 1;
            
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
        saveToLocalResolvedCache(errorRecord.flowId, [errorId, retryKey]);
        setWaitingState({
          isOpen: true,
          action: 'retry',
          isBatch: false,
          flowId: errorRecord.flowId || '',
          stepId,
          errorIds: [retryKey, errorId],
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
        saveToLocalResolvedCache(flowId, [...errorIds, ...retryDataKeys]);
        setWaitingState({
          isOpen: true,
          action: 'retry',
          isBatch: true,
          flowId: flowId || '',
          stepId,
          errorIds: retryDataKeys.length > 0 ? retryDataKeys : errorIds,
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
        saveToLocalResolvedCache(errorRecord.flowId, [errorId]);
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
        saveToLocalResolvedCache(flowId, errorIds);
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
      
      saveToLocalResolvedCache(flowId, errorIds);
      const updatedErrorIds = new Set(errorIds);

      setErrors(prev =>
        prev.map(e => {
          const matchId = action === 'retry' ? (e.retryDataKey || e.id || '') : (e.id || '');
          if (updatedErrorIds.has(matchId) || (e.id && updatedErrorIds.has(e.id))) {
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
          prev.map(f => f.id === flowId ? { ...f, unresolvedErrors: 0, status: 'healthy' } : f)
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

  const handleManualRefresh = () => {
    syncCeligoData(true);
  };

  const unresolvedCount = errors.filter(e => e.status === 'unresolved').length;

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#060B13] text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">Verifying Gappify Workspace session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <SignInPage onLogin={handleGoogleLogin} isLoggingIn={isLoggingIn} />
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
                className="p-1 hover:opacity-80 text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div id="celigo-hub-root" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500 selection:text-white flex flex-col">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unresolvedCount={unresolvedCount}
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
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onInstallPWA={handleInstallPWA}
        autoSyncIntervalMinutes={autoSyncIntervalMinutes}
        nextSyncCountdown={formatCountdown(nextSyncSecondsRemaining)}
        notificationsEnabled={notificationsEnabled}
        onRequestNotificationPermission={handleRequestNotificationPermission}
        onChangeAutoSyncInterval={(mins) => {
          setAutoSyncIntervalMinutes(mins);
          showToast(`Auto-sync interval set to every ${mins} minutes`, 'info');
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        {/* Authenticated Application Views */}
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
