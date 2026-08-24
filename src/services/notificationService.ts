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
   * Dispatch a native OS desktop notification
   */
  public static notifyNewErrors(count: number, flowNames: string[] = []): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const flowSummary = flowNames.slice(0, 2).join(', ') + (flowNames.length > 2 ? ` and ${flowNames.length - 2} more` : '');
    const title = `⚠️ ${count} New Celigo Integration Error${count > 1 ? 's' : ''} Detected`;
    const body = flowNames.length > 0 
      ? `Flows affected: ${flowSummary}. Open Gappify Remediation Hub to inspect & auto-heal.`
      : `${count} unresolved error(s) flagged in recent sync. Click to inspect payloads.`;

    try {
      // Try service worker notification first for better mobile/desktop PWA support
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/favicon-32x32.png',
            badge: '/favicon-16x16.png',
            tag: 'celigo-new-error',
            data: { url: '/?tab=errors' }
          } as any);
        });
      } else {
        new Notification(title, {
          body,
          icon: '/favicon-32x32.png',
        });
      }
    } catch (e) {
      console.warn('Native notification failed, falling back', e);
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
