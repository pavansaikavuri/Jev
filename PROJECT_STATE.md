# QuizZy Project State

## Current Milestone: White & Blue UI Theme, Mutual Exclusivity & Unified Shortcuts
- **Status**: Production-Ready / All 142 Pytest Tests Passing (100% Pass Rate).
- **Offline Benchmark**: 15/15 Coding Benchmark Passed (100%) & All Self-Tests Passed.
- **Core Architecture**: Chrome Manifest V3 Extension + FastAPI Python Backend (`127.0.0.1:8000`).
- **Project Root**: `c:\Users\jassh\Projects\QuizZy\QuizZy`
- **Active Branch**: `main`

## Verified Upgrades & Bug Fixes
1. **Strict White & Blue Palette (`extension/sidepanel.css`, `extension/floating_hud.js`, `extension/sidepanel.js`)**:
   - Replaced all non-white/blue colors (greens, reds, ambers, purples) with a cohesive white and blue design system.
   - Deep rich navy/slate backgrounds (`#060B19`, `#0E1B38`), royal/ice blue borders (`#1D356A`, `#3B82F6`, `#60A5FA`), pure white text (`#FFFFFF`), light ice-blue secondary text (`#BFDBFE`, `#93C5FD`), and royal blue primary buttons (`#2563EB`).
2. **Mutual Exclusivity (`extension/background.js`, `extension/floating_hud.js`, `extension/sidepanel.js`)**:
   - Only one interface open at a time: when the floating HUD opens, the side panel automatically closes (`CLOSE_SIDEPANEL_COMMAND` -> `window.close()`).
   - When the side panel opens, the floating HUD is hidden across all tabs (`SIDEPANEL_STATE_CHANGED` -> `hide()`).
3. **Global Shortcut Routing Everywhere (`extension/floating_hud.js`, `extension/sidepanel.js`)**:
   - If side panel is open, all shortcut events on any tab (`Alt+S`, `Alt+A`, `Alt+N`, `Alt+K`/`Alt+W`, `Alt+O`, `Alt+M`, `Shift`, `Escape`) forward to side panel (`FORWARD_SHORTCUT_TO_SIDEPANEL`).
   - If side panel is closed, shortcuts operate on the floating HUD. Pressing `Ctrl` when side panel is open closes side panel and reveals floating HUD.
   - Solo `Shift` key listener inside side panel toggles Auto Mode for full functional parity with the floating HUD.
4. **Deep Scanning, Swipe/Advance & Two-Stage Verification**:
   - Progressive image/table/shadow-DOM extraction and `swipeOrAdvanceQuestion` fallback chain (skip -> next -> swiper -> touch gesture).
   - Strict compute-first, format-second prompt architecture (`<verification_workspace>` + `<verified_json>`).
5. **Comprehensive Verification**:
   - 142/142 pytest tests passing across 21 test suites; 15/15 coding benchmarks passing.
