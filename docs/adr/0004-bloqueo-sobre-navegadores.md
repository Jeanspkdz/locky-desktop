# Show the Lock Screen Over Browsers

When someone tries to open a prohibited page, Locky starts a shared seven-minute browser lock for Chrome, Brave, and Edge. The application displays its own window over each affected browser and leaves other Windows applications available. This window was chosen over a tab because an extension cannot cover internal browser pages, such as settings; it also replaces the full-desktop screen described in ADR 0002. If a browser is closed and reopened, the lock reappears for the remaining time, including after Windows restarts.

The lock window is hidden when its browser is minimized and reappears when the browser is restored. Windows sleep counts toward the seven minutes. If Locky stops responding, the extensions block navigation until the connection is restored and the lock state is confirmed.

Locky attempts to restart automatically after a failure. When the lock ends, tabs become available again and prohibited pages remain blocked; a later attempt starts a new seven-minute lock. The lock window shows the remaining time.

After Windows restarts without an internet connection, Locky uses the system clock to calculate the remaining time and releases the browsers when seven minutes have elapsed. Manually advancing that clock may shorten the current lock; the prohibited page remains blocked and another attempt starts a new lock.
