# 01: Locky Runs in the Background

**What to build:** Locky starts with the Windows session without showing settings, continues protecting the computer after that window closes, and shows settings again when Locky is launched without starting a second protection instance.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] When signing in to Windows, Locky starts protection without opening the settings window.
- [ ] Closing settings does not stop extension communication or timer progress.
- [ ] Launching Locky again shows settings for the active instance without duplicating the supervisor process.
- [ ] A behavior test confirms that a prohibited page is still detected after settings are closed.

## Answer

Locky keeps the settings window hidden when started with `--background`, stays alive after that window closes, and reuses the single instance when launched again. The development installer registers startup for the Windows session; recovery from the native host also opens Locky in the background. `pnpm setup:dev` completed successfully on this machine. Real navigation validation after closing settings remains pending with ticket 07's manual smoke test.
