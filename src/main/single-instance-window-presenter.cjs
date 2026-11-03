function createSingleInstanceWindowPresenter(showSettingsWindow) {
  let ready = false;
  let showRequestedDuringStartup = false;

  return Object.freeze({
    request() {
      if (!ready) {
        showRequestedDuringStartup = true;
        return;
      }
      showSettingsWindow();
    },
    markReady() {
      if (ready) return;
      ready = true;
      if (!showRequestedDuringStartup) return;
      showRequestedDuringStartup = false;
      showSettingsWindow();
    },
  });
}

module.exports = { createSingleInstanceWindowPresenter };
