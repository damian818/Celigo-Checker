import webpush from 'web-push';
import { getCeligoTargets, formatCeligoFlowUrl, CeligoEnvTarget } from './apiHandler.js';

export interface PushSubscriptionItem {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  registeredAt: string;
}

export interface BackgroundSyncStatus {
  enabled: boolean;
  autoSyncIntervalMinutes: number;
  lastSyncTimestamp: number;
  nextSyncTimestamp: number;
  isSyncing: boolean;
  lastErrorCount: number;
  newErrorsDetected: number;
  activePushSubscriptions: number;
  recentLogs: Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }>;
  tokensConfigured: boolean;
}

class BackgroundSyncEngine {
  private autoSyncIntervalMinutes = 5;
  private enabled = true;
  private isSyncing = false;
  private lastSyncTimestamp = 0;
  private knownErrorIds = new Set<string>();
  private pushSubscriptions: PushSubscriptionItem[] = [];
  private timer: NodeJS.Timeout | null = null;
  private logs: Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }> = [];
  
  // Stored Celigo credentials from client syncs
  private savedProdToken: string | null = null;
  private savedSandboxToken: string | null = null;
  private savedCeligoStack: 'us' | 'eu' = 'us';

  // VAPID keys for Web Push
  private vapidKeys: { publicKey: string; privateKey: string };

  constructor() {
    // Generate or use deterministic VAPID keys for push notifications
    const pubKey = process.env.VAPID_PUBLIC_KEY || 'BCd1T9W3xG6mQy-X0q-eX7uX9P2bZ4yQ8_3A1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z';
    const privKey = process.env.VAPID_PRIVATE_KEY || 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V';
    
    try {
      this.vapidKeys = webpush.generateVAPIDKeys();
    } catch {
      this.vapidKeys = { publicKey: pubKey, privateKey: privKey };
    }

    try {
      webpush.setVapidDetails(
        'mailto:support@gappify.com',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      );
    } catch (err) {
      console.warn('[BackgroundSyncEngine] VAPID setup notice:', err);
    }

    this.log('Background Sync Engine initialized with 24/7 server runner.', 'info');
  }

  public start() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    // Check every 30 seconds if it's time to run background sync
    this.timer = setInterval(() => {
      this.checkAndRunSync();
    }, 30000);

    // Initial check after 10 seconds of server startup
    setTimeout(() => {
      this.checkAndRunSync();
    }, 10000);

    this.log(`24/7 Background poller started (Interval: ${this.autoSyncIntervalMinutes} minutes).`, 'info');
  }

  public updateTokens(prodToken?: string, sandboxToken?: string, stack?: 'us' | 'eu') {
    let updated = false;
    if (prodToken && prodToken.trim() && prodToken !== this.savedProdToken) {
      this.savedProdToken = prodToken.trim();
      updated = true;
    }
    if (sandboxToken && sandboxToken.trim() && sandboxToken !== this.savedSandboxToken) {
      this.savedSandboxToken = sandboxToken.trim();
      updated = true;
    }
    if (stack && (stack === 'us' || stack === 'eu') && stack !== this.savedCeligoStack) {
      this.savedCeligoStack = stack;
      updated = true;
    }
    if (updated) {
      this.log('Celigo credentials updated for server background polling.', 'info');
      // Trigger instant check with fresh credentials
      this.runSyncNow();
    }
  }

  public setConfig(intervalMinutes?: number, enabled?: boolean) {
    if (typeof intervalMinutes === 'number' && intervalMinutes > 0) {
      this.autoSyncIntervalMinutes = intervalMinutes;
    }
    if (typeof enabled === 'boolean') {
      this.enabled = enabled;
    }
    this.log(`Config updated: Interval=${this.autoSyncIntervalMinutes}m, Enabled=${this.enabled}`, 'info');
  }

  public getVapidPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  public addPushSubscription(sub: PushSubscriptionItem): boolean {
    const existingIndex = this.pushSubscriptions.findIndex(s => s.endpoint === sub.endpoint);
    if (existingIndex >= 0) {
      this.pushSubscriptions[existingIndex] = { ...sub, registeredAt: new Date().toISOString() };
    } else {
      this.pushSubscriptions.push({ ...sub, registeredAt: new Date().toISOString() });
    }
    this.log(`New Web Push device subscribed. Total devices: ${this.pushSubscriptions.length}`, 'success');
    return true;
  }

  public getStatus(): BackgroundSyncStatus {
    const nextSyncTimestamp = this.lastSyncTimestamp > 0
      ? this.lastSyncTimestamp + (this.autoSyncIntervalMinutes * 60 * 1000)
      : Date.now();

    const hasTokens = Boolean(
      (this.savedProdToken && this.savedProdToken.length > 5) ||
      (this.savedSandboxToken && this.savedSandboxToken.length > 5) ||
      process.env.CELIGO_PROD_TOKEN ||
      process.env.CELIGO_SANDBOX_TOKEN
    );

    return {
      enabled: this.enabled,
      autoSyncIntervalMinutes: this.autoSyncIntervalMinutes,
      lastSyncTimestamp: this.lastSyncTimestamp,
      nextSyncTimestamp,
      isSyncing: this.isSyncing,
      lastErrorCount: this.knownErrorIds.size,
      newErrorsDetected: 0,
      activePushSubscriptions: this.pushSubscriptions.length,
      recentLogs: this.logs.slice(-15),
      tokensConfigured: hasTokens,
    };
  }

  public async sendTestPush(): Promise<{ success: boolean; sentTo: number; errors?: any[] }> {
    if (this.pushSubscriptions.length === 0) {
      return { success: false, sentTo: 0, errors: ['No device push subscriptions registered. Enable push in settings first.'] };
    }

    const payload = JSON.stringify({
      title: '🔔 Test Alert: Gappify Celigo Background Sync',
      body: 'Mobile & Desktop background notifications are working 24/7! You will be alerted even when switching apps or locking your phone.',
      icon: '/favicon-32x32.png',
      badge: '/favicon-16x16.png',
      tag: 'test-bg-push',
      url: '/?tab=errors',
    });

    return await this.dispatchPushPayload(payload);
  }

  private checkAndRunSync() {
    if (!this.enabled || this.isSyncing) return;

    const now = Date.now();
    const intervalMs = this.autoSyncIntervalMinutes * 60 * 1000;

    if (this.lastSyncTimestamp === 0 || (now - this.lastSyncTimestamp) >= intervalMs) {
      this.runSyncNow();
    }
  }

  public async runSyncNow(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.lastSyncTimestamp = Date.now();

    try {
      this.log('Executing 24/7 background Celigo sync cycle...', 'info');

      const targets: CeligoEnvTarget[] = [];
      const isEu = this.savedCeligoStack === 'eu';
      const defaultStack = isEu ? 'https://api.eu.integrator.io' : 'https://api.integrator.io';
      const defaultHost = isEu ? 'eu.integrator.io' : 'integrator.io';

      const prodToken = this.savedProdToken || process.env.CELIGO_PROD_TOKEN;
      const sandboxToken = this.savedSandboxToken || process.env.CELIGO_SANDBOX_TOKEN;

      if (prodToken) {
        targets.push({ name: 'production', label: 'Production', token: prodToken, stack: defaultStack, host: defaultHost });
      }
      if (sandboxToken) {
        targets.push({ name: 'sandbox', label: 'Sandbox', token: sandboxToken, stack: defaultStack, host: defaultHost });
      }

      if (targets.length === 0) {
        this.log('Background sync paused: No Celigo API tokens available yet.', 'warn');
        this.isSyncing = false;
        return;
      }

      const currentUnresolvedErrors: Array<{ id: string; flowName: string; rawErrorMessage: string }> = [];

      for (const target of targets) {
        try {
          const intgRes = await fetch(`${target.stack}/v1/integrations`, {
            headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
          });
          if (!intgRes.ok) continue;
          const integrations = await intgRes.json();
          if (!Array.isArray(integrations)) continue;

          for (const intg of integrations) {
            const intgId = String(intg._id || intg.id);
            const errRes = await fetch(`${target.stack}/v1/integrations/${intgId}/errors`, {
              headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' }
            });
            if (errRes.ok) {
              const errors = await errRes.json();
              if (Array.isArray(errors)) {
                for (const errItem of errors) {
                  const numErr = errItem.numError || errItem.errorCount || 0;
                  if (numErr > 0 && errItem._flowId) {
                    const errId = String(errItem._id || errItem.id || `${errItem._flowId}_${errItem.code}`);
                    currentUnresolvedErrors.push({
                      id: errId,
                      flowName: errItem.flowName || 'Celigo Integration Flow',
                      rawErrorMessage: errItem.message || errItem.errorMessage || 'Execution rejection',
                    });
                  }
                }
              }
            }
          }
        } catch (targetErr: any) {
          this.log(`Error checking target ${target.name}: ${targetErr.message}`, 'warn');
        }
      }

      // Check for newly discovered errors
      const newlyDiscovered: Array<{ id: string; flowName: string; rawErrorMessage: string }> = [];
      const currentIds = new Set<string>();

      for (const err of currentUnresolvedErrors) {
        currentIds.add(err.id);
        if (!this.knownErrorIds.has(err.id)) {
          newlyDiscovered.push(err);
        }
      }

      this.knownErrorIds = currentIds;

      if (newlyDiscovered.length > 0) {
        this.log(`⚠️ Alert: ${newlyDiscovered.length} NEW Celigo error(s) detected during background sync!`, 'warn');

        // Dispatch Web Push Notification to mobile & laptop native OS centers
        const sampleFlows = Array.from(new Set(newlyDiscovered.map(e => e.flowName))).slice(0, 2).join(', ');
        const pushPayload = JSON.stringify({
          title: `⚠️ ${newlyDiscovered.length} New Celigo Error${newlyDiscovered.length > 1 ? 's' : ''} Detected`,
          body: `Affected flows: ${sampleFlows}. Open Gappify Hub to inspect & auto-remediate.`,
          icon: '/favicon-32x32.png',
          badge: '/favicon-16x16.png',
          tag: 'celigo-new-error',
          url: '/?tab=errors',
        });

        await this.dispatchPushPayload(pushPayload);
      } else {
        this.log(`Background sync complete: ${currentUnresolvedErrors.length} total unresolved error(s) monitored across Celigo.`, 'success');
      }

    } catch (err: any) {
      this.log(`Background sync cycle failed: ${err.message}`, 'error');
    } finally {
      this.isSyncing = false;
    }
  }

  private async dispatchPushPayload(payloadString: string): Promise<{ success: boolean; sentTo: number; errors?: any[] }> {
    if (this.pushSubscriptions.length === 0) {
      return { success: true, sentTo: 0 };
    }

    let sentCount = 0;
    const errors: any[] = [];
    const validSubs: PushSubscriptionItem[] = [];

    for (const sub of this.pushSubscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys
        }, payloadString);
        sentCount++;
        validSubs.push(sub);
      } catch (pushErr: any) {
        this.log(`Push dispatch warning (${sub.endpoint.slice(0, 25)}...): ${pushErr.message}`, 'warn');
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          // Subscription expired or invalid, drop it
          continue;
        }
        validSubs.push(sub);
        errors.push(pushErr.message);
      }
    }

    this.pushSubscriptions = validSubs;
    if (sentCount > 0) {
      this.log(`Web Push notification dispatched to ${sentCount} device(s).`, 'success');
    }
    return { success: sentCount > 0, sentTo: sentCount, errors };
  }

  private log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, message, type });
    if (this.logs.length > 50) {
      this.logs.shift();
    }
    console.log(`[BackgroundSyncEngine ${type.toUpperCase()}] ${message}`);
  }
}

export const backgroundSyncEngine = new BackgroundSyncEngine();
