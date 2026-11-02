const remainingTime = document.querySelector('#remaining-time');
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
