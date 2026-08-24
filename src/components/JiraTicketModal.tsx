import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  Search, 
  Calendar, 
  Link as LinkIcon, 
  Hash, 
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  ExternalLink,
  Copy,
  Layers,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Tag
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CeligoErrorRecord, JiraTicket } from '../types/celigo';
import { createJiraTicket, getJiraStatus } from '../services/apiClient';
import { buildCeligoFlowUrl } from '../utils/celigoUrl';
import { auth } from '../services/firebase';
import {
  identifyFlowType,
  getCompanyNameOrIntegration,
  getShortErrorDescription,
  formatErrorSummary,
  getFlowTypeBadgeStyle,
  FlowClassificationType,
} from '../utils/errorSummaryFormatter';
import {
  JIRA_PROJECT_CONFIG,
  JIRA_ISSUE_TYPE_CONFIG,
  JIRA_ASSIGNEE_DEFAULT,
  JIRA_PRIORITY_OPTIONS,
  APPLICABLE_PRODUCT_OPTIONS,
  CUSTOMER_PRIORITY_OPTIONS,
  TICKET_SOURCE_OPTIONS,
  GPFY_CUSTOMER_NAMES,
} from '../data/jiraConstants';

interface JiraTicketModalProps {
  error: CeligoErrorRecord;
  userEmail?: string;
  onClose: () => void;
  onTicketCreated: (ticket: JiraTicket, errorId: string) => void;
}

export const JiraTicketModal: React.FC<JiraTicketModalProps> = ({
  error,
  userEmail,
  onClose,
  onTicketCreated,
}) => {
  // 2-Step Modal State: Step 1 (Main Fields) -> Step 2 (Custom Fields)
  const [step, setStep] = useState<1 | 2>(1);

  // 1. Standard / Main Fields State
  const [projectKey] = useState<string>(JIRA_PROJECT_CONFIG.key);
  const [projectId] = useState<string>(JIRA_PROJECT_CONFIG.id);
  const [issueType] = useState<string>(JIRA_ISSUE_TYPE_CONFIG.name);
  const [issueTypeId] = useState<string>(JIRA_ISSUE_TYPE_CONFIG.id);

  // Derive initial Flow Type, Company Name, and Short Description
  const initialFlowType = useMemo(() => identifyFlowType(error), [error]);
  const initialCompany = useMemo(() => {
    return getCompanyNameOrIntegration(error, 'Internal Test Account');
  }, [error]);
  const initialShortDesc = useMemo(() => getShortErrorDescription(error), [error]);

  const [flowType, setFlowType] = useState<FlowClassificationType>(initialFlowType);
  const [companyName, setCompanyName] = useState<string>(initialCompany);
  const [gpfyCustomerName, setGpfyCustomerName] = useState<string>(initialCompany);
  const [shortDesc, setShortDesc] = useState<string>(initialShortDesc);

  // Formatted summary according to: VMAC/JE/Other _Error: [Name] > Short error description
  const [summary, setSummary] = useState<string>(() => 
    formatErrorSummary(error, initialCompany, initialShortDesc)
  );
  
  // Default priority to "P2 - Medium" as specified
  const [priority, setPriority] = useState<string>('P2 - Medium');

  // Assignee: Default to "Gappify Customer Support" (ID 62201b8f94f7e20069fe3811)
  const [assigneeAccountId, setAssigneeAccountId] = useState<string>(JIRA_ASSIGNEE_DEFAULT.accountId);
  const [assigneeName, setAssigneeName] = useState<string>(JIRA_ASSIGNEE_DEFAULT.name);
  const [assigneeEmail, setAssigneeEmail] = useState<string>(JIRA_ASSIGNEE_DEFAULT.email);

  // Reporter: Always defaults to logged-in user's email
  const loggedInUserEmail = userEmail || auth.currentUser?.email || 'damian@gappify.com';
  const [reporter, setReporter] = useState<string>(loggedInUserEmail);

  // Labels
  const [labels, setLabels] = useState<string>(
    `celigo-error, integrator-io, integration-issue, gs-ops, ${(error.sourceApp || 'source').toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  );

  const [environment] = useState<string>(
    (error.environment as any) === 'sandbox' ? 'Sandbox' : 'Production'
  );

  // Celigo Flow URL
  const defaultFlowUrl = useMemo(() => {
    return buildCeligoFlowUrl(error);
  }, [error]);
  const [celigoFlowUrl, setCeligoFlowUrl] = useState<string>(defaultFlowUrl);

  // Description: Clean incident description WITHOUT solutions or CLI commands
  const fullDescription = useMemo(() => {
    return `*Celigo Integration Incident Report (Space GS - ID: 10010)*

*Flow*: ${error.flowName || 'Integration Flow'} (ID: ${error.flowId || 'N/A'})
*Integration*: ${error.integrationName || 'Enterprise Integrations'}
*Environment*: ${environment}
*Route*: ${error.sourceApp || 'Source'} ➔ ${error.targetApp || 'Target'}
*Record Identifier*: ${error.recordIdentifier || 'N/A'}
*Error Code*: ${error.rawErrorCode || 'GENERAL_ERROR'}
*Severity*: ${error.severity?.toUpperCase() || 'HIGH'} ${error.estimatedRiskAmount ? `(Estimated Financial Risk: ${error.estimatedRiskAmount})` : ''}

h3. Non-Technical Summary
${error.plainEnglishSummary || 'A data sync failure was encountered during scheduled integration execution.'}

h3. Business Impact
${error.businessImpact || 'Downstream reconciliation and invoicing are delayed until record sync succeeds.'}

h3. Root Cause Analysis
${error.rootCauseSimple || 'Data validation failed against the target system API endpoint.'}

*Celigo Flow Link*: ${defaultFlowUrl}`;
  }, [error, environment, defaultFlowUrl]);

  const [description, setDescription] = useState<string>(fullDescription);

  // 2. Custom Fields State (GS Schema)
  // customfield_10041 (GPFY Customer Name - Select List single choice)
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);

  // customfield_10132 (Applicable Product - Select List multiple choices)
  const [applicableProducts, setApplicableProducts] = useState<string[]>(['Accrual Cloud']);

  // customfield_10136 (Customer Priority - Default to Medium)
  const [customerPriority, setCustomerPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  // customfield_10230 (Ticket Source - Default to Initiated by Gappify)
  const [ticketSource, setTicketSource] = useState<'Initiated by Gappify' | 'Initiated by Customer'>('Initiated by Gappify');

  // customfield_11305 (Customer Code)
  const [customerCode, setCustomerCode] = useState<string>('');

  // customfield_11304 (Celigo Error ID - Completed with the Error ID from the Celigo inbound data)
  const inboundCeligoErrorId = useMemo(() => {
    if (error.rawPayload?.errorId) return String(error.rawPayload.errorId);
    if (error.rawPayload?._id && typeof error.rawPayload._id === 'string' && !error.rawPayload._id.startsWith('flow_')) {
      return String(error.rawPayload._id);
    }
    if (error.rawPayload?.id && typeof error.rawPayload.id === 'string' && !error.rawPayload.id.startsWith('flow_')) {
      return String(error.rawPayload.id);
    }
    if (error.rawPayload?.errorSummary?.id) return String(error.rawPayload.errorSummary.id);
    if (error.rawPayload?.errorSummary?._id) return String(error.rawPayload.errorSummary._id);
    if (error.errorId) return String(error.errorId);
    if (error.id && !error.id.includes('_summary_err') && !error.id.startsWith('flow_')) return String(error.id);
    if (error.recordIdentifier && /^[0-9A-Za-z_-]{4,}$/.test(String(error.recordIdentifier))) return String(error.recordIdentifier);
    return '1886125290';
  }, [error]);

  const [celigoErrorId, setCeligoErrorId] = useState<string>(inboundCeligoErrorId);

  // customfield_10227 (Date of the issue/request - Picked from error or current date)
  const initialDate = error.timestamp ? String(error.timestamp).split('T')[0] : new Date().toISOString().split('T')[0];
  const [issueDate, setIssueDate] = useState<string>(initialDate);

  // customfield_10292 (Ticket Summary/Description - Repeats the Description)
  const [ticketSummaryDescription, setTicketSummaryDescription] = useState<string>(fullDescription);
  const [syncRepeatedDescription, setSyncRepeatedDescription] = useState<boolean>(true);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successTicket, setSuccessTicket] = useState<JiraTicket | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const [jiraStatus, setJiraStatus] = useState<{
    connected: boolean;
    isLive: boolean;
    domain: string;
    email: string;
    projectKey: string;
    issueType: string;
    message?: string;
  }>({
    connected: false,
    isLive: false,
    domain: JIRA_PROJECT_CONFIG.domain,
    email: 'damian@gappify.com',
    projectKey: JIRA_PROJECT_CONFIG.key,
    issueType: JIRA_ISSUE_TYPE_CONFIG.name,
  });

  useEffect(() => {
    getJiraStatus().then(status => {
      setJiraStatus(status);
    }).catch(console.error);
  }, []);

  // Sync Description to Ticket Summary/Description (customfield_10292) when enabled
  const handleDescriptionChange = (newDesc: string) => {
    setDescription(newDesc);
    if (syncRepeatedDescription) {
      setTicketSummaryDescription(newDesc);
    }
  };

  // Replicate GPFY Customer Name into Company Name (customfield_10141) and update summary
  const handleCustomerSelect = (customer: string) => {
    setGpfyCustomerName(customer);
    setCompanyName(customer);
    setIsCustomerDropdownOpen(false);
    setCustomerSearch('');
    // Auto-update summary with newly selected customer name while preserving short description & flowType
    setSummary(formatErrorSummary(error, customer, shortDesc));
  };

  const handleFlowTypeChange = (newType: FlowClassificationType) => {
    setFlowType(newType);
    setSummary(`${newType}_Error: [${companyName}] > ${shortDesc}`);
  };

  const handleCompanyNameChange = (newName: string) => {
    setCompanyName(newName);
    setGpfyCustomerName(newName);
    setSummary(`${flowType}_Error: [${newName}] > ${shortDesc}`);
  };

  const handleShortDescChange = (newDesc: string) => {
    setShortDesc(newDesc);
    setSummary(`${flowType}_Error: [${companyName}] > ${newDesc}`);
  };

  const handleRegenerateStandardSummary = () => {
    const formatted = formatErrorSummary(error, companyName, shortDesc);
    setSummary(formatted);
  };

  // Filtered customer list for instant search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return GPFY_CUSTOMER_NAMES;
    const q = customerSearch.toLowerCase().trim();
    return GPFY_CUSTOMER_NAMES.filter(name => name.toLowerCase().includes(q));
  }, [customerSearch]);

  // Toggle applicable products multi-select
  const toggleProduct = (prod: string) => {
    setApplicableProducts(prev => 
      prev.includes(prod) 
        ? prev.filter(p => p !== prod)
        : [...prev, prod]
    );
  };

  // Handle Assignee selection
  const handleAssigneeChange = (val: string) => {
    if (val === 'gappify-support') {
      setAssigneeAccountId(JIRA_ASSIGNEE_DEFAULT.accountId);
      setAssigneeName(JIRA_ASSIGNEE_DEFAULT.name);
      setAssigneeEmail(JIRA_ASSIGNEE_DEFAULT.email);
    } else if (val === 'damian') {
      setAssigneeAccountId('');
      setAssigneeName('Damian');
      setAssigneeEmail('damian@gappify.com');
    } else if (val === 'accounting') {
      setAssigneeAccountId('');
      setAssigneeName('Accounting Ops');
      setAssigneeEmail('accounting@gappify.com');
    }
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setErrorMsg('Please enter a ticket summary before proceeding to Custom Fields.');
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        projectKey: JIRA_PROJECT_CONFIG.key,
        projectId: JIRA_PROJECT_CONFIG.id,
        issueType: JIRA_ISSUE_TYPE_CONFIG.name,
        issueTypeId: JIRA_ISSUE_TYPE_CONFIG.id,
        summary,
        description,
        priority,
        assigneeAccountId,
        assigneeName,
        assigneeEmail,
        reporter,
        environment,
        sourceApp: error.sourceApp,
        targetApp: error.targetApp,
        errorId: celigoErrorId,
        flowName: error.flowName,
        flowId: error.flowId,
        integrationId: error.integrationId,
        sectionId: error.sectionId,
        integrationName: error.integrationName,
        rawErrorCode: error.rawErrorCode,
        labels: labels.split(',').map(l => l.trim()).filter(Boolean),

        // Custom Fields exact payload (GS Schema)
        gpfyCustomerName,
        applicableProducts,
        customerPriority,
        ticketSource,
        companyName,
        customerCode,
        celigoFlowUrl,
        celigoErrorId,
        issueDate,
        ticketSummaryDescription: syncRepeatedDescription ? description : ticketSummaryDescription,

        customFields: {
          customfield_10041: { value: gpfyCustomerName },
          customfield_10132: applicableProducts.map(p => ({ value: p })),
          customfield_10136: { value: customerPriority },
          customfield_10230: { value: ticketSource },
          customfield_10141: companyName,
          customfield_11305: customerCode,
          customfield_11303: celigoFlowUrl,
          customfield_11304: celigoErrorId,
          customfield_10227: issueDate,
          customfield_10292: syncRepeatedDescription ? description : ticketSummaryDescription,
        },
      };

      const result = await createJiraTicket(payload);
      setSuccessTicket(result.ticket);
      onTicketCreated(result.ticket, error.id || inboundCeligoErrorId);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Failed to create Jira ticket:', err);
      setErrorMsg(err.message || 'Failed to create Jira ticket in GS space');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (successTicket?.url) {
      navigator.clipboard.writeText(successTicket.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-850 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Create Jira Ticket
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                  Space: {JIRA_PROJECT_CONFIG.name} ({JIRA_PROJECT_CONFIG.key} • ID: {JIRA_PROJECT_CONFIG.id})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {JIRA_ISSUE_TYPE_CONFIG.name} (ID: {JIRA_ISSUE_TYPE_CONFIG.id})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Targeting Atlassian Jira Cloud: <span className="text-sky-400 font-mono">gappify.atlassian.net</span>
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

        {/* 2-Step Stepper Navigation */}
        {!successTicket && (
          <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Step 1 Pill */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  step === 1 
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 1 ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                }`}>
                  1
                </span>
                <span>Main Fields</span>
              </button>

              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

              {/* Step 2 Pill */}
              <button
                type="button"
                onClick={() => {
                  if (summary.trim()) setStep(2);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  step === 2 
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 2 ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                }`}>
                  2
                </span>
                <span>Custom Fields</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-mono hidden sm:inline">
                  GS Schema
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Step <strong className="text-white">{step}</strong> of 2
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Connection Status Badge */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            jiraStatus.connected
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${jiraStatus.connected ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>
                Domain: <strong className="text-slate-200">gappify.atlassian.net</strong> • Space: <strong className="text-slate-200">GS</strong> (ID: 10010)
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              jiraStatus.connected 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : 'bg-slate-800 text-slate-400'
            }`}>
              {jiraStatus.connected ? 'Jira Live' : 'Jira Cloud Ready'}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Notice:</strong>
                <span className="break-all">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {successTicket ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white tracking-tight">
                  Jira Ticket Created: <span className="text-sky-400">{successTicket.key}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Integration incident successfully recorded in Space <strong>GS (ID: 10010)</strong> under <strong>Integration Issue</strong> and assigned to <strong>{assigneeName}</strong>.
                </p>
              </div>

              {/* Ticket Card Details */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs text-slate-300 space-y-2 max-w-lg mx-auto">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                  <span className="text-slate-500">Ticket Key:</span>
                  <span className="text-sky-400 font-bold text-sm">{successTicket.key}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Space & Issue Type:</span>
                  <span className="text-white font-medium">GS (10010) • Integration Issue (10279)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Celigo Error ID:</span>
                  <span className="text-emerald-400 font-semibold">{celigoErrorId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">GPFY Customer:</span>
                  <span className="text-amber-300 font-semibold">{gpfyCustomerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Priority:</span>
                  <span className="text-emerald-400 font-semibold">{priority}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Assignee:</span>
                  <span className="text-slate-300">{assigneeName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Celigo Flow URL:</span>
                  <span className="text-sky-400 truncate max-w-[260px]">{celigoFlowUrl}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {successTicket.url && (
                  <a
                    href={successTicket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Open in Jira Cloud</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied Ticket URL' : 'Copy Ticket Link'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Ticket Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* STEP 1: MAIN / STANDARD FIELDS */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Fixed Jira Standard Schema:</span>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px]">
                        Space: GS (ID: 10010)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[11px]">
                        Issue Type: Integration Issue (ID: 10279)
                      </span>
                    </div>
                  </div>

                  {/* Summary (summary) with VMAC / JE / Other & [Company Name] Convention */}
                  <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="block text-xs font-semibold text-slate-200">
                        Ticket Summary <span className="text-rose-400">*</span> <span className="text-[10px] text-slate-500 font-mono">(summary)</span>
                      </label>
                      <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        Format: VMAC/JE/Other _Error: [Name] &gt; Short error description
                      </span>
                    </div>

                    {/* Flow Classification Selector Pills */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">Flow Classification:</span>
                      {(['VMAC', 'JE', 'Other'] as FlowClassificationType[]).map((type) => {
                        const style = getFlowTypeBadgeStyle(type);
                        const isSelected = flowType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleFlowTypeChange(type)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? `${style.pillClass} ring-1 ring-white/20 shadow-xs`
                                : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-750'
                            }`}
                          >
                            <span>{type === 'VMAC' ? '🏷️ VMAC' : type === 'JE' ? '📑 JE' : '⚙️ Other'}</span>
                            <span className="text-[10px] font-normal opacity-80">
                              ({type === 'VMAC' ? 'Vendor/AP' : type === 'JE' ? 'Journal Entry/GL' : 'Flow'})
                            </span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={handleRegenerateStandardSummary}
                        className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition"
                        title="Rebuild formatted summary using current customer and description"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Rebuild Format</span>
                      </button>
                    </div>

                    {/* Full Summary Input */}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono font-medium"
                        placeholder="VMAC/JE/Other _Error: [Company Name] > Short error description"
                      />
                    </div>
                  </div>

                  {/* Priority & Assignee & Reporter */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Priority (priority) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Priority <span className="text-[10px] text-slate-500 font-mono">(priority)</span>
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        {JIRA_PRIORITY_OPTIONS.map(p => (
                          <option key={p} value={p}>
                            {p} {p === 'P2 - Medium' ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Default: P2 - Medium</span>
                    </div>

                    {/* Assignee (assignee) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Assignee <span className="text-[10px] text-slate-500 font-mono">(assignee)</span>
                      </label>
                      <select
                        onChange={(e) => handleAssigneeChange(e.target.value)}
                        defaultValue="gappify-support"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="gappify-support">
                          Gappify Customer Support (Default)
                        </option>
                        <option value="damian">Damian (damian@gappify.com)</option>
                        <option value="accounting">Accounting Ops Team</option>
                      </select>
                      <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                        ID: {assigneeAccountId}
                      </span>
                    </div>

                    {/* Reporter (reporter) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Reporter <span className="text-[10px] text-slate-500 font-mono">(reporter)</span>
                      </label>
                      <input
                        type="text"
                        value={reporter}
                        onChange={(e) => setReporter(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Logged-in Jira user</span>
                    </div>
                  </div>

                  {/* Labels */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Labels <span className="text-[10px] text-slate-500 font-mono">(labels)</span>
                    </label>
                    <input
                      type="text"
                      value={labels}
                      onChange={(e) => setLabels(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  {/* Description (without solutions or CLI commands) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Description <span className="text-[10px] text-slate-500 font-mono">(description)</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Incident details & root cause (excludes solutions/CLI)
                      </span>
                    </div>
                    <textarea
                      rows={7}
                      value={description}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: CUSTOM FIELDS (GS Schema) */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3 bg-sky-950/30 rounded-xl border border-sky-800/40 text-xs text-sky-200 flex items-center justify-between">
                    <div>
                      <strong className="font-semibold block mb-0.5">Jira GS Space Custom Fields:</strong>
                      <span>Fill the 10 custom fields defined for <strong>Integration Issue</strong> tickets.</span>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-mono text-[11px] font-semibold">
                      Space GS
                    </span>
                  </div>

                  {/* Field 1 & 2: GPFY Customer Name (customfield_10041) + Company Name (customfield_10141) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    
                    {/* GPFY Customer Name */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        GPFY Customer Name <span className="text-amber-400">*</span>
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_10041 (Select List single choice)</span>
                      </label>
                      
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                          className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2 text-xs text-left text-white flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-medium truncate">{gpfyCustomerName}</span>
                          <span className="text-[10px] text-sky-400 font-mono">Select (190+ Options) ▼</span>
                        </button>

                        {isCustomerDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 max-h-60 overflow-hidden flex flex-col">
                            <div className="relative mb-2">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                              <input
                                type="text"
                                placeholder="Search customer (e.g. Airbnb, Datadog)..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                                autoFocus
                              />
                            </div>
                            <div className="overflow-y-auto flex-1 space-y-0.5">
                              {filteredCustomers.map(cust => (
                                <button
                                  key={cust}
                                  type="button"
                                  onClick={() => handleCustomerSelect(cust)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-between ${
                                    gpfyCustomerName === cust
                                      ? 'bg-sky-600 text-white font-semibold'
                                      : 'text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{cust}</span>
                                  {gpfyCustomerName === cust && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                              {filteredCustomers.length === 0 && (
                                <div className="text-center py-3 text-xs text-slate-500">
                                  No customer found matching "{customerSearch}"
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Selected: <strong className="text-slate-300">{gpfyCustomerName}</strong>
                      </span>
                    </div>

                    {/* Company Name (customfield_10141) - Auto-replicates GPFY Customer Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Company Name
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_10141 (Text Field - Auto-replicated)</span>
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                        placeholder="Replicates GPFY Customer Name"
                      />
                      <span className="text-[10px] text-emerald-400 mt-1 block">
                        ✓ Replicates selection made at GPFY Customer Name
                      </span>
                    </div>
                  </div>

                  {/* Field 3: Applicable Product (customfield_10132 - Select List multiple choices) */}
                  <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Applicable Product <span className="text-[10px] text-slate-400 font-mono">(customfield_10132 - Select List multiple choices)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {APPLICABLE_PRODUCT_OPTIONS.map(prod => {
                        const isSelected = applicableProducts.includes(prod);
                        return (
                          <button
                            key={prod}
                            type="button"
                            onClick={() => toggleProduct(prod)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-sky-500/20 border-sky-500 text-sky-200 font-semibold'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-sky-400' : 'bg-slate-600'}`} />
                            <span>{prod}</span>
                            {isSelected && <Check className="w-3 h-3 text-sky-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field 4 & 5: Customer Priority (customfield_10136) & Ticket Source (customfield_10230) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Customer Priority */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Customer Priority
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_10136 (Select List single choice)</span>
                      </label>
                      <select
                        value={customerPriority}
                        onChange={(e) => setCustomerPriority(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        {CUSTOMER_PRIORITY_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt} {opt === 'Medium' ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Default: Medium</span>
                    </div>

                    {/* Ticket Source */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Ticket Source
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_10230 (Select List single choice)</span>
                      </label>
                      <select
                        value={ticketSource}
                        onChange={(e) => setTicketSource(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        {TICKET_SOURCE_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt} {opt === 'Initiated by Gappify' ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Default: Initiated by Gappify</span>
                    </div>
                  </div>

                  {/* Field 6, 7, 8, 9: Customer Code, Date, Celigo Flow URL, Celigo Error ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    
                    {/* Customer Code (customfield_11305) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Customer Code
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_11305 (Text Field single line)</span>
                      </label>
                      <input
                        type="text"
                        value={customerCode}
                        onChange={(e) => setCustomerCode(e.target.value)}
                        placeholder="e.g. GPFY-CUST-01"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>

                    {/* Date of the issue/request (customfield_10227) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Date of the issue/request
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_10227 (Date Picker)</span>
                      </label>
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Picked from error or current date</span>
                    </div>

                    {/* Celigo Flow URL (customfield_11303) */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Celigo Flow URL
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_11303 (Text Field single line - Auto-extracted)</span>
                      </label>
                      <div className="relative">
                        <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={celigoFlowUrl}
                          onChange={(e) => setCeligoFlowUrl(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-sky-300 focus:outline-none focus:border-sky-500 font-mono"
                          placeholder="https://integrator.io/integrations/.../flows/sections/.../flowBuilder/...#build"
                        />
                      </div>
                    </div>

                    {/* Celigo Error ID (customfield_11304) */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Error ID <span className="text-emerald-400">*</span>
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_11304 (Completed with Error ID from Celigo inbound data)</span>
                      </label>
                      <div className="relative">
                        <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={celigoErrorId}
                          onChange={(e) => setCeligoErrorId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-sky-500 font-mono"
                          placeholder="e.g. 1886125290"
                        />
                      </div>
                      <span className="text-[10px] text-emerald-400 mt-1 block">
                        ✓ Inbound Celigo Error ID: {inboundCeligoErrorId}
                      </span>
                    </div>
                  </div>

                  {/* Field 10: Ticket Summary/Description (customfield_10292 - Text Field multi-line) */}
                  <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-200">
                        Ticket Summary/Description
                        <span className="text-[10px] text-slate-400 font-mono block">customfield_10292 (Text Field multi-line - Repeats Description)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncRepeatedDescription}
                          onChange={(e) => setSyncRepeatedDescription(e.target.checked)}
                          className="rounded border-slate-700 text-sky-600 focus:ring-0"
                        />
                        <span className="text-[11px]">Sync with main Description</span>
                      </label>
                    </div>

                    <textarea
                      rows={4}
                      value={syncRepeatedDescription ? description : ticketSummaryDescription}
                      onChange={(e) => {
                        setTicketSummaryDescription(e.target.value);
                        if (syncRepeatedDescription) setSyncRepeatedDescription(false);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Repeats the Description text for Jira reporting & dashboard widgets.
                    </span>
                  </div>
                </div>
              )}

              {/* Form Footer Navigation */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <div className="text-[11px] text-slate-500 hidden sm:block">
                    Space: <strong className="text-slate-400">GS</strong> • Customer: <strong className="text-slate-400 truncate max-w-[120px] inline-block align-bottom">{gpfyCustomerName}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {step === 1 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      <span>Next: Custom Fields</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{loading ? 'Creating in Jira...' : 'Create Jira Ticket'}</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
