import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Mail, 
  MessageSquare, 
  Check, 
  AlertTriangle, 
  ExternalLink,
  Loader2
} from 'lucide-react';
import { CeligoErrorRecord } from '../types/celigo';
import { sendGChatAlert, sendGmailAlert } from '../services/apiClient';
import { getStoredTokens } from '../services/tokenStorage';

interface NotificationModalProps {
  error: CeligoErrorRecord;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  error,
  onClose,
}) => {
  const [channel, setChannel] = useState<'both' | 'gchat' | 'gmail'>('both');
  const [gchatSpace, setGchatSpace] = useState('Google Chat: #integrations-alerts (Production)');
  const [gmailRecipients, setGmailRecipients] = useState('damian@gappify.com, support@gappify.com');
  const [loading, setLoading] = useState(false);
  const [dispatchedResult, setDispatchedResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (tokens.gchatWebhookUrl) {
      setGchatSpace(tokens.gchatWebhookUrl);
    }
  }, []);

  const handleSend = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (channel === 'gchat' || channel === 'both') {
        if (!gchatSpace.startsWith('https://chat.googleapis.com/v1/spaces/')) {
           throw new Error('Please enter a valid Google Chat Webhook URL starting with https://chat.googleapis.com/v1/spaces/...');
        }
        await sendGChatAlert({
          title: `${error.recordIdentifier} failed in ${error.flowName}`,
          severity: error.severity,
          flowName: error.flowName,
          errorSummary: error.plainEnglishSummary,
          actionableStep: error.rootCauseSimple,
          cliCommand: error.suggestedCliCommand,
          spaceName: gchatSpace,
        });
      }

      if (channel === 'gmail' || channel === 'both') {
        await sendGmailAlert({
          recipients: gmailRecipients.split(',').map(r => r.trim()).filter(Boolean),
          subject: `[Celigo ${error.severity.toUpperCase()}] ${error.flowName} - ${error.recordIdentifier}`,
          bodyHtml: `<h3>Celigo Integration Alert</h3><p>${error.plainEnglishSummary}</p><p><b>Action:</b> ${error.actionRequiredBy}</p>`,
          severity: error.severity,
          flowName: error.flowName,
        });
      }

      setDispatchedResult({
        channel,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      console.error('Failed to send notification:', err);
      setErrorMsg(err.message || 'Failed to send notification. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Dispatch Real-Time Incident Alert
              </h3>
              <p className="text-xs text-slate-400">
                Send interactive cards to Google Chat Space & Gmail digests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {dispatchedResult ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">
                Alerts Successfully Broadcasted
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Interactive cards have been dispatched to Google Chat and Gmail stakeholders with 1-click remediation links.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs font-mono text-slate-300 space-y-1">
              <div>✓ Google Chat Webhook: Delivered</div>
              <div>✓ Gmail Recipients: {gmailRecipients}</div>
              <div>✓ Timestamp: {dispatchedResult.timestamp}</div>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Channel Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Broadcast Target Channels:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('both')}
                  className={`p-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    channel === 'both'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Both GChat & Gmail
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('gchat')}
                  className={`p-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    channel === 'gchat'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Google Chat
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('gmail')}
                  className={`p-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    channel === 'gmail'
                      ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-rose-400" /> Gmail
                </button>
              </div>
            </div>

            {/* Google Chat Space Input */}
            {(channel === 'gchat' || channel === 'both') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Google Chat Space / Webhook:
                </label>
                <input
                  type="text"
                  value={gchatSpace}
                  onChange={(e) => setGchatSpace(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            )}

            {/* Gmail Recipients Input */}
            {(channel === 'gmail' || channel === 'both') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Gmail Notification Recipients:
                </label>
                <input
                  type="text"
                  value={gmailRecipients}
                  onChange={(e) => setGmailRecipients(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            )}

            {/* Preview of Card Message */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Google Chat Card v2 Live Preview:
              </span>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-1.5 text-xs">
                <div className="font-bold text-rose-400 flex items-center gap-1">
                  🚨 [{error.severity.toUpperCase()}] Celigo Incident: {error.recordIdentifier}
                </div>
                <div className="text-slate-300 font-medium">{error.flowName}</div>
                <div className="text-[11px] text-slate-400">{error.plainEnglishSummary}</div>
                <div className="pt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-600/30 text-indigo-300 text-[10px] font-semibold">
                    Action: {error.actionRequiredBy}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">celigo-cli recovery attached</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {loading ? 'Broadcasting...' : 'Send Alerts Now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
