const remainingTime = document.querySelector('#remaining-time');
const lockContent = document.querySelector('.lock-content');

function centerOnDisplay() {
  const display = window.screen;
  if (!display || !lockContent || !Number.isFinite(window.screenX) || !Number.isFinite(window.screenY)) return;
  const displayLeft = display.availLeft ?? 0;
  const displayTop = display.availTop ?? 0;
  const displayWidth = display.availWidth || display.width;
  const displayHeight = display.availHeight || display.height;
  const horizontalOffset = displayLeft + displayWidth / 2 - (window.screenX + window.innerWidth / 2);
  const verticalOffset = displayTop + displayHeight / 2 - (window.screenY + window.innerHeight / 2);
  lockContent.style.setProperty('--lock-center-x', `${Math.round(horizontalOffset)}px`);
  lockContent.style.setProperty('--lock-center-y', `${Math.round(verticalOffset)}px`);
}

centerOnDisplay();
window.addEventListener?.('resize', centerOnDisplay);
window.setInterval?.(centerOnDisplay, 1000);
let remainingMs = 7 * 60 * 1000;
let sampledAt = performance.now();

function currentRemainingMs() {
  return Math.max(0, remainingMs - (performance.now() - sampledAt));
}

function renderRemainingTime() {
  const totalSeconds = Math.ceil(currentRemainingMs() / 1000);
  remainingTime.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

window.locky.onLockRemaining(value => {
  const current = currentRemainingMs();
  remainingMs = value > current + 5000 ? value : Math.min(current, value);
  sampledAt = performance.now();
  renderRemainingTime();
});

renderRemainingTime();
setInterval(renderRemainingTime, 250);
