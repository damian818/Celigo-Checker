// Web Notifications and Audio Alert Utilities for Gappify Celigo Remediation Hub

export class NotificationService {
  private static audioCtx: AudioContext | null = null;

  /**
   * Check if the application is currently running inside an iframe (e.g. AI Studio preview container)
   */
  public static isInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  /**
   * Open the app in a standalone, dedicated browser tab for 100% unrestricted native OS desktop/mobile notifications
   */
  public static openInDedicatedTab(): void {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }

  /**
   * Request native browser OS notification permission (supports Promisified and Callback Safari implementations)
   */
  public static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications.');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    return new Promise((resolve) => {
      try {
        const res = Notification.requestPermission((p) => resolve(p));
        if (res && typeof (res as any).then === 'function') {
          (res as any).then(resolve).catch((err: any) => {
            console.warn('Notification permission promise rejected:', err);
            resolve('denied');
          });
        }
      } catch (e) {
        console.error('Error requesting notification permission:', e);
        resolve('denied');
      }
    });
  }

  /**
   * Get current permission state
   */
  public static getPermissionState(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  /**
   * Dispatch a native OS desktop / mobile notification for errors discovered during sync
   */
  public static notifyErrors(totalCount: number, newCount = 0, flowNames: string[] = []): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const flowSummary = flowNames.slice(0, 2).join(', ') + (flowNames.length > 2 ? ` and ${flowNames.length - 2} more` : '');
    const isNew = newCount > 0;
    const title = isNew
      ? `⚠️ ${newCount} New Celigo Integration Error${newCount > 1 ? 's' : ''} Detected`
      : `⚠️ ${totalCount} Unresolved Celigo Error${totalCount > 1 ? 's' : ''} in Queue`;

    const body = flowNames.length > 0 
      ? `Flows affected: ${flowSummary}. Open Gappify Remediation Hub to inspect & auto-heal.`
      : `${totalCount} unresolved error(s) flagged in Celigo. Click to view and remediate.`;

    this.dispatchNotification(title, body, 'celigo-error-alert');
  }

  /**
   * Dispatch a notification when sync completes and all flows are healthy (0 errors)
   */
  public static notifyHealthySync(flowsCount: number, integrationsCount = 0): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const title = `✅ Celigo Sync: All Integrations Healthy`;
    const body = `Monitored ${flowsCount} flow${flowsCount !== 1 ? 's' : ''} across Celigo. 0 unresolved errors found.`;

    this.dispatchNotification(title, body, 'celigo-healthy-sync');
  }

  /**
   * Trigger a test notification to verify OS banners and chime
   */
  public static async testNotification(): Promise<boolean> {
    const permission = await this.requestPermission();
    if (permission === 'granted') {
      this.playAlertChime();
      this.dispatchNotification(
        '🔔 Desktop Alert: Gappify Celigo Remediation Hub',
        'Native OS notifications & audio alerts are active! You will receive live sync alerts.',
        'test-notification'
      );
      return true;
    }
    return false;
  }

  /**
   * Centralized safe notification dispatcher (Service Worker for Mobile/PWA + Window Notification for Desktop)
   */
  private static dispatchNotification(title: string, body: string, tag: string): void {
    try {
      // First try Service Worker registration (critical for Android, macOS PWA, Windows PWA)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            return reg.showNotification(title, {
              body,
              icon: '/favicon-32x32.png',
              badge: '/favicon-16x16.png',
              tag: tag || 'celigo-alert',
              renotify: true,
              vibrate: [200, 100, 200],
              data: { url: '/?tab=errors' }
            } as any);
          })
          .catch((swErr) => {
            console.warn('Service worker showNotification failed, attempting Window fallback:', swErr);
            this.createWindowNotification(title, body, tag);
          });
      } else {
        this.createWindowNotification(title, body, tag);
      }
    } catch (e) {
      console.warn('Notification dispatch failed, attempting window fallback:', e);
      this.createWindowNotification(title, body, tag);
    }
  }

  private static createWindowNotification(title: string, body: string, tag: string): void {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const n = new Notification(title, {
        body,
        icon: '/favicon-32x32.png',
        tag: tag || 'celigo-alert',
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn('Native Window Notification constructor failed:', err);
    }
  }

  /**
   * Play a subtle, non-intrusive alert chime via Web Audio API
   */
  public static playAlertChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      // Pleasant two-tone chime (587Hz -> 880Hz)
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Audio context might be restricted without user interaction
    }
  }

  /**
   * Helper to convert VAPID base64 string to Uint8Array for PushManager
   */
  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Register Web Push Subscription for 24/7 background alerts on Android/Desktop
   */
  public static async subscribeToPushNotifications(): Promise<{ success: boolean; message: string }> {
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return { success: false, message: 'Notification permission denied by browser.' };
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { success: false, message: 'Web Push is not supported in this browser environment.' };
      }

      const reg = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from backend
      const vapidRes = await fetch('/api/push/vapid-key');
      if (!vapidRes.ok) {
        throw new Error('Failed to retrieve server VAPID key');
      }
      const { publicKey } = await vapidRes.json();

      let sub = await reg.pushManager.getSubscription();
      if (!sub && publicKey) {
        const applicationServerKey = this.urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      if (!sub) {
        return { success: false, message: 'Could not establish PushSubscription with push manager.' };
      }

      // Send subscription object to server
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save push subscription on server');
      }

      return { success: true, message: '✓ Device registered for 24/7 background mobile & desktop push alerts!' };
    } catch (err: any) {
      console.error('Failed to subscribe to Web Push:', err);
      return { success: false, message: err.message || 'Push subscription failed' };
    }
  }

  /**
   * Dispatch test 24/7 background push notification from server
   */
  public static async sendTestPushNotification(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: `🚀 Test push notification sent to ${data.sentTo} registered device(s)!` };
      }
      return { success: false, message: data.errors?.[0] || 'No push devices registered yet.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to dispatch test push' };
    }
  }
}

