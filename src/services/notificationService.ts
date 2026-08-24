// Web Notifications and Audio Alert Utilities for Gappify Celigo Remediation Hub

export class NotificationService {
  private static audioCtx: AudioContext | null = null;

  /**
   * Request browser notification permission
   */
  public static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Get current permission state
   */
  public static getPermissionState(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  /**
   * Dispatch a native OS desktop notification for newly discovered or unresolved errors
   */
  public static notifyNewErrors(count: number, flowNames: string[] = []): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const flowSummary = flowNames.slice(0, 2).join(', ') + (flowNames.length > 2 ? ` and ${flowNames.length - 2} more` : '');
    const title = `⚠️ ${count} Celigo Integration Error${count > 1 ? 's' : ''} Detected`;
    const body = flowNames.length > 0 
      ? `Flows affected: ${flowSummary}. Open Gappify Remediation Hub to inspect & auto-heal.`
      : `${count} unresolved error(s) flagged in Celigo. Click to view and remediate.`;

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
        '🔔 Test Alert: Gappify Celigo Remediation Hub',
        'Desktop notifications & audio alerts are active! You will receive live sync alerts.',
        'test-notification'
      );
      return true;
    }
    return false;
  }

  /**
   * Centralized safe notification dispatcher (Service Worker + Window fallback)
   */
  private static dispatchNotification(title: string, body: string, tag: string): void {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/favicon-32x32.png',
              badge: '/favicon-16x16.png',
              tag,
              renotify: true,
              data: { url: '/?tab=errors' }
            } as any).catch(() => {
              this.createWindowNotification(title, body, tag);
            });
          })
          .catch(() => {
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
        tag,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn('Native Window Notification failed:', err);
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
        this.audioCtx.resume();
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
}

