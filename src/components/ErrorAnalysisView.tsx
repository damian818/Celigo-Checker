import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  RefreshCw, 
  Zap, 
  Bot, 
  FileText, 
  Send, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ShieldAlert, 
  Clock, 
  Sparkles,
  ExternalLink,
  Code,
  Loader2,
  Layers,
  List,
  ShieldCheck,
  RotateCcw,
  X,
  ArrowRight,
  Trash2,
  Tag
} from 'lucide-react';
import { CeligoErrorRecord, CeligoFlow, CeligoIntegration, ErrorSeverity, RetrySafety } from '../types/celigo';
import { requestErrorAnalysis, fetchFlowErrors } from '../services/apiClient';
import { buildCeligoFlowUrl } from '../utils/celigoUrl';
import { EditPayloadModal } from './EditPayloadModal';
import {
  identifyFlowType,
  getCompanyNameOrIntegration,
  getShortErrorDescription,
  formatErrorSummary,
  getFlowTypeBadgeStyle,
  FlowClassificationType,
} from '../utils/errorSummaryFormatter';

export interface GroupedCeligoError {
  groupKey: string;
  flowId: string;
  flowName: string;
  flowType: FlowClassificationType;
  companyName: string;
  formattedSummary: string;
  integrationId?: string;
  integrationName?: string;
  sectionId?: string;
  environment?: string;
  environmentLabel?: string;
  sourceApp?: any;
  targetApp?: any;
  rawErrorCode: string;
  rawErrorMessage: string;
  httpStatus?: number;
  mappingFieldFailed?: string;
  category: string;
  severity: ErrorSeverity;
  retrySafety: RetrySafety;
  retrySafetyReason: string;
  canRetry: boolean;
  canResolve: boolean;
  actionType: 'both' | 'retry_only' | 'resolve_only';
  retryableReason?: string;
  actionRequiredBy: string;
  plainEnglishSummary: string;
  businessImpact: string;
  rootCauseSimple: string;
  estimatedRiskAmount?: string;
  suggestedCliCommand: string;
  suggestedRemediationScript: string;
  celigoUrl?: string;
  records: CeligoErrorRecord[];
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  latestTimestamp: string;
  earliestTimestamp: string;
  jiraTicketId?: string;
  representativeRecord: CeligoErrorRecord;
}

interface ErrorAnalysisViewProps {
  errors: CeligoErrorRecord[];
  flows?: CeligoFlow[];
  integrations?: CeligoIntegration[];
  selectedFlowFilter: string;
  setSelectedFlowFilter: (flowId: string) => void;
  onOpenJiraModal: (error: CeligoErrorRecord) => void;
  onOpenRemediationModal: (error: CeligoErrorRecord) => void;
  onOpenNotificationModal: (error: CeligoErrorRecord) => void;
  onQuickRetry: (errorId: string) => void;
  onBatchRetry?: (errorIds: string[], flowId?: string) => void;
  onQuickResolve?: (errorId: string, purge?: boolean) => void;
  onBatchResolve?: (errorIds: string[], flowId?: string, purge?: boolean) => void;
  onRunInCli: (command: string) => void;
  onIgnoreError: (errorId: string) => void;
  onUpdateError?: (error: CeligoErrorRecord) => void;
  onUpdateGroup?: (updatedError: CeligoErrorRecord, groupKey: string) => void;
  onAddErrors?: (errors: CeligoErrorRecord[]) => void;
}

function normalizeMessage(msg: string): string {
  if (!msg) return '';
  return msg.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const ErrorAnalysisView: React.FC<ErrorAnalysisViewProps> = ({
  errors,
  flows = [],
  selectedFlowFilter,
  setSelectedFlowFilter,
  onOpenJiraModal,
  onOpenRemediationModal,
  onOpenNotificationModal,
  onQuickRetry,
  onBatchRetry,
  onQuickResolve,
  onBatchResolve,
  onRunInCli,
  onIgnoreError,
  onUpdateError,
  onUpdateGroup,
  onAddErrors,
}) => {
  // Simplified Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'unresolved' | 'retryable' | 'resolve_only' | 'critical'>('unresolved');
  const [envFilter, setEnvFilter] = useState<string>('all');
  
  // Expanded drawer states
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);
  const [selectedErrorForPayloadEdit, setSelectedErrorForPayloadEdit] = useState<CeligoErrorRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analyzingGroupKey, setAnalyzingGroupKey] = useState<string | null>(null);
  const [retryingGroupKey, setRetryingGroupKey] = useState<string | null>(null);
  const [resolvingGroupKey, setResolvingGroupKey] = useState<string | null>(null);
  const [isFetchingStepErrors, setIsFetchingStepErrors] = useState(false);

  // Available Flows for dropdown
  const availableFlows = useMemo(() => {
    const flowMap = new Map<string, string>();
    flows.forEach(f => flowMap.set(f.id, f.name));
    errors.forEach(e => {
      if (e.flowId && !flowMap.has(e.flowId)) {
        flowMap.set(e.flowId, e.flowName || e.flowId);
      }
    });
    return Array.from(flowMap.entries()).map(([id, name]) => ({ id, name }));
  }, [flows, errors]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle group expanded
  const toggleGroupExpanded = (key: string) => {
    setExpandedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // AI Re-analysis for group
  const handleAnalyzeGroup = async (group: GroupedCeligoError) => {
    setAnalyzingGroupKey(group.groupKey);
    try {
      const analysis = await requestErrorAnalysis(group.representativeRecord);
      const updatedRepresentative: CeligoErrorRecord = {
        ...group.representativeRecord,
        plainEnglishSummary: analysis.plainEnglishSummary || group.representativeRecord.plainEnglishSummary,
        businessImpact: analysis.businessImpact || group.representativeRecord.businessImpact,
        rootCauseSimple: analysis.rootCause || group.representativeRecord.rootCauseSimple,
        retrySafetyReason: analysis.retrySafetyReason || group.representativeRecord.retrySafetyReason,
        suggestedRemediationScript: analysis.suggestedRemediationScript || group.representativeRecord.suggestedRemediationScript,
      };

      if (onUpdateGroup) {
        onUpdateGroup(updatedRepresentative, group.groupKey);
      } else if (onUpdateError) {
        onUpdateError(updatedRepresentative);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzingGroupKey(null);
    }
  };

  // Batch Retry Group
  const handleRetryGroup = (group: GroupedCeligoError) => {
    setRetryingGroupKey(group.groupKey);
    const unresolvedIds = group.records.filter(r => r.status !== 'resolved').map(r => r.id).filter(Boolean) as string[];

    if (onBatchRetry && unresolvedIds.length > 0) {
      onBatchRetry(unresolvedIds, group.flowId);
    } else {
      unresolvedIds.forEach(id => onQuickRetry(id));
    }

    setTimeout(() => {
      setRetryingGroupKey(null);
    }, 1200);
  };

  // Batch Resolve / Purge Group
  const handleResolveGroup = (group: GroupedCeligoError, purge = true) => {
    setResolvingGroupKey(group.groupKey);
    const unresolvedIds = group.records.filter(r => r.status !== 'resolved').map(r => r.id).filter(Boolean) as string[];

    if (onBatchResolve && unresolvedIds.length > 0) {
      onBatchResolve(unresolvedIds, group.flowId, purge);
    } else if (onQuickResolve) {
      unresolvedIds.forEach(id => onQuickResolve(id, purge));
    }

    setTimeout(() => {
      setResolvingGroupKey(null);
    }, 1200);
  };

  // Fetch live step errors
  const handleFetchFlowStepErrors = async (flowId: string) => {
    setIsFetchingStepErrors(true);
    try {
      const result = await fetchFlowErrors(flowId);
      if (result.errors && result.errors.length > 0 && onAddErrors) {
        onAddErrors(result.errors);
      }
    } catch (err) {
      console.error('Fetch step errors failed:', err);
    } finally {
      setIsFetchingStepErrors(false);
    }
  };

  // 1. Filter Raw Errors
  const filteredRawErrors = useMemo(() => {
    return errors.filter(err => {
      // Flow filter
      if (selectedFlowFilter !== 'all' && err.flowId !== selectedFlowFilter) return false;

      // Environment filter
      if (envFilter !== 'all' && err.environment !== envFilter) return false;

      // Capability determination
      const isExportError = String(err.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(err.rawErrorMessage || '').toLowerCase().includes('export') || (err as any).type === 'export';
      const isRetryable = err.canRetry !== false && !isExportError;

      // Quick filter
      if (quickFilter === 'unresolved' && err.status === 'resolved') return false;
      if (quickFilter === 'critical' && err.severity !== 'critical') return false;
      if (quickFilter === 'retryable' && (!isRetryable || err.status === 'resolved')) return false;
      if (quickFilter === 'resolve_only' && (isRetryable || err.status === 'resolved')) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSummary = (err.plainEnglishSummary || '').toLowerCase().includes(q);
        const matchRawCode = (err.rawErrorCode || '').toLowerCase().includes(q);
        const matchRawMsg = (err.rawErrorMessage || '').toLowerCase().includes(q);
        const matchRecord = (err.recordIdentifier || '').toLowerCase().includes(q);
        const matchFlow = (err.flowName || '').toLowerCase().includes(q);
        const matchIntegration = (err.integrationName || '').toLowerCase().includes(q);
        return matchSummary || matchRawCode || matchRawMsg || matchRecord || matchFlow || matchIntegration;
      }
      return true;
    });
  }, [errors, selectedFlowFilter, envFilter, quickFilter, searchQuery]);

  // 2. Group into Failure Patterns (Flow ID + Message)
  const groupedErrors: GroupedCeligoError[] = useMemo(() => {
    const groupMap = new Map<string, GroupedCeligoError>();

    filteredRawErrors.forEach((err) => {
      const flowId = err.flowId || 'unknown_flow';
      const normMsg = normalizeMessage(err.rawErrorMessage || err.rawErrorCode || 'unknown_error');
      const groupKey = `${flowId}:::${normMsg}`;

      const isExportError = String(err.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(err.rawErrorMessage || '').toLowerCase().includes('export') || (err as any).type === 'export';
      const recCanRetry = err.canRetry !== false && !isExportError;
      const recCanResolve = err.canResolve !== false;

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.records.push(err);
        existing.totalCount += 1;
        if (err.status === 'resolved') existing.resolvedCount += 1;
        else existing.unresolvedCount += 1;

        if (recCanRetry) existing.canRetry = true;
        if (recCanResolve) existing.canResolve = true;
        existing.actionType = (existing.canRetry && existing.canResolve) ? 'both' : (existing.canRetry ? 'retry_only' : 'resolve_only');

        const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        if ((severityRank[err.severity || 'low'] || 1) > (severityRank[existing.severity] || 1)) {
          existing.severity = err.severity as ErrorSeverity;
        }
      } else {
        const isResolved = err.status === 'resolved';
        const canRetry = recCanRetry;
        const canResolve = recCanResolve;
        const actionType = (canRetry && canResolve) ? 'both' : (canRetry ? 'retry_only' : 'resolve_only');
        const retryableReason = canRetry
          ? 'Re-playable step payload exists. Can be Retried or Resolved (Purged).'
          : 'Source/Export error without destination replay payload. Action: Resolve / Purge in Celigo.';

        const flowType = identifyFlowType(err);
        const companyName = getCompanyNameOrIntegration(err, 'Gappify Enterprise');
        const shortDesc = getShortErrorDescription(err);
        const formattedSummary = formatErrorSummary(err, companyName, shortDesc);

        groupMap.set(groupKey, {
          groupKey,
          flowId: err.flowId || 'unknown_flow',
          flowName: err.flowName || 'Celigo Flow',
          flowType,
          companyName,
          formattedSummary,
          integrationId: err.integrationId,
          integrationName: err.integrationName,
          sectionId: err.sectionId,
          environment: err.environment || 'production',
          environmentLabel: err.environmentLabel || 'Production',
          sourceApp: err.sourceApp,
          targetApp: err.targetApp,
          rawErrorCode: err.rawErrorCode || 'INTEGRATOR_ERROR',
          rawErrorMessage: err.rawErrorMessage || 'Flow execution error.',
          httpStatus: err.httpStatus,
          mappingFieldFailed: err.mappingFieldFailed,
          category: err.category || 'data_validation',
          severity: (err.severity as ErrorSeverity) || 'high',
          retrySafety: err.retrySafety || 'verify_data',
          retrySafetyReason: err.retrySafetyReason || (canRetry ? 'Verify required payload fields prior to triggering retry.' : 'Export error cannot be re-sent; resolve/purge error queue.'),
          canRetry,
          canResolve,
          actionType,
          retryableReason,
          actionRequiredBy: err.actionRequiredBy || 'IT Support',
          plainEnglishSummary: err.plainEnglishSummary || `Integration "${err.flowName || 'Flow'}" encountered a payload or mapping rejection.`,
          businessImpact: err.businessImpact || 'Target system record remains un-synced until error is resolved.',
          rootCauseSimple: err.rootCauseSimple || err.rawErrorMessage || 'Required field missing or rejected by target API.',
          estimatedRiskAmount: err.estimatedRiskAmount,
          suggestedCliCommand: err.suggestedCliCommand || (canRetry ? `celigo flows:retry-errors --flowId ${err.flowId}` : `celigo flows:resolve-errors --flowId ${err.flowId}`),
          suggestedRemediationScript: err.suggestedRemediationScript || `// Celigo Hook for ${err.flowName}\nfunction preSavePage(options) {\n  return options.data;\n}`,
          celigoUrl: buildCeligoFlowUrl(err),
          records: [err],
          totalCount: 1,
          unresolvedCount: isResolved ? 0 : 1,
          resolvedCount: isResolved ? 1 : 0,
          latestTimestamp: err.timestamp || new Date().toISOString(),
          earliestTimestamp: err.timestamp || new Date().toISOString(),
          jiraTicketId: err.jiraTicketId,
          representativeRecord: err,
        });
      }
    });

    const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.unresolvedCount !== b.unresolvedCount) return b.unresolvedCount - a.unresolvedCount;
      return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    });
  }, [filteredRawErrors]);

  const totalUnresolved = useMemo(() => errors.filter(e => e.status === 'unresolved').length, [errors]);
  const totalCritical = useMemo(() => errors.filter(e => e.status === 'unresolved' && e.severity === 'critical').length, [errors]);
  
  const totalRetryable = useMemo(() => errors.filter(e => {
    if (e.status === 'resolved') return false;
    const isExport = String(e.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(e.rawErrorMessage || '').toLowerCase().includes('export');
    return e.canRetry !== false && !isExport;
  }).length, [errors]);

  const totalResolveOnly = useMemo(() => errors.filter(e => {
    if (e.status === 'resolved') return false;
    const isExport = String(e.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(e.rawErrorMessage || '').toLowerCase().includes('export');
    return e.canRetry === false || isExport;
  }).length, [errors]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. CLEAN HEADER & TRIAGE SUMMARY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white tracking-tight">Error Review & Remediation</h2>
              {totalUnresolved > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  {totalUnresolved} Unresolved
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ✓ All Clear
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Celigo integrator.io error capabilities are inspected in real time. Distinguish between errors that can be Retried (reprocessed) vs Resolved / Purged (queue cleared).
            </p>
          </div>

          {/* Active Flow Filter Badge if filtered from Dashboard */}
          {selectedFlowFilter !== 'all' && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
              <span className="text-xs text-indigo-300 font-medium truncate max-w-xs">
                Flow Filter: {flows.find(f => f.id === selectedFlowFilter)?.name || selectedFlowFilter}
              </span>
              <button
                onClick={() => setSelectedFlowFilter('all')}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="Clear flow filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. SIMPLE FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search error messages, record IDs, or flow names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 5 Clean Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setQuickFilter('unresolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'unresolved'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Unresolved ({totalUnresolved})
          </button>

          <button
            onClick={() => setQuickFilter('retryable')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'retryable'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Zap className="w-3 h-3" />
            Retryable ({totalRetryable})
          </button>

          <button
            onClick={() => setQuickFilter('resolve_only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'resolve_only'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            Resolve Only / Purge ({totalResolveOnly})
          </button>

          <button
            onClick={() => setQuickFilter('critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'critical'
                ? 'bg-rose-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Critical ({totalCritical})
          </button>

          <button
            onClick={() => setQuickFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              quickFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All History ({errors.length})
          </button>
        </div>

        {/* Environment Filter Dropdown */}
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Environments</option>
          <option value="production">Production</option>
          <option value="sandbox">Sandbox</option>
        </select>
      </div>      {/* 3. INCIDENT CARDS LIST */}
      {groupedErrors.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No Errors Matching Your Filter</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {selectedFlowFilter !== 'all'
              ? 'No errors found for this specific flow. All sync operations succeeded.'
              : 'All integration flows are running cleanly with zero unhandled exceptions.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setQuickFilter('all');
                setSearchQuery('');
                setSelectedFlowFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedErrors.map((group) => {
            const isAllResolved = group.unresolvedCount === 0;
            const isCritical = group.severity === 'critical';
            const isExpanded = expandedGroupKeys.has(group.groupKey);
            const isRetryingThis = retryingGroupKey === group.groupKey;
            const isResolvingThis = resolvingGroupKey === group.groupKey;

            return (
              <div
                key={group.groupKey}
                className={`bg-slate-900 border rounded-2xl transition-all duration-200 overflow-hidden shadow-xs ${
                  isAllResolved
                    ? 'border-emerald-900/40 opacity-75'
                    : isCritical
                    ? 'border-rose-800/90'
                    : 'border-slate-800'
                }`}
              >
                {/* 1. CARD TOP HEADER (Flow Info & Single Primary Action Bar) */}
                <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Severity Pill */}
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                        group.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : group.severity === 'high'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                      }`}
                    >
                      {group.severity}
                    </span>

                    {/* Flow & Integration Name */}
                    <span className="text-sm font-bold text-white">
                      {group.flowName}
                    </span>

                    {group.integrationName && (
                      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                        {group.integrationName}
                      </span>
                    )}

                    {/* Environment */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      group.environment === 'sandbox'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {group.environment || 'Production'}
                    </span>

                    {/* Affected Records Count Badge */}
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      isAllResolved
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                    }`}>
                      {isAllResolved ? '✓ All Resolved' : `${group.unresolvedCount} ${group.unresolvedCount === 1 ? 'Record Blocked' : 'Records Blocked'}`}
                    </span>
                  </div>

                  {/* Top-Right Primary Actions (Unified single action cluster) */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                    {/* Retry Button */}
                    {group.canRetry && !isAllResolved && (
                      <button
                        onClick={() => handleRetryGroup(group)}
                        disabled={isRetryingThis || isResolvingThis}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Re-send payload to destination endpoint in Celigo"
                      >
                        {isRetryingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Retrying...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>{group.unresolvedCount > 1 ? `Retry All (${group.unresolvedCount})` : 'Retry'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Resolve / Purge Button */}
                    {group.canResolve && !isAllResolved && (
                      <button
                        onClick={() => handleResolveGroup(group, true)}
                        disabled={isResolvingThis || isRetryingThis}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Mark error as resolved / purge from queue in Celigo"
                      >
                        {isResolvingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Purging...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{group.unresolvedCount > 1 ? `Resolve All (${group.unresolvedCount})` : 'Resolve'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Celigo deep link */}
                    <a
                      href={buildCeligoFlowUrl(group)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center gap-1"
                      title="Open in Celigo integrator.io"
                    >
                      <span>Celigo</span>
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                    </a>
                  </div>
                </div>

                {/* 2. CARD BODY: PROMINENT ERROR MESSAGE & SUMMARY */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* PROMINENT ERROR BOX: Makes the error instantly findable */}
                  <div className="bg-rose-950/20 border border-rose-900/60 rounded-xl p-4 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider font-mono">
                          Error: {group.rawErrorCode || 'EXECUTION_FAILURE'}
                        </span>
                        {group.httpStatus && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-900/40 text-rose-300 border border-rose-700/50">
                            HTTP {group.httpStatus}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopy(group.rawErrorMessage, `err_msg_${group.groupKey}`)}
                        className="px-2 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                        title="Copy error message"
                      >
                        {copiedId === `err_msg_${group.groupKey}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Error</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Actual Error Message Text */}
                    <p className="text-xs sm:text-sm font-mono text-rose-100 font-semibold leading-relaxed break-words selection:bg-rose-800">
                      {group.rawErrorMessage}
                    </p>

                    {/* Plain English explanation */}
                    {group.plainEnglishSummary && group.plainEnglishSummary !== group.rawErrorMessage && (
                      <p className="text-xs text-slate-300 pt-1 border-t border-rose-900/40 leading-relaxed">
                        <span className="text-slate-400 font-medium">Explanation: </span>
                        {group.plainEnglishSummary}
                      </p>
                    )}
                  </div>

                  {/* 3. SIMPLIFIED ACTION TOOLBAR & TECHNICAL DATA TOGGLE */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* Left: Secondary actions (Jira & Team Notification) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onOpenJiraModal(group.representativeRecord)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                        title="Create Jira Ticket for engineering"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Jira Ticket</span>
                      </button>

                      <button
                        onClick={() => onOpenNotificationModal(group.representativeRecord)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                        title="Send Slack or Email alert to team"
                      >
                        <Send className="w-3.5 h-3.5 text-sky-400" />
                        <span>Notify Team</span>
                      </button>
                    </div>

                    {/* Right: Technical Payload & Data Button (Easily Findable) */}
                    <button
                      onClick={() => toggleGroupExpanded(group.groupKey)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                        isExpanded
                          ? 'bg-indigo-950 border-indigo-700 text-indigo-200 shadow-sm'
                          : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700 text-indigo-300 hover:text-white'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{isExpanded ? 'Hide Technical Payload & Data' : `View Technical Payload & Data (${group.totalCount})`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* 4. EXPANDABLE TECHNICAL DETAILS & PAYLOADS PANEL */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                      {/* Metadata Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block font-sans">Error Code</span>
                          <span className="text-rose-400 font-bold block mt-0.5 truncate">{group.rawErrorCode}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block font-sans">HTTP Status</span>
                          <span className="text-slate-200 font-bold block mt-0.5">{group.httpStatus ? `HTTP ${group.httpStatus}` : 'Validation Exception'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block font-sans">Target Field / Step</span>
                          <span className="text-indigo-300 font-bold block mt-0.5 truncate">{group.mappingFieldFailed || 'Standard Record Target'}</span>
                        </div>
                      </div>

                      {/* Technical Payload JSON Box */}
                      <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-bold text-slate-200 font-sans">
                              Record Payload Data (JSON)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopy(JSON.stringify(group.representativeRecord.rawPayload || group.representativeRecord, null, 2), `payload_${group.groupKey}`)}
                              className="px-2.5 py-1 rounded bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === `payload_${group.groupKey}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy JSON</span>
                                </>
                              )}
                            </button>

                            {group.canRetry && !isAllResolved && (
                              <button
                                onClick={() => setSelectedErrorForPayloadEdit(group.representativeRecord)}
                                className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-700/60 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                                title="Edit payload snapshot and retry to Celigo"
                              >
                                <Code className="w-3.5 h-3.5 text-blue-400" />
                                <span>Edit & Retry Payload</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <pre className="text-xs font-mono text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 max-h-48 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-900">
                          {JSON.stringify(group.representativeRecord.rawPayload || group.representativeRecord, null, 2)}
                        </pre>
                      </div>

                      {/* Individual Records Table if multiple records exist */}
                      {group.records.length > 1 && (
                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                            <span>Individual Affected Records ({group.records.length})</span>
                          </div>

                          <div className="divide-y divide-slate-850 max-h-48 overflow-y-auto">
                            {group.records.map((rec) => {
                              const recResolved = rec.status === 'resolved';
                              const isExport = String(rec.rawErrorCode || '').toUpperCase().includes('EXPORT') || String(rec.rawErrorMessage || '').toLowerCase().includes('export');
                              const recCanRetry = rec.canRetry !== false && !isExport;

                              return (
                                <div key={rec.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-white px-2 py-0.5 bg-slate-850 rounded border border-slate-700/60">
                                      {rec.recordIdentifier || rec.id}
                                    </span>
                                    {recResolved ? (
                                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Resolved
                                      </span>
                                    ) : rec.status === 'retrying' ? (
                                      <span className="text-[10px] text-sky-400 font-bold flex items-center gap-1 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
                                        <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                                        Enqueued for Retry (Attempt #{rec.retryCount || 1})
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-rose-400 font-bold">Unresolved</span>
                                    )}
                                  </div>

                                  {!recResolved && (
                                    <div className="flex items-center gap-2">
                                      {recCanRetry && (
                                        <button
                                          onClick={() => rec.id && onQuickRetry(rec.id)}
                                          className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                        >
                                          Retry
                                        </button>
                                      )}
                                      <button
                                        onClick={() => rec.id && (onQuickResolve ? onQuickResolve(rec.id, true) : onIgnoreError(rec.id))}
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                                      >
                                        Resolve
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Snapshot Payload Modal */}
      {selectedErrorForPayloadEdit && (
        <EditPayloadModal
          error={selectedErrorForPayloadEdit}
          isOpen={Boolean(selectedErrorForPayloadEdit)}
          onClose={() => setSelectedErrorForPayloadEdit(null)}
          onSuccessRetry={(errorId) => {
            if (onQuickRetry) onQuickRetry(errorId);
          }}
        />
      )}
    </div>
  );
};
