const path = require('node:path');

const DEFAULT_PIPE_NAME = 'locky-desktop';

function getRuntimeConfig(environment = process.env) {
  if (environment.LOCKY_TEST_MODE !== '1') {
    return {
      pipeName: DEFAULT_PIPE_NAME,
      userDataPath: null,
      suppressOverlays: false,
      hideSettingsWindow: false,
    };
  }

  const requestedPipeName = environment.LOCKY_TEST_PIPE_NAME;
  const pipeName = typeof requestedPipeName === 'string'
    && /^[a-zA-Z0-9_-]{1,80}$/.test(requestedPipeName)
    ? requestedPipeName
    : DEFAULT_PIPE_NAME;

  return {
    pipeName,
    userDataPath: environment.LOCKY_TEST_USER_DATA_DIR
      ? path.resolve(environment.LOCKY_TEST_USER_DATA_DIR)
      : null,
    suppressOverlays: environment.LOCKY_TEST_NO_OVERLAY === '1',
    hideSettingsWindow: environment.LOCKY_TEST_HIDE_SETTINGS === '1',
  };
}

module.exports = { getRuntimeConfig };
