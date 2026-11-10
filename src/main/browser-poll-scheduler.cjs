const DEFAULT_DETECTION_INTERVAL_MS = 3000;
const DEFAULT_WINDOW_TRACKING_INTERVAL_MS = 500;

function createBrowserPollScheduler({
  detectBrowsers,
  trackWindows,
  isLockActive,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  detectionIntervalMs = DEFAULT_DETECTION_INTERVAL_MS,
  windowTrackingIntervalMs = DEFAULT_WINDOW_TRACKING_INTERVAL_MS,
  onDetectionError = () => {},
  onWindowTrackingError = () => {},
  onLockInactive = () => {},
}) {
  let running = false;
  let detectionTimer = null;
  let windowTrackingTimer = null;
  let detectionInProgress = false;

  function clearDetectionTimer() {
    if (detectionTimer !== null) clearTimeoutFn(detectionTimer);
    detectionTimer = null;
  }

  function clearWindowTrackingTimer() {
    if (windowTrackingTimer !== null) clearTimeoutFn(windowTrackingTimer);
    windowTrackingTimer = null;
  }

  function scheduleDetection() {
    if (!running || detectionTimer !== null) return;
    detectionTimer = setTimeoutFn(() => {
      detectionTimer = null;
      void runDetection();
    }, detectionIntervalMs);
  }

  async function runDetection() {
    if (!running || detectionInProgress) return;
    detectionInProgress = true;
    try {
      await detectBrowsers();
    } catch (error) {
      onDetectionError(error);
    } finally {
      detectionInProgress = false;
      scheduleDetection();
    }
  }

  function scheduleWindowTracking() {
    if (!running || windowTrackingTimer !== null || !isLockActive()) return;
    windowTrackingTimer = setTimeoutFn(() => {
      windowTrackingTimer = null;
      runWindowTracking();
    }, windowTrackingIntervalMs);
  }

  function runWindowTracking() {
    if (!running) return;
    if (!isLockActive()) {
      clearWindowTrackingTimer();
      onLockInactive();
      return;
    }
    try {
      trackWindows();
    } catch (error) {
      onWindowTrackingError(error);
    }
    scheduleWindowTracking();
  }

  function startWindowTracking() {
    if (!running || !isLockActive()) return;
    clearWindowTrackingTimer();
    runWindowTracking();
  }

  return Object.freeze({
    start() {
      if (running) return;
      running = true;
      void runDetection();
      if (isLockActive()) startWindowTracking();
    },
    startWindowTracking,
    stopWindowTracking() {
      clearWindowTrackingTimer();
    },
    stop() {
      running = false;
      clearDetectionTimer();
      clearWindowTrackingTimer();
    },
  });
}

module.exports = {
  DEFAULT_DETECTION_INTERVAL_MS,
  DEFAULT_WINDOW_TRACKING_INTERVAL_MS,
  createBrowserPollScheduler,
};
