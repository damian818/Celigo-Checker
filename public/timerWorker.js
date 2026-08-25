// Dedicated Background Timer Worker for Gappify Celigo Remediation Hub
// Keeps time off the main DOM thread to prevent background tab throttling on desktop and mobile browsers

let intervalId = null;

self.onmessage = function (e) {
  const { command, intervalMs } = e.data || {};

  if (command === 'start') {
    if (intervalId) clearInterval(intervalId);
    
    // Tick every 1000ms off-thread
    intervalId = setInterval(() => {
      self.postMessage({ type: 'tick', timestamp: Date.now() });
    }, intervalMs || 1000);

    self.postMessage({ type: 'started' });
  } else if (command === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    self.postMessage({ type: 'stopped' });
  }
};
