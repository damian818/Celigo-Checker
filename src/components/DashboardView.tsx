import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Zap, 
  Database, 
  RefreshCw, 
  ShieldAlert, 
  TrendingUp, 
  ChevronRight, 
  ChevronDown,
  ExternalLink, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Layers, 
  LayoutGrid, 
  Table as TableIcon, 
  Copy, 
  Check, 
  Sparkles,
  ArrowRight,
  Pause,
  Play,
  SlidersHorizontal,
  Eye,
  EyeOff
} from 'lucide-react';
import { CeligoErrorRecord, CeligoFlow, CeligoIntegration } from '../types/celigo';
import { ErrorSummaryModal, ErrorSummaryScope } from './ErrorSummaryModal';
import { buildCeligoFlowUrl } from '../utils/celigoUrl';
import { identifyFlowType, getFlowTypeBadgeStyle } from '../utils/errorSummaryFormatter';

interface DashboardViewProps {
  flows: CeligoFlow[];
  integrations?: CeligoIntegration[];
  errors: CeligoErrorRecord[];
  onSelectFlow: (flowId: string) => void;
  onSelectError: (error: CeligoErrorRecord) => void;
  onOpenJiraModal: (error: CeligoErrorRecord) => void;
  onOpenRemediationModal: (error: CeligoErrorRecord) => void;
  onOpenNotificationModal: (error: CeligoErrorRecord) => void;
  onSwitchTab: (tab: 'dashboard' | 'errors' | 'chat' | 'cli') => void;
  onQuickRetry: (errorId: string) => void;
  onQuickResolve?: (errorId: string, purge?: boolean) => void;
  onBatchRetry?: (errorIds: string[], flowId?: string) => void;
  onBatchResolve?: (errorIds: string[], flowId?: string, purge?: boolean) => void;
  isLiveConnected?: boolean;
  dataSource?: 'live' | 'sandbox';
  onRefreshLive?: () => void;
  isSyncing?: boolean;
  syncProgress?: number;
  syncStepMessage?: string;
  onShowSyncModal?: () => void;
}

type QuickFilter = 'all' | 'errors_only' | 'production' | 'sandbox' | 'paused';
type SortColumn = 'name' | 'status' | 'errors' | 'throughput';
type SortDirection = 'asc' | 'desc';

interface IntegrationGroup {
  id: string;
  name: string;
  environment: string;
  environmentLabel?: string;
  flows: CeligoFlow[];
  totalFlows: number;
  healthyFlows: number;
  criticalFlows: number;
  degradedFlows: number;
  pausedFlows: number;
  totalErrors: number;
  totalThroughput: number;
  integrationUrl?: string;
}

// Helper to determine if a flow is paused
export const isFlowPaused = (flow: CeligoFlow): boolean => {
  if (!flow) return false;
  const s = (flow.status || '').toLowerCase();
  return s === 'paused' || s === 'disabled' || flow.disabled === true || flow._disabled === true || flow.state === 'disabled';
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  integrations = [],
  flows,
  errors,
  onSelectFlow,
  onSelectError,
  onOpenJiraModal,
  onOpenRemediationModal,
  onOpenNotificationModal,
  onSwitchTab,
  onRefreshLive,
  onQuickRetry,
  onQuickResolve,
  onBatchRetry,
  onBatchResolve,
  isSyncing = false,
  syncProgress = 0,
  syncStepMessage = '',
  onShowSyncModal,
}) => {
  // Filter States - Default to 'errors_only' (Needs Attention) and collapsed by default
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('errors_only');
  const [includePaused, setIncludePaused] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>('errors');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Error Summary Modal State
  const [summaryModalScope, setSummaryModalScope] = useState<ErrorSummaryScope | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);

  // Summary Metrics
  const unresolvedErrors = useMemo(() => errors.filter(e => e.status === 'unresolved'), [errors]);
  const criticalErrors = useMemo(() => unresolvedErrors.filter(e => e.severity === 'critical'), [unresolvedErrors]);
  const flowsWithErrors = useMemo(() => flows.filter(f => (f.unresolvedErrors || f.errorCount24h || 0) > 0), [flows]);
  const pausedCount = useMemo(() => flows.filter(f => isFlowPaused(f)).length, [flows]);
  const prodCount = useMemo(() => flows.filter(f => (f.environment || 'production') === 'production').length, [flows]);
  const sbxCount = useMemo(() => flows.filter(f => f.environment === 'sandbox').length, [flows]);
  const totalProcessed = useMemo(() => flows.reduce((acc, f) => acc + (f.recordsProcessed24h || 0), 0), [flows]);

  // Open Error Summary Popover Handler
  const openErrorSummary = (scope: ErrorSummaryScope, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSummaryModalScope(scope);
    setIsSummaryModalOpen(true);
  };

  const handleNavigateToErrors = (flowId?: string) => {
    if (flowId) {
      onSelectFlow(flowId);
    }
    onSwitchTab('errors');
  };

  // Toggle group collapse (default is collapsed)
  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const current = prev[id] !== undefined ? prev[id] : true;
      return { ...prev, [id]: !current };
    });
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    groupedIntegrations.forEach(g => { allExpanded[g.id] = false; });
    setCollapsedGroups(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedIntegrations.forEach(g => { allCollapsed[g.id] = true; });
    setCollapsedGroups(allCollapsed);
  };

  // 1. Filter flows based on search, paused filter, & quick filter
  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      const isPaused = isFlowPaused(flow);

      // Explicit paused filter check
      if (quickFilter === 'paused') {
        if (!isPaused) return false;
      } else {
        // If not in "paused only" mode, respect includePaused toggle
        if (!includePaused && isPaused) {
          return false;
        }

        // Quick Filter options
        if (quickFilter === 'errors_only' && (flow.unresolvedErrors || flow.errorCount24h || 0) === 0) return false;
        if (quickFilter === 'production' && flow.environment === 'sandbox') return false;
        if (quickFilter === 'sandbox' && flow.environment !== 'sandbox') return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (flow.name || '').toLowerCase().includes(q);
        const matchGroup = (flow.integrationName || flow.group || '').toLowerCase().includes(q);
        const matchSource = (flow.sourceApp?.name || '').toLowerCase().includes(q);
        const matchTarget = (flow.targetApp?.name || '').toLowerCase().includes(q);
        const matchId = (flow.id || '').toLowerCase().includes(q);
        return matchName || matchGroup || matchSource || matchTarget || matchId;
      }
      return true;
    });
  }, [flows, quickFilter, includePaused, searchQuery]);

  // 2. Group into Integrations
  const groupedIntegrations = useMemo(() => {
    const groupMap = new Map<string, IntegrationGroup>();

    // Seed known integrations
    if (integrations && integrations.length > 0) {
      integrations.forEach(intg => {
        const host = 'integrator.io';
        const integrationUrl = intg.id ? `https://${host}/integrations/${intg.id}` : undefined;
        groupMap.set(intg.id, {
          id: intg.id,
          name: intg.name || 'Integration',
          environment: intg.environment || 'production',
          environmentLabel: intg.environmentLabel,
          flows: [],
          totalFlows: 0,
          healthyFlows: 0,
          criticalFlows: 0,
          degradedFlows: 0,
          pausedFlows: 0,
          totalErrors: 0,
          totalThroughput: 0,
          integrationUrl,
        });
      });
    }

    filteredFlows.forEach(flow => {
      const integrationName = flow.integrationName || flow.group || 'General Integration';
      const integrationId = flow.integrationId || '';
      const groupKey = integrationId ? integrationId : `name_${integrationName}_${flow.environment || 'prod'}`;

      if (!groupMap.has(groupKey)) {
        const host = 'integrator.io';
        const integrationUrl = integrationId ? `https://${host}/integrations/${integrationId}` : undefined;
        groupMap.set(groupKey, {
          id: integrationId || groupKey,
          name: integrationName,
          environment: flow.environment || 'production',
          environmentLabel: flow.environmentLabel,
          flows: [],
          totalFlows: 0,
          healthyFlows: 0,
          criticalFlows: 0,
          degradedFlows: 0,
          pausedFlows: 0,
          totalErrors: 0,
          totalThroughput: 0,
          integrationUrl,
        });
      }

      const grp = groupMap.get(groupKey)!;
      grp.flows.push(flow);
      grp.totalFlows += 1;
      const isPaused = isFlowPaused(flow);
      if (isPaused) {
        grp.pausedFlows += 1;
      }
      const errs = flow.unresolvedErrors || flow.errorCount24h || 0;
      if (errs === 0 && flow.status === 'healthy' && !isPaused) grp.healthyFlows += 1;
      if (flow.status === 'critical' || errs > 3) grp.criticalFlows += 1;
      else if (errs > 0) grp.degradedFlows += 1;
      grp.totalErrors += errs;
      grp.totalThroughput += (flow.recordsProcessed24h || 0);
    });

    const list = Array.from(groupMap.values()).filter(g => g.totalFlows > 0);

    // Sort: failing integrations first
    return list.sort((a, b) => {
      if (b.totalErrors !== a.totalErrors) return b.totalErrors - a.totalErrors;
      return a.name.localeCompare(b.name);
    });
  }, [filteredFlows, integrations]);

  // Celigo direct URL builder
  const getCeligoFlowUrl = (flow: CeligoFlow) => {
    return buildCeligoFlowUrl(flow);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. TOP EXECUTIVE SUMMARY BAR (Clean, high-contrast, uncluttered) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Main Title & Live Indicator */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">Integration Overview</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Celigo Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitoring {flows.length} flows across {groupedIntegrations.length} integrations ({prodCount} Prod, {sbxCount} Sandbox, {pausedCount} Paused).
            </p>
          </div>

          {/* 3 Clear Primary Metric Badges */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Metric 1: Total Flows */}
            <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 flex items-center gap-3 min-w-[120px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Total Flows</span>
                <span className="text-base font-bold text-white">{flows.length}</span>
              </div>
            </div>

            {/* Metric 2: Unresolved Errors (Clickable popup summary before jumping) */}
            <button
              onClick={() => openErrorSummary({
                type: 'global',
                title: 'All Unresolved Errors',
                subtitle: `Summary of ${unresolvedErrors.length} blocked execution records across all flows`
              })}
              className={`px-4 py-2.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-left min-w-[150px] ${
                unresolvedErrors.length > 0
                  ? 'bg-rose-950/40 border-rose-800/80 hover:bg-rose-900/50 text-rose-300 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
              }`}
              title="Click to view error summary popup"
            >
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400/80 block">Unresolved Errors</span>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 rounded">Quick View</span>
                </div>
                <span className="text-base font-bold text-white flex items-center gap-1.5">
                  {unresolvedErrors.length}
                  {criticalErrors.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                      {criticalErrors.length} Critical
                    </span>
                  )}
                </span>
              </div>
            </button>

            {/* Metric 3: Sync Button */}
            {isSyncing ? (
              <button
                onClick={onShowSyncModal}
                className="px-4 py-2.5 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-700/80 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Syncing ({Math.round(syncProgress)}%)</span>
              </button>
            ) : (
              <button
                onClick={onRefreshLive}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-2 cursor-pointer"
                title="Fetch latest data from integrator.io"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CRITICAL INCIDENT BANNER (Only shown when critical errors exist) */}
      {criticalErrors.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-200">
                {criticalErrors.length} Critical Integration {criticalErrors.length === 1 ? 'Error' : 'Errors'} Blocked
              </h3>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Target records are held in error queue. Review root causes and trigger 1-click batch remediation.
              </p>
            </div>
          </div>

          <button
            onClick={() => openErrorSummary({
              type: 'global',
              title: 'Critical Incident Errors',
              subtitle: `Review ${criticalErrors.length} critical blocked errors across flows`
            })}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Review {criticalErrors.length} Critical Errors</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. SIMPLIFIED FILTER & SEARCH BAR WITH PAUSED FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search flows, systems (e.g. NetSuite, Salesforce), or IDs..."
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

        {/* Filter Tabs (All, Needs Attention, Prod, Sandbox, Paused) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              quickFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Flows ({flows.length})
          </button>

          <button
            onClick={() => setQuickFilter('errors_only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'errors_only'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Needs Attention ({flowsWithErrors.length})
          </button>

          <button
            onClick={() => setQuickFilter('production')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              quickFilter === 'production'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Production ({prodCount})
          </button>

          <button
            onClick={() => setQuickFilter('sandbox')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              quickFilter === 'sandbox'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sandbox ({sbxCount})
          </button>

          {/* Paused Tab Filter */}
          <button
            onClick={() => setQuickFilter('paused')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              quickFilter === 'paused'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pause className="w-3 h-3 text-slate-400" />
            Paused ({pausedCount})
          </button>
        </div>

        {/* Include/Exclude Paused Toggle & View Mode */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
          {/* Paused Include / Exclude Toggle Switch (Only relevant when not on 'paused' tab) */}
          {quickFilter !== 'paused' && (
            <button
              onClick={() => setIncludePaused(!includePaused)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                includePaused
                  ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
              }`}
              title={includePaused ? 'Click to hide paused flows' : 'Click to include paused flows'}
            >
              {includePaused ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paused: Included</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Paused: Hidden</span>
                </>
              )}
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grouped' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Group by Integration"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'flat' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Flat Flow List"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {viewMode === 'grouped' && (
            <div className="flex items-center text-xs text-slate-400 gap-1">
              <button onClick={expandAll} className="hover:text-white px-1.5 py-1 cursor-pointer">Expand</button>
              <span>/</span>
              <button onClick={collapseAll} className="hover:text-white px-1.5 py-1 cursor-pointer">Collapse</button>
            </div>
          )}
        </div>
      </div>

      {/* 4. INTEGRATION & FLOW LIST */}
      {groupedIntegrations.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
          <h4 className="text-sm font-bold text-white">No Integrations Match Your Filter</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try clearing the search box or switching to &quot;All Flows&quot; (or enabling &quot;Paused: Included&quot;).
          </p>
          <button
            onClick={() => {
              setQuickFilter('all');
              setIncludePaused(true);
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grouped' ? (
        /* GROUPED BY INTEGRATION VIEW */
        <div className="space-y-4">
          {groupedIntegrations.map((group) => {
            const isCollapsed = collapsedGroups[group.id] !== undefined ? collapsedGroups[group.id] : true;
            const isSbx = group.environment === 'sandbox';
            const hasErrors = group.totalErrors > 0;

            return (
              <div
                key={group.id}
                className={`bg-slate-900 border rounded-2xl transition-all duration-200 overflow-hidden shadow-xs ${
                  hasErrors ? 'border-rose-900/50' : 'border-slate-800'
                }`}
              >
                {/* Integration Header Card */}
                <div
                  onClick={() => toggleGroup(group.id)}
                  className="p-4 sm:p-5 bg-slate-850/60 hover:bg-slate-850 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border shrink-0 ${
                      hasErrors 
                        ? 'bg-rose-950/60 border-rose-800/60 text-rose-400' 
                        : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-400'
                    }`}>
                      <Layers className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-300">
                          {group.name}
                        </h4>

                        {/* Environment Tag */}
                        {isSbx ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Sandbox
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Production
                          </span>
                        )}

                        {/* Paused Flows in group badge */}
                        {group.pausedFlows > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                            <Pause className="w-2.5 h-2.5" />
                            {group.pausedFlows} Paused
                          </span>
                        )}

                        {/* Celigo Direct Integration Link */}
                        {group.integrationUrl && (
                          <a
                            href={group.integrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 hover:underline ml-1"
                            title="Open in Celigo integrator.io"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Celigo</span>
                          </a>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-0.5">
                        {group.totalFlows} flow{group.totalFlows === 1 ? '' : 's'} • {group.healthyFlows} healthy
                        {group.totalThroughput > 0 && ` • ${group.totalThroughput.toLocaleString()} records processed`}
                      </p>
                    </div>
                  </div>

                  {/* Status & Collapse Indicator (Click error count badge to open error summary popup) */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {hasErrors ? (
                      <button
                        onClick={(e) => openErrorSummary({
                          type: 'integration',
                          id: group.id,
                          integrationName: group.name,
                          title: `${group.name} Errors`,
                          subtitle: `Summary of ${group.totalErrors} errors within this integration`
                        }, e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 transition cursor-pointer"
                        title="Click to view summarized errors popup for this integration"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>{group.totalErrors} {group.totalErrors === 1 ? 'Error' : 'Errors'}</span>
                        <span className="text-[10px] text-rose-400 underline ml-0.5">Summary</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All Healthy
                      </span>
                    )}

                    <div className="p-1 rounded-lg text-slate-400 hover:text-white">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Flow Rows inside Integration */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {group.flows.map((flow) => {
                      const flowErrors = flow.unresolvedErrors || flow.errorCount24h || 0;
                      const flowHasErrors = flowErrors > 0;
                      const isPaused = isFlowPaused(flow);
                      const celigoUrl = getCeligoFlowUrl(flow);

                      return (
                        <div
                          key={flow.id}
                          className={`p-3.5 sm:p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            flowHasErrors 
                              ? 'bg-rose-950/10 hover:bg-rose-950/20' 
                              : isPaused 
                              ? 'bg-slate-950/20 opacity-85 hover:bg-slate-900/40' 
                              : 'hover:bg-slate-900/60'
                          }`}
                        >
                          {/* Flow Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                onClick={() => {
                                  if (flowHasErrors) {
                                    openErrorSummary({
                                      type: 'flow',
                                      id: flow.id,
                                      flowName: flow.name,
                                      title: `${flow.name} Errors`,
                                      subtitle: `Summary of ${flowErrors} errors for this flow`
                                    });
                                  } else {
                                    onSelectFlow(flow.id);
                                    onSwitchTab('errors');
                                  }
                                }}
                                className="text-xs sm:text-sm font-semibold text-white hover:text-indigo-400 cursor-pointer transition"
                              >
                                {flow.name}
                              </span>

                              {/* Flow Classification (VMAC / JE / Other) */}
                              {(() => {
                                const fType = identifyFlowType({ flowName: flow.name, integrationName: flow.integrationName });
                                const badge = getFlowTypeBadgeStyle(fType);
                                return (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.pillClass}`}>
                                    {fType}
                                  </span>
                                );
                              })()}

                              {/* Status Badge */}
                              {isPaused ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                                  <Pause className="w-2.5 h-2.5" />
                                  Paused
                                </span>
                              ) : (
                                <>
                                  {flow.status === 'healthy' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Healthy
                                    </span>
                                  )}
                                  {flow.status === 'critical' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      Critical
                                    </span>
                                  )}
                                  {flow.status === 'degraded' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Degraded
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Systems & Schedule */}
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                              <span className="text-slate-300 font-medium">{flow.sourceApp?.name || 'Source'}</span>
                              <span className="text-slate-600">→</span>
                              <span className="text-slate-300 font-medium">{flow.targetApp?.name || 'Target'}</span>
                              <span className="text-slate-600">•</span>
                              <span>{flow.scheduleType || 'Scheduled'}</span>
                              {flow.lastRunTime && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span>Ran: {flow.lastRunTime}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons & Error Count: Click opens error summary popup */}
                          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                            {flowHasErrors ? (
                              <button
                                onClick={() => openErrorSummary({
                                  type: 'flow',
                                  id: flow.id,
                                  flowName: flow.name,
                                  title: `${flow.name} Errors`,
                                  subtitle: `Summary of ${flowErrors} errors for this flow`
                                })}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                title="Click to view summary of errors for this flow"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{flowErrors} {flowErrors === 1 ? 'Error' : 'Errors'}</span>
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-emerald-400/80 mr-2 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                0 errors
                              </span>
                            )}

                            <a
                              href={celigoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                              title="Open in Celigo integrator.io"
                            >
                              <span>Celigo</span>
                              <ExternalLink className="w-3 h-3 text-indigo-400" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* FLAT TABLE VIEW (For users who prefer a single dense list) */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-800">
            {filteredFlows.map((flow) => {
              const flowErrors = flow.unresolvedErrors || flow.errorCount24h || 0;
              const flowHasErrors = flowErrors > 0;
              const isPaused = isFlowPaused(flow);
              const celigoUrl = getCeligoFlowUrl(flow);

              return (
                <div
                  key={flow.id}
                  className={`p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    flowHasErrors 
                      ? 'bg-rose-950/10 hover:bg-rose-950/20' 
                      : isPaused
                      ? 'bg-slate-950/20 opacity-85 hover:bg-slate-850/60'
                      : 'hover:bg-slate-850/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        onClick={() => {
                          if (flowHasErrors) {
                            openErrorSummary({
                              type: 'flow',
                              id: flow.id,
                              flowName: flow.name,
                              title: `${flow.name} Errors`,
                              subtitle: `Summary of ${flowErrors} errors for this flow`
                            });
                          } else {
                            onSelectFlow(flow.id);
                            onSwitchTab('errors');
                          }
                        }}
                        className="text-xs sm:text-sm font-semibold text-white hover:text-indigo-400 cursor-pointer"
                      >
                        {flow.name}
                      </span>

                      {/* Flow Classification (VMAC / JE / Other) */}
                      {(() => {
                        const fType = identifyFlowType({ flowName: flow.name, integrationName: flow.integrationName });
                        const badge = getFlowTypeBadgeStyle(fType);
                        return (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.pillClass}`}>
                            {fType}
                          </span>
                        );
                      })()}

                      <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-800 rounded">
                        {flow.integrationName || flow.group || 'Integration'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        flow.environment === 'sandbox' 
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {flow.environment || 'Production'}
                      </span>

                      {isPaused && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <Pause className="w-2.5 h-2.5" />
                          Paused
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span>{flow.sourceApp?.name || 'Source'} → {flow.targetApp?.name || 'Target'}</span>
                      <span className="text-slate-600">•</span>
                      <span>{(flow.recordsProcessed24h || 0).toLocaleString()} records</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                    {flowHasErrors ? (
                      <button
                        onClick={() => openErrorSummary({
                          type: 'flow',
                          id: flow.id,
                          flowName: flow.name,
                          title: `${flow.name} Errors`,
                          subtitle: `Summary of ${flowErrors} errors for this flow`
                        })}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        title="Click to view summary of errors for this flow"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{flowErrors} {flowErrors === 1 ? 'Error' : 'Errors'}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-medium mr-2">✓ Clean</span>
                    )}

                    <a
                      href={celigoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                    >
                      <span>Celigo</span>
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. ERROR SUMMARY MODAL (Shows summarized error breakdown before jumping into the errors tab) */}
      {summaryModalScope && (
        <ErrorSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          scope={summaryModalScope}
          errors={errors}
          flows={flows}
          onNavigateToErrors={handleNavigateToErrors}
          onQuickRetry={onQuickRetry}
          onQuickResolve={onQuickResolve}
          onOpenJiraModal={onOpenJiraModal}
          onOpenNotificationModal={onOpenNotificationModal}
        />
      )}
    </div>
  );
};
