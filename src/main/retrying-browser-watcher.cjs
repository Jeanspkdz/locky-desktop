function createRetryingBrowserWatcher(createWatcher) {
  let watcher;

  return Object.freeze({
    snapshot() {
      try {
        watcher ??= createWatcher();
        return watcher.snapshot();
      } catch (error) {
        watcher = undefined;
        throw error;
      }
    },
  });
}

module.exports = { createRetryingBrowserWatcher };
