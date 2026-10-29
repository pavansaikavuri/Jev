/**
 * QuizZy - Compact Rectangular Floating Bar & Movable White Dot HUD
 * 
 * Crisp, Shadow-DOM isolated on-page toolbar (~36px height, dark slate #111827).
 * Featuring Movable White Dot mode (double-tap Z or double-click dot)
 * and double-tap hotkeys (Ctrl, Z/Alt, Fn/Shift).
 */

(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") {
    const mockInstance = {
      isMock: true,
      isVisible: () => true,
      isHidden: () => false,
      isMinimized: () => false,
      toggle: () => {},
      show: () => {},
      hide: () => {},
      setMinimized: () => {},
      setHidden: () => {},
      destroy: () => {}
    };
    if (typeof module !== "undefined" && module.exports) {
      module.exports = mockInstance;
    }
    return { success: true, mounted: false, mock: true };
  }

  function isInsideCodeEditor(el) {
    if (!el) return false;
    if (typeof el.closest === "function") {
      try {
        return !!el.closest('.monaco-editor, .ace_editor, .cm-editor, .CodeMirror, [class*="monaco-editor"], [class*="ace_editor"]');
      } catch (_) {}
    }
    let cur = el;
    while (cur) {
      const cls = cur.className || "";
      if (typeof cls === "string" && (cls.includes("monaco-editor") || cls.includes("ace_editor") || cls.includes("cm-editor") || cls.includes("CodeMirror"))) {
        return true;
      }
      cur = cur.parentElement;
    }
    return false;
  }

  function hasQuizOptionsOutsideEditor(docRef) {
    if (typeof window !== "undefined" && window.QuizZyExtractor && typeof window.QuizZyExtractor.hasQuizOptionsOutsideEditor === "function") {
      try {
        return window.QuizZyExtractor.hasQuizOptionsOutsideEditor(docRef);
      } catch (_) {}
    }
    const doc = docRef || (typeof document !== "undefined" ? document : null);
    if (!doc) return false;
    try {
      const headerText = (doc.body ? (doc.body.innerText || doc.body.textContent || "") : (doc.documentElement ? doc.documentElement.textContent || "" : "")).slice(0, 1500).toLowerCase();
      const isCodingHeader = /coding\s*practice/i.test(headerText);
      const hasQuizHeader = !isCodingHeader && (/mcq\s*practice|practice\s*\|\s*|quiz\b/i.test(headerText));

      const allRadios = doc.querySelectorAll ? Array.from(doc.querySelectorAll("input[type='radio']")) : [];
      const radios = allRadios.filter(r => !isInsideCodeEditor(r));
      if (radios.length >= 2) return true;

      const allCheckboxes = doc.querySelectorAll ? Array.from(doc.querySelectorAll("input[type='checkbox'], [role='checkbox']")) : [];
      const checkboxes = allCheckboxes.filter(c => !isInsideCodeEditor(c));
      if (checkboxes.length >= 2) return true;

      const candidateEls = doc.querySelectorAll ? Array.from(doc.querySelectorAll(".quiz-option, [data-quiz-option], [class*='radio-item'], [class*='option-item'], [role='radio'], [role='option'], [data-rbd-draggable-id]")) : [];
      const optionCandidates = candidateEls.filter(el => !isInsideCodeEditor(el));
      if (optionCandidates.length >= 2) return true;

      if (!isCodingHeader) {
        const buttons = doc.querySelectorAll ? Array.from(doc.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn")).filter(b => !isInsideCodeEditor(b)) : [];
        const btnTexts = buttons.map(b => (b.innerText || b.textContent || b.value || "").trim().toLowerCase());
        const hasSubmit = btnTexts.some(t => /^(?:submit|submit\s*answer)$/i.test(t));
        const hasShowOrSkip = btnTexts.some(t => /^(?:show\s*answer|skip)$/i.test(t));
        if (hasSubmit && (hasShowOrSkip || hasQuizHeader)) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function isProctoredCodingPage() {
    if (typeof window === "undefined") return false;
    try {
      const loc = window.location;
      const pathname = (loc && loc.pathname) ? loc.pathname : "";
      
      // 1. Dedicated coding routes on CCBP (never mount in-page HUD on /question/*)
      if (pathname.includes("/question/") && !pathname.includes("/primitive-coding/practice/")) {
        return true;
      }
      if (pathname.includes("/coding/") && !pathname.includes("/practice")) {
        return true;
      }

      const doc = (typeof document !== "undefined") ? document : null;
      if (doc && hasQuizOptionsOutsideEditor(doc)) {
        return false;
      }

      const headerText = (doc && doc.body ? (doc.body.innerText || doc.body.textContent || "") : "").slice(0, 1500).toLowerCase();
      if (/coding\s*practice/i.test(headerText)) {
        return true;
      }

      if (doc && doc.querySelector) {
        const editor = doc.querySelector(".monaco-editor, .ace_editor, [data-editor='monaco']");
        if (editor) {
          const runBtns = Array.from(doc.querySelectorAll("button, [role='button']"))
            .map(b => (b.innerText || b.textContent || "").trim().toLowerCase());
          const hasRunCode = runBtns.some(t => /^(?:run|run\s*code|custom\s*input|compile\s*&\s*run|▶\s*run)$/i.test(t));
          if (hasRunCode) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  const HOST_ID = "__quizzy_hud_host__";

  function destroyInPageHudIfPresent() {
    try {
      const doc = (typeof document !== "undefined") ? document : null;
      if (doc) {
        const host = (typeof doc.getElementById === "function") ? doc.getElementById(HOST_ID) : null;
        if (host) {
          try {
            if (typeof host.remove === "function") {
              host.remove();
            } else if (host.parentNode && typeof host.parentNode.removeChild === "function") {
              host.parentNode.removeChild(host);
            }
          } catch (_) {}
        }
        if (typeof doc.querySelectorAll === "function") {
          try {
            const staleHosts = doc.querySelectorAll(`#${HOST_ID}, [id*="quizzy_hud"]`);
            if (staleHosts && staleHosts.length > 0) {
              for (const sh of staleHosts) {
                try {
                  if (typeof sh.remove === "function") sh.remove();
                  else if (sh.parentNode && typeof sh.parentNode.removeChild === "function") sh.parentNode.removeChild(sh);
                } catch (_) {}
              }
            }
          } catch (_) {}
        }
      }
      if (typeof window !== "undefined") {
        if (window.__QUIZZY_HUD_INSTANCE__) {
          try {
            if (typeof window.__QUIZZY_HUD_INSTANCE__.destroy === "function") {
              window.__QUIZZY_HUD_INSTANCE__.destroy();
            }
          } catch (_) {}
          try { delete window.__QUIZZY_HUD_INSTANCE__; } catch (_) { window.__QUIZZY_HUD_INSTANCE__ = null; }
        }
      }
    } catch (_) {}
  }

  // Hook SPA navigation transitions without duplicate listeners or unnecessary polling
  function setupSpaNavigationListeners() {
    if (typeof window === "undefined") return;
    if (window.__QUIZZY_SPA_LISTENERS_INITIALIZED__) return;
    window.__QUIZZY_SPA_LISTENERS_INITIALIZED__ = true;

    const onNavigation = () => {
      if (isProctoredCodingPage()) {
        destroyInPageHudIfPresent();
        setupStealthCodingKeyboardShortcuts();
      } else {
        // Hide HUD on page redirect/navigation so it only appears when user presses Ctrl
        if (typeof hide === "function") {
          hide();
        } else if (typeof setHidden === "function") {
          setHidden(true);
        }
      }
    };

    if (typeof window.addEventListener === "function") {
      window.addEventListener("popstate", onNavigation);
      window.addEventListener("hashchange", onNavigation);
    }

    if (typeof history !== "undefined") {
      if (typeof history.pushState === "function") {
        const origPush = history.pushState;
        history.pushState = function (...args) {
          const res = origPush.apply(this, args);
          try { onNavigation(); } catch (_) {}
          return res;
        };
      }
      if (typeof history.replaceState === "function") {
        const origReplace = history.replaceState;
        history.replaceState = function (...args) {
          const res = origReplace.apply(this, args);
          try { onNavigation(); } catch (_) {}
          return res;
        };
      }
    }
  }

  setupSpaNavigationListeners();

  // Stealth keyboard shortcuts: active on window with ZERO DOM footprint
  function setupStealthCodingKeyboardShortcuts() {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    if (window.__QUIZZY_KEYBOARD_INITIALIZED__) return;
    window.__QUIZZY_KEYBOARD_INITIALIZED__ = true;

    const onStealthCodingKeyDown = function (e) {
      if (!e) return;
      if (e.key === "Escape" || e.key === "Esc") {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "KILL_SWITCH_TRIGGERED", reason: "Escape hotkey" }, () => {});
        }
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const key = (e.key || "").toLowerCase();
      const code = e.code || "";

      // Specifically allow Alt+S, Alt+A, Alt+N, Alt+M even when focused inside Monaco's <textarea class="inputarea">
      if (key === "s" || code === "KeyS") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_SOLVE" }, () => {});
        }
        return;
      }
      if (key === "a" || code === "KeyA") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_APPLY" }, () => {});
        }
        return;
      }
      if (key === "n" || code === "KeyN") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_CODING_AUTO_LOOP" }, () => {});
        }
        return;
      }
      if (key === "m" || code === "KeyM") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "OPEN_POPUP_HUD", force: true }, () => {});
        }
        return;
      }
    };

    if (typeof window !== "undefined") {
      window.__QUIZZY_STEALTH_SHORTCUT_HANDLER__ = onStealthCodingKeyDown;
    }
    window.addEventListener("keydown", onStealthCodingKeyDown, { capture: true, passive: false });
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("keydown", onStealthCodingKeyDown, { capture: true, passive: false });
    }
  }

  // Strict Zero-DOM Stealth on Dedicated Coding Routes (e.g. learning.ccbp.in/question/*)
  // Aborts host/shadow DOM creation on pure coding routes.
  // Actively unmounts any leaked in-page HUD if user navigated via SPA.
  if (isProctoredCodingPage()) {
    destroyInPageHudIfPresent();
    setupStealthCodingKeyboardShortcuts();

    const codingHudInstance = {
      isCodingMode: true,
      quizzyMode: "code",
      getMode: () => "code",
      setMode: () => {},
      toggleMode: () => {},
      isMock: true,
      isProctoredCodingPage: () => true,
      isVisible: () => false,
      isHidden: () => true,
      isMinimized: () => false,
      toggle: () => {},
      show: () => {},
      hide: () => {},
      setMinimized: () => {},
      setHidden: () => {},
      solve: () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_SOLVE" }, () => {});
        }
      },
      apply: () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_APPLY" }, () => {});
        }
      },
      skip: () => {},
      next: () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_CODING_AUTO_LOOP" }, () => {});
        }
      },
      startAuto: () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "TRIGGER_CODING_AUTO_LOOP" }, () => {});
        }
      },
      stopAuto: () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "STOP_AUTO" }, () => {});
        }
      },
      destroy: () => {
        destroyInPageHudIfPresent();
      }
    };

    window.__QUIZZY_HUD_INSTANCE__ = codingHudInstance;
    if (typeof module !== "undefined" && module.exports) {
      module.exports = codingHudInstance;
    }
    return {
      success: true,
      mounted: false,
      codingMode: true,
      instance: codingHudInstance
    };
  }

  // Idempotency: Return existing instance if already initialized
  if (window.__QUIZZY_HUD_INSTANCE__) {
    const existing = window.__QUIZZY_HUD_INSTANCE__;
    return {
      success: true,
      mounted: true,
      alreadyMounted: true,
      visible: existing.isVisible(),
      instance: existing
    };
  }

  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    const fallbackInstance = {
      isMock: true,
      getMode: () => "mcq",
      toggleMode: () => {},
      isVisible: () => false,
      isHidden: () => true,
      isMinimized: () => false,
      toggle: () => {},
      show: () => {},
      hide: () => {},
      setMinimized: () => {},
      setHidden: () => {},
      destroy: () => {}
    };
    if (typeof module !== "undefined" && module.exports) {
      module.exports = fallbackInstance;
    }
    return { success: false, mounted: false, error: "document.createElement is not a function", instance: fallbackInstance };
  }

  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-quizzy-ignore", "true");
    host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; width: 0; height: 0; pointer-events: none; overflow: visible;";
    
    if (document.documentElement && typeof document.documentElement.appendChild === "function") {
      document.documentElement.appendChild(host);
    } else if (document.body && typeof document.body.appendChild === "function") {
      document.body.appendChild(host);
    }
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    try {
      if (typeof host.attachShadow === "function") {
        shadow = host.attachShadow({ mode: "open" });
      } else {
        shadow = host.shadowRoot || host;
      }
    } catch (_) {
      shadow = host.shadowRoot || host;
    }
  }

  // ==========================================================================
  // HUD Scoped Compact Rectangular & White Dot CSS Styles
  // ==========================================================================
  const HUD_STYLES = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    :host {
      all: initial;
    }

    .quizzy-hud-wrapper {
      position: fixed;
      pointer-events: auto;
      user-select: none;
      z-index: 2147483647;
      box-shadow: none;
      filter: none;
      transition: opacity 120ms ease, transform 120ms ease;
    }

    .quizzy-hud-wrapper.hidden {
      display: none !important;
    }

    /* Compact Rectangular Bar (~36px height) */
    .hud-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      min-width: 260px;
      max-width: 440px;
      padding: 4px 8px;
      background: #0B1530;
      border: 1px solid #1D356A;
      border-radius: 6px;
      color: #FFFFFF;
      cursor: grab;
      position: relative;
      box-shadow: 0 2px 8px rgba(6, 11, 25, 0.45);
    }

    .hud-bar.dragging {
      cursor: grabbing;
      box-shadow: 0 4px 14px rgba(6, 11, 25, 0.6);
    }

    /* Very Small Movable White Dot (9x9px) with Blue Border */
    .hud-mini-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 1.5px solid #1D4ED8;
      box-shadow: 0 1px 4px rgba(6, 11, 25, 0.4);
      cursor: grab;
      user-select: none;
      transition: transform 0.12s ease;
      display: block;
      position: relative;
      box-sizing: border-box;
    }

    /* Generous invisible grab zone so the tiny dot is effortless to drag & click */
    .hud-mini-dot::before {
      content: "";
      position: absolute;
      top: -9px;
      left: -9px;
      right: -9px;
      bottom: -9px;
      border-radius: 50%;
      cursor: grab;
    }

    .hud-mini-dot:hover {
      transform: scale(1.35);
    }

    .hud-mini-dot.dragging {
      cursor: grabbing;
      transform: scale(1.5);
    }

    .hud-mini-dot.auto-running {
      border-color: #60A5FA;
      box-shadow: 0 0 6px rgba(96, 165, 250, 0.85);
      animation: hud-dot-pulse 1s infinite alternate;
    }

    @keyframes hud-dot-pulse {
      0% { transform: scale(1); }
      100% { transform: scale(1.4); }
    }

    /* Left Status Dot & Mode Pill */
    .hud-grip-group {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      padding: 0 2px;
      gap: 5px;
    }

    .hud-logo-z {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 17px;
      height: 17px;
      border-radius: 4px;
      background: #2563EB;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      transition: transform 120ms ease, background 120ms ease;
      flex-shrink: 0;
    }

    .hud-logo-z:hover {
      background: #1D4ED8;
      transform: scale(1.1);
    }

    .hud-mode-pill {
      display: inline-flex;
      align-items: center;
      background: #081024;
      border: 1px solid #1D356A;
      border-radius: 9px;
      padding: 1px;
      cursor: pointer;
      user-select: none;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }

    .hud-mode-opt {
      padding: 1px 4px;
      border-radius: 7px;
      color: #93C5FD;
      transition: background 120ms ease, color 120ms ease;
    }

    .hud-mode-opt.active {
      background: #2563EB;
      color: #FFFFFF;
    }

    .hud-health-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #1E3A8A;
      box-shadow: 0 0 4px rgba(30, 58, 138, 0.5);
      transition: background 200ms;
    }

    .hud-health-dot.online {
      background: #60A5FA;
      box-shadow: 0 0 5px rgba(96, 165, 250, 0.7);
    }

    .hud-health-dot.solving {
      background: #FFFFFF;
      animation: hud-pulse 1.2s infinite ease-in-out;
    }

    @keyframes hud-pulse {
      0% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.7); }
      70% { box-shadow: 0 0 0 5px rgba(96, 165, 250, 0); }
      100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
    }

    /* Center Answer Zone */
    .hud-answer-zone {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 2px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      cursor: default;
    }

    .hud-badge-option {
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      letter-spacing: 0.3px;
      padding: 1px 5px;
      border-radius: 3px;
      background: #2563EB;
      color: #FFFFFF;
      flex-shrink: 0;
    }

    .hud-badge-option.order {
      background: #1D4ED8;
      color: #FFFFFF;
    }

    .hud-badge-option.text {
      background: #0284C7;
      color: #FFFFFF;
    }

    .hud-answer-text {
      font-size: 12.5px;
      font-weight: 500;
      color: #FFFFFF;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hud-answer-text.ready {
      color: #93C5FD;
      font-weight: 400;
    }

    .hud-answer-text.solving {
      color: #BFDBFE;
      font-weight: 500;
    }

    .hud-answer-text.complete {
      color: #FFFFFF;
      font-weight: 600;
    }

    .hud-answer-text.uncertain {
      color: #93C5FD;
    }

    .hud-pill-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }

    .hud-tag-high {
      background: rgba(37, 99, 235, 0.2);
      color: #FFFFFF;
      border: 1px solid rgba(96, 165, 250, 0.4);
    }

    .hud-tag-med {
      background: rgba(30, 58, 138, 0.3);
      color: #BFDBFE;
      border: 1px solid rgba(59, 130, 246, 0.35);
    }

    .hud-tag-cache {
      background: rgba(2, 132, 199, 0.25);
      color: #38BDF8;
      border: 1px solid rgba(56, 189, 248, 0.35);
    }

    .hud-tag-latency {
      background: rgba(255, 255, 255, 0.08);
      color: #93C5FD;
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    /* Right Action Group */
    .hud-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .hud-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 26px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      outline: none;
      transition: all 120ms ease-in-out;
      white-space: nowrap;
    }

    .hud-btn:focus-visible {
      box-shadow: 0 0 0 2px #60A5FA;
    }

    .hud-btn-primary {
      background: #2563EB;
      color: #FFFFFF;
    }

    .hud-btn-primary:hover:not(:disabled) {
      background: #1D4ED8;
    }

    .hud-btn-secondary {
      background: #0E1B38;
      color: #FFFFFF;
      border: 1px solid #1D356A;
    }

    .hud-btn-secondary:hover:not(:disabled) {
      background: #162B55;
      color: #FFFFFF;
    }

    .hud-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .hud-btn-auto {
      background: rgba(37, 99, 235, 0.2);
      color: #BFDBFE;
      border: 1px solid rgba(96, 165, 250, 0.35);
    }

    .hud-btn-auto:hover:not(:disabled) {
      background: rgba(37, 99, 235, 0.35);
      color: #FFFFFF;
    }

    .hud-btn-auto.running {
      background: #2563EB !important;
      color: #FFFFFF !important;
      border: none !important;
      box-shadow: 0 0 8px rgba(37, 99, 235, 0.7) !important;
      animation: hud-auto-pulse 1s infinite alternate;
    }

    @keyframes hud-auto-pulse {
      0% { opacity: 0.85; }
      100% { opacity: 1; }
    }

    .hud-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: transparent;
      border: none;
      color: #93C5FD;
      cursor: pointer;
      transition: background 120ms, color 120ms;
    }

    .hud-icon-btn:hover {
      background: #162B55;
      color: #FFFFFF;
    }

    /* More Popover Drawer */
    .hud-popover {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #0B1530;
      border: 1px solid #1D356A;
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 4px;
      box-shadow: 0 6px 16px rgba(6, 11, 25, 0.5);
      animation: hud-fade-in 120ms ease-out;
    }

    @keyframes hud-fade-in {
      from { opacity: 0; transform: translateY(-3px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hud-popover.hidden {
      display: none !important;
    }

    .hud-popover-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .hud-reason-text {
      font-size: 11.5px;
      color: #BFDBFE;
      line-height: 1.35;
      max-height: 48px;
      overflow-y: auto;
    }

    .hud-checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #93C5FD;
      cursor: pointer;
    }

    .hud-checkbox-label input {
      accent-color: #2563EB;
      cursor: pointer;
    }

    .hud-btn-flag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 24px;
      padding: 0 8px;
      border-radius: 4px;
      background: rgba(30, 58, 138, 0.3);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #BFDBFE;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    }

    .hud-btn-flag:hover {
      background: rgba(30, 58, 138, 0.5);
    }

    .hud-btn-flag.flagged {
      background: #2563EB;
      border-color: #60A5FA;
      color: #FFFFFF;
    }

    .hud-btn-skip-manual {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 24px;
      padding: 0 8px;
      border-radius: 4px;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(96, 165, 250, 0.3);
      color: #BFDBFE;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    }

    .hud-btn-skip-manual:hover {
      background: rgba(37, 99, 235, 0.25);
    }

    .hud-svg {
      width: 13px;
      height: 13px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .hidden {
      display: none !important;
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = HUD_STYLES;
  shadow.appendChild(styleEl);

  // ==========================================================================
  // HUD HTML Layout
  // ==========================================================================
  const wrapper = document.createElement("div");
  wrapper.className = "quizzy-hud-wrapper";
  wrapper.innerHTML = `
    <!-- Very Small Movable White Dot (9x9px) with Dark Border -->
    <div class="hud-mini-dot hidden" id="hud-mini-dot" title="Double-click or double-tap Z to expand QuizZy"></div>

    <!-- Main Compact Rectangular Bar (~36px height) -->
    <div class="hud-bar" id="hud-full-bar" title="Drag to move bar">
      <!-- Left Status & Mode Switcher -->
      <div class="hud-grip-group">
        <span class="hud-health-dot" id="hud-health-dot" title="Backend: Offline"></span>
        <span class="hud-logo-z" id="hud-logo-z" title="Double-click 'Z' to convert to dot">Z</span>
        <div class="hud-mode-pill" id="hud-mode-pill" title="Toggle Mode (Alt+M)">
          <span class="hud-mode-opt active" id="hud-mode-mcq">MCQ</span>
          <span class="hud-mode-opt" id="hud-mode-code">CODE</span>
        </div>
      </div>

      <!-- Center Answer Zone -->
      <div class="hud-answer-zone" id="hud-answer-zone">
        <span class="hud-badge-option hidden" id="hud-badge-opt">[A]</span>
        <span class="hud-answer-text ready" id="hud-answer-text" title="Ready">Ready — Click Solve (Alt+S)</span>
        <span class="hud-pill-tag hud-tag-high hidden" id="hud-tag-conf">HIGH</span>
        <span class="hud-pill-tag hud-tag-cache hidden" id="hud-tag-cache">CACHE</span>
        <span class="hud-pill-tag hud-tag-latency hidden" id="hud-tag-latency">0ms</span>
      </div>

      <!-- Right Action Group -->
      <div class="hud-actions">
        <!-- Solve (Primary) -->
        <button class="hud-btn hud-btn-primary" id="hud-btn-solve" title="Extract & Solve Question (Alt+S)">
          <svg class="hud-svg" viewBox="0 0 24 24">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"></polygon>
          </svg>
          <span>Solve</span>
        </button>

        <!-- Apply (Secondary) -->
        <button class="hud-btn hud-btn-secondary" id="hud-btn-apply" title="Apply Winning Answer Once (Alt+A)" disabled>
          <svg class="hud-svg" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Apply</span>
        </button>

        <!-- Next / Submit Button -->
        <button class="hud-btn hud-btn-secondary" id="hud-btn-next" title="Submit & Click Next Question (Alt+N)">
          <svg class="hud-svg" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>Next</span>
        </button>

        <!-- Auto Mode (Toggle) -->
        <button class="hud-btn hud-btn-auto" id="hud-btn-auto" title="Auto Mode (Double-tap Fn or Shift)">
          <svg class="hud-svg" id="hud-auto-icon" viewBox="0 0 24 24">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
          </svg>
          <span id="hud-auto-label">Auto</span>
        </button>

        <!-- More Drawer Toggle (⋯) -->
        <button class="hud-icon-btn" id="hud-btn-more" title="More Options & Reasoning">
          <svg class="hud-svg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
            <circle cx="19" cy="12" r="1.5" fill="currentColor"></circle>
            <circle cx="5" cy="12" r="1.5" fill="currentColor"></circle>
          </svg>
        </button>

        <!-- Minimize to Dot (—) -->
        <button class="hud-icon-btn" id="hud-btn-min" title="Shrink to Dot (Double-tap Z)">
          <svg class="hud-svg" viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- More Popover Drawer (Reasoning, Flag Wrong, Strict Toggle) -->
    <div class="hud-popover hidden" id="hud-popover">
      <div class="hud-popover-row">
        <div class="hud-reason-text" id="hud-reason-text">No reasoning available yet. Click Solve to get explanations.</div>
        <div style="display: flex; gap: 6px; flex-shrink: 0;">
          <button class="hud-btn-skip-manual" id="hud-btn-skip" title="Skip this question immediately (Alt+K)">
            <svg class="hud-svg" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"></polygon>
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line>
            </svg>
            <span>Skip</span>
          </button>
          <button class="hud-btn-flag" id="hud-btn-flag" title="Flag as wrong and evict from cache">
            <svg class="hud-svg" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <span>Flag Wrong</span>
          </button>
        </div>
      </div>
      <div class="hud-popover-row" style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 6px;">
        <label class="hud-checkbox-label">
          <input type="checkbox" id="hud-chk-strict">
          <span>Strict Mode: Pause on Tie-Breaker (Require Primary Agreement Only)</span>
        </label>
      </div>
    </div>
  `;

  shadow.appendChild(wrapper);

  // ==========================================================================
  // DOM References
  // ==========================================================================
  const getShadowEl = (id) => (shadow.getElementById ? shadow.getElementById(id) : shadow.querySelector("#" + id));
  const fullBar = getShadowEl("hud-full-bar") || getShadowEl("hud-bar");
  const miniDot = getShadowEl("hud-mini-dot") || getShadowEl("hud-min-pill");
  const healthDot = getShadowEl("hud-health-dot");
  const badgeOpt = getShadowEl("hud-badge-opt");
  const answerText = getShadowEl("hud-answer-text");
  const tagConf = getShadowEl("hud-tag-conf");
  const tagCache = getShadowEl("hud-tag-cache");
  const tagLatency = getShadowEl("hud-tag-latency");
  const btnSolve = getShadowEl("hud-btn-solve");
  const btnApply = getShadowEl("hud-btn-apply");
  const btnNext = getShadowEl("hud-btn-next");
  const btnAuto = getShadowEl("hud-btn-auto");
  const autoIcon = getShadowEl("hud-auto-icon");
  const autoLabel = getShadowEl("hud-auto-label");
  const btnMore = getShadowEl("hud-btn-more");
  const btnMin = getShadowEl("hud-btn-min");
  const popover = getShadowEl("hud-popover");
  const reasonText = getShadowEl("hud-reason-text");
  const btnFlag = getShadowEl("hud-btn-flag");
  const btnSkip = getShadowEl("hud-btn-skip");
  const chkStrict = getShadowEl("hud-chk-strict");
  const modePill = getShadowEl("hud-mode-pill");
  const modeMcq = getShadowEl("hud-mode-mcq");
  const modeCode = getShadowEl("hud-mode-code");
  const logoZ = getShadowEl("hud-logo-z");

  // ==========================================================================
  // Internal State
  // ==========================================================================
  let isVisibleState = true;
  let isHiddenState = false;
  let isMinimizedState = false;
  let isSolving = false;
  let isAutoRunning = false;
  let autoStepCount = 0;
  let autoRetryCount = 0;
  let latestSolution = null;
  let latestExtracted = null;
  let isSidePanelOpen = false;

  // Query background for side panel presence on startup (mutual exclusivity)
  sendExtensionMessage({ action: "GET_SIDEPANEL_STATE" }, (res) => {
    if (res && res.isOpen) {
      isSidePanelOpen = true;
      hide();
    }
  });

  function autoDetectMode() {
    try {
      const loc = (typeof window !== "undefined") ? window.location : null;
      const pathname = (loc && loc.pathname) ? loc.pathname : "";
      if (/\/question\/[a-z0-9-]+/i.test(pathname)) {
        return "code";
      }
      const doc = (typeof document !== "undefined") ? document : null;
      if (doc) {
        const headerText = (doc.body ? (doc.body.innerText || doc.body.textContent || "") : "").slice(0, 1500).toLowerCase();
        const hasCodingPractice = /coding\s*practice/i.test(headerText);
        const buttons = doc.querySelectorAll ? Array.from(doc.querySelectorAll("button, input[type='button'], [role='button']")) : [];
        const btnTexts = buttons.map(b => (b.innerText || b.textContent || "").trim().toLowerCase());
        const hasCompileAndRun = btnTexts.some(t => /compile\s*&\s*run|run\s*code/i.test(t));
        const hasMcq = hasQuizOptionsOutsideEditor(doc);
        if ((hasCodingPractice || hasCompileAndRun) && !hasMcq) {
          return "code";
        }
      }
    } catch (_) {}
    return "mcq";
  }

  let quizzyMode = autoDetectMode();

  function updateModePillUi() {
    if (modeMcq && modeCode) {
      if (quizzyMode === "code") {
        modeMcq.classList.remove("active");
        modeCode.classList.add("active");
      } else {
        modeCode.classList.remove("active");
        modeMcq.classList.add("active");
      }
    }
  }

  function setMode(newMode) {
    quizzyMode = (newMode === "code") ? "code" : "mcq";
    updateModePillUi();
  }

  function toggleMode() {
    setMode(quizzyMode === "mcq" ? "code" : "mcq");
  }

  if (modePill) {
    modePill.addEventListener("click", () => toggleMode());
  }
  updateModePillUi();

  const storage = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : {
        get: (keys, cb) => { if (cb) cb({}); },
        set: (data, cb) => { if (cb) cb(); }
      };

  // Restore strict agreement preference (default: false)
  storage.get(["quizzy_strict_agreement"], (res) => {
    if (chkStrict && res.quizzy_strict_agreement !== undefined) {
      chkStrict.checked = Boolean(res.quizzy_strict_agreement);
    } else if (chkStrict) {
      chkStrict.checked = false;
    }
  });

  if (chkStrict) {
    chkStrict.addEventListener("change", () => {
      storage.set({ quizzy_strict_agreement: chkStrict.checked });
    });
  }

  // Restore position or set default
  function applyBarPosition(pos) {
    const margin = 16;
    let x = (pos && typeof pos.left === "number") ? pos.left : (window.innerWidth - 420);
    let y = (pos && typeof pos.top === "number") ? pos.top : (window.innerHeight - 60);

    const barW = fullBar ? (fullBar.offsetWidth || 340) : 340;
    const barH = fullBar ? (fullBar.offsetHeight || 36) : 36;
    const maxX = Math.max(0, window.innerWidth - barW - 8);
    const maxY = Math.max(0, window.innerHeight - barH - 8);

    x = Math.max(margin, Math.min(x, maxX));
    y = Math.max(margin, Math.min(y, maxY));

    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
  }

  function applyDotPosition(pos) {
    let x = (pos && typeof pos.left === "number") ? pos.left : (window.innerWidth - 20);
    let y = (pos && typeof pos.top === "number") ? pos.top : (window.innerHeight - 20);

    const maxX = Math.max(0, window.innerWidth - 14);
    const maxY = Math.max(0, window.innerHeight - 14);

    x = Math.max(6, Math.min(x, maxX));
    y = Math.max(6, Math.min(y, maxY));

    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
  }

  // Apply default position immediately so wrapper is not rendered without coordinates
  applyBarPosition(null);

  storage.get(["quizzy_hud_pos", "quizzy_dot_pos", "quizzy_hud_minimized", "quizzy_hud_hidden"], (res) => {
    if (res && res.quizzy_hud_hidden) {
      setHidden(true);
    }
    if (res && res.quizzy_hud_minimized) {
      setMinimized(true);
    } else if (res && res.quizzy_hud_pos) {
      applyBarPosition(res.quizzy_hud_pos);
    }
  });

  // ==========================================================================
  // Dragging Implementation for Bar & White Dot
  // ==========================================================================
  let isBarDragging = false;
  let isDotDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dotDragDistance = 0;

  function onBarDragStart(e) {
    const target = e.target;
    if (target && target.closest && target.closest("button, input, label, a, .hud-btn-flag, .hud-popover")) {
      return;
    }

    isBarDragging = true;
    if (fullBar) fullBar.classList.add("dragging");

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartX = clientX;
    dragStartY = clientY;

    const rect = wrapper.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    window.addEventListener("mousemove", onBarDragMove, { passive: true });
    window.addEventListener("mouseup", onBarDragEnd);
    window.addEventListener("touchmove", onBarDragMove, { passive: true });
    window.addEventListener("touchend", onBarDragEnd);
  }

  function onBarDragMove(e) {
    if (!isBarDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    const w = wrapper.offsetWidth || 340;
    const h = wrapper.offsetHeight || 36;
    newLeft = Math.max(8, Math.min(newLeft, window.innerWidth - w - 8));
    newTop = Math.max(8, Math.min(newTop, window.innerHeight - h - 8));

    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
  }

  function onBarDragEnd() {
    if (!isBarDragging) return;
    isBarDragging = false;
    if (fullBar) fullBar.classList.remove("dragging");

    window.removeEventListener("mousemove", onBarDragMove);
    window.removeEventListener("mouseup", onBarDragEnd);
    window.removeEventListener("touchmove", onBarDragMove);
    window.removeEventListener("touchend", onBarDragEnd);

    const rect = wrapper.getBoundingClientRect();
    storage.set({ quizzy_hud_pos: { left: rect.left, top: rect.top } });
  }

  function onDotDragStart(e) {
    isDotDragging = true;
    dotDragDistance = 0;
    if (miniDot) miniDot.classList.add("dragging");

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartX = clientX;
    dragStartY = clientY;

    const rect = wrapper.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    window.addEventListener("mousemove", onDotDragMove, { passive: true });
    window.addEventListener("mouseup", onDotDragEnd);
    window.addEventListener("touchmove", onDotDragMove, { passive: true });
    window.addEventListener("touchend", onDotDragEnd);
  }

  function onDotDragMove(e) {
    if (!isDotDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    dotDragDistance = Math.hypot(dx, dy);

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    newLeft = Math.max(6, Math.min(newLeft, window.innerWidth - 14));
    newTop = Math.max(6, Math.min(newTop, window.innerHeight - 14));

    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
  }

  function onDotDragEnd() {
    if (!isDotDragging) return;
    isDotDragging = false;
    if (miniDot) miniDot.classList.remove("dragging");

    window.removeEventListener("mousemove", onDotDragMove);
    window.removeEventListener("mouseup", onDotDragEnd);
    window.removeEventListener("touchmove", onDotDragMove);
    window.removeEventListener("touchend", onDotDragEnd);

    if (dotDragDistance >= 5) {
      const rect = wrapper.getBoundingClientRect();
      storage.set({ quizzy_dot_pos: { left: rect.left, top: rect.top } });
    }
  }

  if (fullBar) {
    fullBar.addEventListener("mousedown", onBarDragStart);
    fullBar.addEventListener("touchstart", onBarDragStart, { passive: false });
  }

  if (miniDot) {
    miniDot.addEventListener("mousedown", onDotDragStart);
    miniDot.addEventListener("touchstart", onDotDragStart, { passive: false });
    miniDot.addEventListener("dblclick", (e) => {
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      setMinimized(false);
    });
    miniDot.addEventListener("click", (e) => {
      if (dotDragDistance < 5) {
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        setMinimized(false);
      }
    });
  }

  // ==========================================================================
  // Communication Helpers
  // ==========================================================================
  function sendExtensionMessage(message, callback) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(message, (res) => {
          if (chrome.runtime.lastError) {
            if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (callback) callback(res || { success: false });
        });
        return;
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
        return;
      }
    }
    if (callback) callback({ success: false, error: "chrome.runtime unavailable" });
  }

  // ==========================================================================
  // Health Polling (Backend Status)
  // ==========================================================================
  function checkHealth() {
    sendExtensionMessage({ action: "CHECK_HEALTH" }, (res) => {
      const isOnline = res && res.success && res.data;
      if (isOnline) {
        if (healthDot && !isSolving) {
          healthDot.className = "hud-health-dot online";
          healthDot.title = `Backend Connected (Cache: ${res.data.cache_entries || 0})`;
        }
      } else {
        if (healthDot && !isSolving) {
          healthDot.className = "hud-health-dot";
          healthDot.title = "Backend Offline";
        }
      }
    });
  }

  checkHealth();
  const healthInterval = setInterval(checkHealth, 7000);
  if (healthInterval && typeof healthInterval.unref === "function") {
    healthInterval.unref();
  }

  // ==========================================================================
  // Question Signature for Stuck-Detection
  // ==========================================================================
  function getQuestionSig(ext) {
    if (!ext) return "";
    const q = (ext.question || "").trim();
    const opts = Array.isArray(ext.options) ? ext.options.join("|") : "";
    return `${q}::${opts}`;
  }

  // ==========================================================================
  // Display & State Renderers
  // ==========================================================================
  function resetSolutionDisplay() {
    latestSolution = null;
    latestExtracted = null;
    if (badgeOpt) {
      badgeOpt.className = "hud-badge-option hidden";
      badgeOpt.textContent = "";
    }
    if (answerText) {
      answerText.className = "hud-answer-text";
      answerText.textContent = "Ready to solve";
      answerText.title = "Ready to solve";
    }
    if (tagConf) tagConf.classList.add("hidden");
    if (tagCache) tagCache.classList.add("hidden");
    if (tagLatency) tagLatency.classList.add("hidden");
    if (btnApply) btnApply.disabled = true;
    if (reasonText) {
      reasonText.textContent = "Click Solve to evaluate question with dual models.";
    }
  }

  function setSolvingState() {
    isSolving = true;
    if (healthDot) healthDot.className = "hud-health-dot solving";
    if (badgeOpt) badgeOpt.classList.add("hidden");
    if (answerText) {
      answerText.className = "hud-answer-text solving";
      answerText.textContent = "Solving question with dual models...";
    }
    if (tagConf) tagConf.classList.add("hidden");
    if (tagCache) tagCache.classList.add("hidden");
    if (tagLatency) tagLatency.classList.add("hidden");
    if (btnApply) btnApply.disabled = true;
  }

  function renderSolution(solution, extracted) {
    isSolving = false;
    latestSolution = solution;
    latestExtracted = extracted;
    checkHealth();

    const hasCandidate = solution && (
      (typeof solution.selected_index === "number" && solution.selected_index >= 0) ||
      (Array.isArray(solution.selected_indices) && solution.selected_indices.length > 0) ||
      (typeof solution.answer === "string" && solution.answer.trim().length > 0) ||
      (typeof solution.canonical_key === "string" && solution.canonical_key.trim().length > 0) ||
      (Array.isArray(solution.canonical_keys) && solution.canonical_keys.length > 0) ||
      (typeof solution.letter === "string" && solution.letter.trim().length > 0) ||
      (typeof solution.selected_text === "string" && solution.selected_text.trim().length > 0)
    );

    if (!hasCandidate) {
      if (badgeOpt) badgeOpt.classList.add("hidden");
      if (answerText) {
        answerText.className = "hud-answer-text uncertain";
        answerText.textContent = solution && solution.error ? solution.error : "Model consensus uncertain";
        answerText.title = answerText.textContent;
      }
      if (tagConf) tagConf.classList.add("hidden");
      if (tagCache) tagCache.classList.add("hidden");
      if (tagLatency) tagLatency.classList.add("hidden");
      if (btnApply) btnApply.disabled = true;
      if (reasonText) {
        reasonText.textContent = (solution && solution.reason) || "No consensus reached between models.";
      }
      return;
    }

    const qType = (solution.q_type || (extracted && extracted.q_type) || "mcq").toLowerCase();

    // 1. Badge Display
    if (badgeOpt) {
      badgeOpt.className = "hud-badge-option";
      if (qType === "order") {
        badgeOpt.classList.add("order");
        badgeOpt.textContent = "ORD";
      } else if (qType === "text") {
        badgeOpt.classList.add("text");
        badgeOpt.textContent = "TXT";
      } else if (qType === "multi") {
        badgeOpt.classList.add("multi");
        const keys = (solution.canonical_keys && solution.canonical_keys.length)
          ? solution.canonical_keys
          : (solution.canonical_key ? solution.canonical_key.split(/[\s,]+/).filter(Boolean) : []);
        badgeOpt.textContent = keys.length ? `[${keys.join(", ")}]` : "[MULTI]";
      } else {
        const letter = solution.canonical_key || solution.letter ||
          (typeof solution.selected_index === "number" ? String.fromCharCode(65 + solution.selected_index) : "A");
        badgeOpt.textContent = `[${letter}]`;
      }
      badgeOpt.classList.remove("hidden");
    }

    // 2. Answer Text Display
    if (answerText) {
      answerText.className = "hud-answer-text";
      let displayText = "";
      if (qType === "order") {
        displayText = (solution.ordered_texts && solution.ordered_texts.length)
          ? solution.ordered_texts.join(" ➔ ")
          : (solution.answer || "Ordered sequence ready");
      } else if (qType === "multi") {
        if (solution.selected_texts && solution.selected_texts.length) {
          displayText = solution.selected_texts.join(" | ");
        } else {
          displayText = solution.selected_text || solution.selected_option || solution.answer || "Multiple options ready";
        }
      } else {
        displayText = solution.selected_text || solution.selected_option || solution.answer || "Answer ready";
      }
      answerText.textContent = displayText;
      answerText.title = displayText;
    }

    // 3. Confidence Tag
    if (tagConf) {
      const tier = (solution.confidence_tier || "").toUpperCase();
      const label = (solution.confidence_label || "").toLowerCase();
      if (tier.includes("HIGH") || label === "high" || solution.agreement_status === "both_agree") {
        tagConf.className = "hud-pill-tag hud-tag-high";
        tagConf.textContent = "HIGH";
        tagConf.classList.remove("hidden");
      } else if (tier.includes("MEDIUM") || label === "medium" || solution.agreement_status === "tiebreaker_agree") {
        tagConf.className = "hud-pill-tag hud-tag-med";
        tagConf.textContent = "MED";
        tagConf.classList.remove("hidden");
      } else {
        tagConf.classList.add("hidden");
      }
    }

    // 4. Cache & Latency Tags
    if (tagCache) {
      if (solution.cache_hit) {
        tagCache.classList.remove("hidden");
      } else {
        tagCache.classList.add("hidden");
      }
    }

    if (tagLatency && typeof solution.latency_ms === "number") {
      tagLatency.textContent = `${Math.round(solution.latency_ms)}ms`;
      tagLatency.classList.remove("hidden");
    }

    // 5. Enable Apply Button
    if (btnApply) {
      btnApply.disabled = false;
    }

    // 6. Update Drawer Reasoning
    if (reasonText) {
      reasonText.textContent = solution.reason || "Derivation verified step-by-step.";
    }
  }

  // ==========================================================================
  // Core Extraction, Solve & Execution Routines
  // ==========================================================================
  function extractCurrentQuiz() {
    if (window.__QuizZyExtractor && typeof window.__QuizZyExtractor.extractQuizFromDom === "function") {
      try {
        return window.__QuizZyExtractor.extractQuizFromDom(document);
      } catch (err) {
        console.error("[QuizZy HUD] Extraction error:", err);
      }
    }
    return null;
  }

  function solveCurrentQuestion(callback) {
    if (isSolving) return;
    const extracted = extractCurrentQuiz();

    if (!extracted || !extracted.success) {
      if (answerText) {
        answerText.className = "hud-answer-text uncertain";
        answerText.textContent = "No quiz question found on page";
      }
      if (callback) callback(null, extracted);
      return;
    }

    setSolvingState();

    const payload = {
      subject: extracted.subject || "General",
      q_type: extracted.q_type || "mcq",
      question: extracted.question,
      options: extracted.options || [],
      language: (extracted && extracted.language) ? extracted.language : null,
      starter_code: (extracted && extracted.starter_code) ? extracted.starter_code : null
    };

    let solveTimedOut = false;
    const solveTimer = setTimeout(() => {
      if (!isSolving) return;
      solveTimedOut = true;
      isSolving = false;
      checkHealth();
      if (answerText) {
        answerText.className = "hud-answer-text uncertain";
        answerText.textContent = "Question solve timed out (>5s)";
      }
      if (callback) callback({ error: "Question solve timed out (>5s)" }, extracted);
    }, 5000);

    sendExtensionMessage({ action: "SOLVE_REQUEST", payload }, (res) => {
      if (solveTimedOut) return;
      clearTimeout(solveTimer);

      if (!res || !res.success || !res.data) {
        isSolving = false;
        checkHealth();
        if (answerText) {
          answerText.className = "hud-answer-text uncertain";
          answerText.textContent = res && res.error ? res.error : "Backend solve error";
        }
        if (callback) callback(null, extracted);
        return;
      }

      renderSolution(res.data, extracted);
      if (callback) callback(res.data, extracted);
    });
  }

  function buildExecuteActionPayload(solveData, extracted) {
    if (!solveData) return null;
    const qType = (solveData.q_type || (extracted && extracted.q_type) || "mcq").toLowerCase();
    const options = (extracted && Array.isArray(extracted.options)) ? extracted.options : [];

    // Resolve targetIndex (0-based integer)
    let targetIndex = null;
    if (typeof solveData.selected_index === "number" && solveData.selected_index >= 0 && (options.length === 0 || solveData.selected_index < options.length)) {
      targetIndex = solveData.selected_index;
    } else if (typeof solveData.canonical_key === "string" && /^[A-F]$/i.test(solveData.canonical_key.trim())) {
      targetIndex = solveData.canonical_key.trim().toUpperCase().charCodeAt(0) - 65;
    } else if (typeof solveData.answer === "string" && /^[A-F]$/i.test(solveData.answer.trim())) {
      targetIndex = solveData.answer.trim().toUpperCase().charCodeAt(0) - 65;
    } else if (typeof solveData.letter === "string" && /^[A-F]$/i.test(solveData.letter.trim())) {
      targetIndex = solveData.letter.trim().toUpperCase().charCodeAt(0) - 65;
    } else if (options.length > 0) {
      const matchText = solveData.selected_text || solveData.selected_option || solveData.answer;
      if (matchText) {
        const cleanMatch = String(matchText).trim().toLowerCase();
        const foundIdx = options.findIndex(opt => opt && String(opt).trim().toLowerCase() === cleanMatch);
        if (foundIdx !== -1) {
          targetIndex = foundIdx;
        }
      }
    }

    // Resolve targetText
    let targetText = "";
    if (targetIndex !== null && targetIndex >= 0 && targetIndex < options.length) {
      targetText = options[targetIndex];
    } else {
      targetText = solveData.selected_text || solveData.selected_option || solveData.answer || "";
    }

    const letter = (targetIndex !== null && targetIndex >= 0) ? String.fromCharCode(65 + targetIndex) : "";

    return {
      question_type: qType,
      q_type: qType,
      targetIndex,
      selected_index: targetIndex,
      targetText,
      selected_text: targetText,
      answer: (qType === "mcq" && targetText) ? targetText : solveData.answer,
      letter,
      ordered_indices: solveData.ordered_indices,
      ordered_texts: solveData.ordered_texts,
      target_permutation: solveData.ordered_indices,
      permutation_indices: solveData.permutation_indices,
      selected_indices: solveData.selected_indices,
      selected_texts: solveData.selected_texts,
      canonical_keys: solveData.canonical_keys,
      canonical_key: solveData.canonical_key,
      options: (extracted && Array.isArray(extracted.options)) ? extracted.options : [],
      optionSelectors: (extracted && Array.isArray(extracted.optionSelectors)) ? extracted.optionSelectors : [],
      dragHandleSelectors: (extracted && Array.isArray(extracted.dragHandleSelectors)) ? extracted.dragHandleSelectors : []
    };
  }

  function applyCurrentSolution(callback) {
    if (!latestSolution || latestSolution.status !== "ok") {
      if (callback) callback({ success: false, reason: "No valid solution to apply" });
      return;
    }

    const actionPayload = buildExecuteActionPayload(latestSolution, latestExtracted);
    if (!actionPayload) {
      if (callback) callback({ success: false, reason: "Could not build action payload" });
      return;
    }

    const exec = window.__QuizZyExecutor || window.QuizZyExecutor;
    if (exec && (typeof exec.executeQuizAction === "function" || typeof exec.executeAction === "function")) {
      try {
        const fn = exec.executeQuizAction || exec.executeAction;
        const res = fn.call(exec, actionPayload);
        if (res && typeof res.then === "function") {
          res.then((asyncRes) => {
            if (callback) callback(asyncRes);
          }).catch((err) => {
            console.error("[QuizZy HUD] Async executor call error:", err);
            if (callback) callback({ success: false, ok: false, selected: false, error: String(err) });
          });
          return;
        }
        if (callback) callback(res);
        return;
      } catch (err) {
        console.error("[QuizZy HUD] Direct executor call failed:", err);
      }
    }

    sendExtensionMessage({ action: "EXECUTE_ACTION", payload: actionPayload }, (res) => {
      if (callback) callback(res);
    });
  }

  function clickNextOnPage(callback) {
    const exec = window.__QuizZyExecutor || window.QuizZyExecutor;
    if (exec && typeof exec.clickNextButton === "function") {
      exec.clickNextButton().then((res) => {
        if (callback) callback(res);
      }).catch((err) => {
        if (callback) callback({ ok: false, error: err.message });
      });
      return;
    }

    sendExtensionMessage({ action: "CLICK_NEXT_BUTTON" }, (res) => {
      if (callback) callback(res && res.result ? res.result : res);
    });
  }

  function clickSkipOnPage(callback) {
    const exec = window.__QuizZyExecutor || window.QuizZyExecutor;
    if (exec && typeof exec.clickSkipButton === "function") {
      exec.clickSkipButton().then((res) => {
        if (callback) callback(res);
      }).catch((err) => {
        if (callback) callback({ ok: false, error: err.message });
      });
      return;
    }

    sendExtensionMessage({ action: "CLICK_SKIP_BUTTON" }, (res) => {
      if (callback) callback(res && res.result ? res.result : res);
    });
  }

  function skipCurrentQuestion(reason, callback) {
    const msg = reason || "Question timed out (>5s). Skipped.";
    if (answerText) {
      answerText.className = "hud-answer-text uncertain";
      answerText.textContent = msg;
      answerText.title = msg;
    }
    clickSkipOnPage((res) => {
      if (callback) callback(res);
    });
  }

  // ==========================================================================
  // Self-Sufficient Auto Mode
  // ==========================================================================
  let autoStepWatchdog = null;
  let autoStepEpoch = 0;

  function updateAutoButtonState(running) {
    if (!btnAuto) return;
    if (running) {
      btnAuto.className = "hud-btn hud-btn-auto running";
      if (autoLabel) autoLabel.textContent = "Stop";
      if (autoIcon) {
        autoIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" fill="currentColor"></rect>';
      }
      if (miniDot) miniDot.classList.add("auto-running");
    } else {
      btnAuto.className = "hud-btn hud-btn-auto";
      if (autoLabel) autoLabel.textContent = "Auto";
      if (autoIcon) {
        autoIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>';
      }
      if (miniDot) miniDot.classList.remove("auto-running");
    }
  }

  function startAutoMode() {
    isAutoRunning = true;
    autoStepCount = 0;
    autoRetryCount = 0;
    autoStepEpoch = 0;
    updateAutoButtonState(true);

    // Auto-allowlist current host
    const currentHost = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : "";
    if (currentHost && storage && storage.get) {
      storage.get(["allowedHosts"], (data) => {
        const list = data.allowedHosts || [];
        if (!list.includes(currentHost)) {
          list.push(currentHost);
          storage.set({ allowedHosts: list });
        }
      });
    }

    runAutoStep();
  }

  function stopAutoMode(message) {
    isAutoRunning = false;
    autoRetryCount = 0;
    if (autoStepWatchdog) {
      clearTimeout(autoStepWatchdog);
      autoStepWatchdog = null;
    }
    autoStepEpoch++;
    updateAutoButtonState(false);
    if (message && answerText) {
      if (message.includes("Completed")) {
        answerText.className = "hud-answer-text complete";
      } else {
        answerText.className = "hud-answer-text ready";
      }
      answerText.textContent = message;
      answerText.title = message;
    }
  }

  function runAutoStep() {
    if (!isAutoRunning) return;

    if (autoStepCount >= 1000) {
      stopAutoMode("Auto Mode reached step limit.");
      return;
    }
    autoStepCount++;

    if (autoStepWatchdog) {
      clearTimeout(autoStepWatchdog);
      autoStepWatchdog = null;
    }

    const currentEpoch = ++autoStepEpoch;
    let stepSettled = false;

    // Strict 5-Second Watchdog:
    // If a question takes longer than five seconds, skip it and advance!
    autoStepWatchdog = setTimeout(() => {
      if (stepSettled || !isAutoRunning || currentEpoch !== autoStepEpoch) return;
      stepSettled = true;
      console.warn(`[QuizZy HUD] Question #${autoStepCount} timed out (>5s). Automatically skipping question.`);

      skipCurrentQuestion("Question timed out (>5s). Skipping...", (skipRes) => {
        if (!isAutoRunning || currentEpoch !== autoStepEpoch) return;
        setTimeout(() => {
          if (!isAutoRunning || currentEpoch !== autoStepEpoch) return;
          resetSolutionDisplay();
          runAutoStep();
        }, 300);
      });
    }, 5000);

    solveCurrentQuestion((solution, extracted) => {
      if (stepSettled || !isAutoRunning || currentEpoch !== autoStepEpoch) return;

      // Content Protection Gate: Advance past pure coding question in quiz auto loop to keep running
      const isPureCoding = (solution && solution.q_type === "code") || (extracted && extracted.q_type === "code");
      const hasOptions = extracted && Array.isArray(extracted.options) && extracted.options.length >= 2;
      if (isPureCoding && !hasOptions) {
        stepSettled = true;
        clearTimeout(autoStepWatchdog);
        console.warn("[QuizZy HUD] Coding question detected. Advancing to keep auto mode running.");
        skipCurrentQuestion("Coding question detected. Advancing...", () => {
          setTimeout(() => {
            if (!isAutoRunning) return;
            resetSolutionDisplay();
            runAutoStep();
          }, 400);
        });
        return;
      }

      const isStrict = chkStrict && chkStrict.checked;
      const hasValidSelection = solution && (
        (typeof solution.selected_index === "number" && solution.selected_index >= 0) ||
        (solution.answer && typeof solution.answer === "string" && solution.answer.trim().length > 0) ||
        (solution.canonical_key && typeof solution.canonical_key === "string" && solution.canonical_key.trim().length > 0) ||
        (solution.selected_text && typeof solution.selected_text === "string" && solution.selected_text.trim().length > 0)
      );

      if (!hasValidSelection) {
        // If question cannot be parsed or solved yet, keep polling until valid
        // or advance after retries to keep running despite errors!
        if (!stepSettled && isAutoRunning && currentEpoch === autoStepEpoch) {
          if (autoRetryCount < 8) {
            autoRetryCount++;
            setTimeout(runAutoStep, 350);
            return;
          }
          stepSettled = true;
          clearTimeout(autoStepWatchdog);
          autoRetryCount = 0;
          skipCurrentQuestion("Cannot solve question. Advancing to next question...", () => {
            setTimeout(() => {
              if (!isAutoRunning) return;
              resetSolutionDisplay();
              runAutoStep();
            }, 400);
          });
          return;
        }
        return;
      }

      autoRetryCount = 0;

      // Check strict HIGH agreement constraint
      if (isStrict) {
        const isHigh = solution.confidence_label === "high" ||
          solution.agreement_status === "both_agree" ||
          (solution.confidence_tier && solution.confidence_tier.includes("HIGH"));
        if (!isHigh) {
          stepSettled = true;
          clearTimeout(autoStepWatchdog);
          console.warn("[QuizZy HUD] Model consensus uncertain in strict mode. Advancing to keep running.");
          skipCurrentQuestion("Consensus uncertain (strict mode). Advancing...", () => {
            setTimeout(() => {
              if (!isAutoRunning) return;
              resetSolutionDisplay();
              runAutoStep();
            }, 400);
          });
          return;
        }
      }

      const prevSig = getQuestionSig(extracted);

      // Apply answer
      applyCurrentSolution((applyRes) => {
        if (stepSettled || !isAutoRunning || currentEpoch !== autoStepEpoch) return;

        // Resilient Selection Error Handling: retry, then advance instead of stopping!
        if (!applyRes || applyRes.ok === false || applyRes.selected === false || !applyRes.success) {
          if (autoRetryCount < 3) {
            autoRetryCount++;
            setTimeout(runAutoStep, 250);
            return;
          }
          stepSettled = true;
          clearTimeout(autoStepWatchdog);
          autoRetryCount = 0;
          console.warn("[QuizZy HUD] Selection verification failed. Applying DOM highlight and advancing to next question.");
          if (window.__QuizZyExtractor && typeof window.__QuizZyExtractor.applyDomHighlight === "function") {
            if (solution && solution.q_type === "order" && Array.isArray(solution.ordered_texts)) {
              window.__QuizZyExtractor.applyDomHighlight({ target_order_badges: solution.ordered_texts });
            } else {
              const tIdx = (typeof solution.selected_index === "number") ? solution.selected_index : 0;
              window.__QuizZyExtractor.applyDomHighlight({ selected_index: tIdx });
            }
          }
          skipCurrentQuestion("Selection error. Advancing to next question...", () => {
            setTimeout(() => {
              if (!isAutoRunning) return;
              resetSolutionDisplay();
              runAutoStep();
            }, 350);
          });
          return;
        }

        // For drag-and-drop ordering questions: proceed to advance so auto mode continues
        if (solution && solution.q_type === "order" && !applyRes.verified_order) {
          console.warn("[QuizZy HUD] Order unverified. Proceeding to advance so auto mode continues.");
        }

        // Fast delay before clicking Submit / Next for React state commit (120ms)
        setTimeout(() => {
          if (stepSettled || !isAutoRunning || currentEpoch !== autoStepEpoch) return;

          clickNextOnPage((nextRes) => {
            if (stepSettled || !isAutoRunning || currentEpoch !== autoStepEpoch) return;

            if (nextRes && nextRes.step === "quiz_completed") {
              stepSettled = true;
              clearTimeout(autoStepWatchdog);
              stopAutoMode("Quiz Completed!");
              return;
            }

            // Snappy poll for question advance using composite signature (75ms interval)
            let pollAttempts = 0;
            const pollInterval = setInterval(() => {
              if (stepSettled || !isAutoRunning || currentEpoch !== autoStepEpoch) {
                clearInterval(pollInterval);
                return;
              }

              pollAttempts++;
              let currentExt = null;
              if (window.__QuizZyExtractor && typeof window.__QuizZyExtractor.extractQuizFromDom === "function") {
                currentExt = window.__QuizZyExtractor.extractQuizFromDom(document);
              }

              const newSig = getQuestionSig(currentExt);
              if (newSig && newSig !== prevSig) {
                clearInterval(pollInterval);
                stepSettled = true;
                clearTimeout(autoStepWatchdog);
                resetSolutionDisplay();
                setTimeout(runAutoStep, 80);
                return;
              }

              if (pollAttempts >= 80) { // 80 * 75ms = 6s timeout
                clearInterval(pollInterval);
                if (!stepSettled) {
                  stepSettled = true;
                  clearTimeout(autoStepWatchdog);
                  skipCurrentQuestion("Question did not advance after submit. Skipping...", () => {
                    setTimeout(() => {
                      if (!isAutoRunning) return;
                      resetSolutionDisplay();
                      runAutoStep();
                    }, 300);
                  });
                }
              }
            }, 75);
          });
        }, 120);
      });
    });
  }

  // ==========================================================================
  // UI Interactions (Buttons, Drawer, Minimize, Visibility)
  // ==========================================================================
  function setMinimized(minimized) {
    isMinimizedState = Boolean(minimized);
    storage.set({ quizzy_hud_minimized: isMinimizedState });

    if (isMinimizedState) {
      if (fullBar) fullBar.classList.add("hidden");
      if (popover) popover.classList.add("hidden");
      if (miniDot) {
        miniDot.classList.remove("hidden");
        if (isAutoRunning) {
          miniDot.classList.add("auto-running");
        } else {
          miniDot.classList.remove("auto-running");
        }
      }
      storage.get(["quizzy_dot_pos"], (res) => {
        if (res.quizzy_dot_pos && typeof res.quizzy_dot_pos.left === "number") {
          applyDotPosition(res.quizzy_dot_pos);
        } else {
          const defaultDotX = Math.max(8, window.innerWidth - 34);
          const defaultDotY = Math.max(8, window.innerHeight - 34);
          wrapper.style.left = `${defaultDotX}px`;
          wrapper.style.top = `${defaultDotY}px`;
        }
      });
    } else {
      if (miniDot) miniDot.classList.add("hidden");
      if (fullBar) fullBar.classList.remove("hidden");
      storage.get(["quizzy_hud_pos"], (res) => {
        applyBarPosition(res.quizzy_hud_pos);
      });
    }
  }

  function setHidden(hidden) {
    isHiddenState = Boolean(hidden);
    if (isHiddenState) {
      wrapper.classList.add("hidden");
    } else {
      wrapper.classList.remove("hidden");
      // Mutual Exclusivity: When floating HUD is open, the side panel disappears!
      if (isSidePanelOpen) {
        isSidePanelOpen = false;
        sendExtensionMessage({ action: "CLOSE_SIDEPANEL" });
      }
      checkHealth();
    }
    storage.set({ quizzy_hud_hidden: isHiddenState });
  }

  function toggleVisibility() {
    const willBeHidden = !isHiddenState;
    setHidden(willBeHidden);
    if (!willBeHidden && isMinimizedState) {
      setMinimized(false);
    }
    return !isHiddenState;
  }

  function show(forceExpand = false) {
    setHidden(false);
    if (forceExpand || isMinimizedState) {
      setMinimized(false);
    }
  }

  function hide() {
    setHidden(true);
  }

  if (btnSolve) {
    btnSolve.addEventListener("click", () => solveCurrentQuestion());
  }

  if (btnApply) {
    btnApply.addEventListener("click", () => applyCurrentSolution());
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (quizzyMode === "code") {
        const exec = window.__QuizZyExecutor || window.QuizZyExecutor;
        if (exec && typeof exec.autoCompileAndSubmitLoop === "function") {
          const extracted = (window.__QuizZyExtractor && typeof window.__QuizZyExtractor.extractCodingQuestionFromDom === "function")
            ? window.__QuizZyExtractor.extractCodingQuestionFromDom(document)
            : extractCurrentQuiz();
          const code = latestSolution ? (latestSolution.answer || latestSolution.selected_text) : (extracted ? extracted.starter_code : "");
          exec.autoCompileAndSubmitLoop({
            code: code,
            language: extracted ? extracted.language : null,
            starter_code: extracted ? extracted.starter_code : null
          }, (solvePayload) => {
            return new Promise((resolve) => {
              sendExtensionMessage({
                action: "SOLVE_REQUEST",
                payload: Object.assign({
                  subject: "Coding Practice",
                  q_type: "code",
                  question: extracted ? extracted.question : "",
                  language: extracted ? extracted.language : null,
                  starter_code: extracted ? extracted.starter_code : null
                }, solvePayload)
              }, (res) => {
                resolve(res && res.data ? res.data : null);
              });
            });
          }, document).then((loopRes) => {
            if (answerText && loopRes) {
              answerText.textContent = loopRes.status === "submitted" ? "Submitted Successfully!" : (loopRes.error || "Done");
            }
          });
          return;
        }
      }
      resetSolutionDisplay();
      clickNextOnPage((res) => {
        if (res && res.button_text && answerText) {
          answerText.textContent = `Advanced: ${res.button_text}`;
        }
      });
    });
  }

  if (btnAuto) {
    btnAuto.addEventListener("click", () => {
      if (isAutoRunning) {
        stopAutoMode("Auto Mode stopped.");
      } else {
        startAutoMode();
      }
    });
  }

  if (btnMore) {
    btnMore.addEventListener("click", () => {
      if (popover) popover.classList.toggle("hidden");
    });
  }

  if (btnMin) {
    btnMin.addEventListener("click", () => setMinimized(true));
  }

  if (logoZ) {
    logoZ.addEventListener("dblclick", (e) => {
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      setMinimized(true);
    });
    logoZ.addEventListener("click", (e) => {
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      setMinimized(true);
    });
  }

  if (btnSkip) {
    btnSkip.addEventListener("click", () => {
      skipCurrentQuestion("Skipped by user", (res) => {
        if (res && res.button_text && answerText) {
          answerText.textContent = `Skipped: ${res.button_text}`;
        }
      });
    });
  }

  if (btnFlag) {
    btnFlag.addEventListener("click", () => {
      if (!latestSolution || !latestExtracted) return;
      btnFlag.disabled = true;

      const payload = {
        subject: latestExtracted.subject || "General",
        q_type: latestExtracted.q_type || "mcq",
        question: latestExtracted.question,
        options: latestExtracted.options || [],
        wrong_answer: latestSolution.answer,
        is_unverified_flag: true
      };

      sendExtensionMessage({ action: "SUBMIT_FEEDBACK", payload }, (res) => {
        btnFlag.disabled = false;
        if (res && res.success) {
          btnFlag.className = "hud-btn-flag flagged";
          btnFlag.innerHTML = "<span>✓ Evicted</span>";
          if (answerText) {
            answerText.className = "hud-answer-text ready";
            answerText.textContent = "Answer flagged wrong. Cache evicted.";
          }
        }
      });
    });
  }

  // ==========================================================================
  // Double-Tap Hotkeys (Ctrl, Z / Alt, Fn / Shift)
  // ==========================================================================
  let ctrlDown = false;
  let ctrlComboUsed = false;
  let altDown = false;
  let altComboUsed = false;
  let shiftDown = false;
  let shiftComboUsed = false;
  let fnDown = false;
  let fnComboUsed = false;
  let zDown = false;
  let zComboUsed = false;

  const lastTapTimes = {
    Control: 0,
    Alt: 0,
    Shift: 0,
    Fn: 0,
    Z: 0
  };

  function isEditableElement(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    if (typeof el.getAttribute === "function" && el.getAttribute("contenteditable") === "true") return true;
    return false;
  }

  function isFnKey(e) {
    return e.key === "Fn" || e.key === "Function" || e.code === "Fn" || e.key === "Unidentified" || e.keyCode === 255;
  }

  const singleTapTimers = {
    Control: null,
    Shift: null,
    Fn: null,
    Z: null,
    Alt: null
  };

  function executeModifierAction(modName, isDouble, e) {
    if (modName === "Control") {
      if (isSidePanelOpen) {
        sendExtensionMessage({ action: "CLOSE_SIDEPANEL" });
        isSidePanelOpen = false;
        setHidden(false);
        setMinimized(false);
      } else {
        toggleVisibility();
      }
    } else if (modName === "Alt") {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (isSidePanelOpen) {
        sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_mode" });
      } else {
        if (isHiddenState) setHidden(false);
        setMinimized(!isMinimizedState);
      }
    } else if (modName === "Z") {
      if (isDouble) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        if (!isSidePanelOpen) {
          if (isHiddenState) setHidden(false);
          setMinimized(!isMinimizedState);
        }
      }
    } else if (modName === "Fn" || modName === "Shift") {
      if (isSidePanelOpen) {
        sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_auto" });
      } else {
        if (isAutoRunning) {
          stopAutoMode("Stopped via hotkey");
        } else {
          if (isHiddenState) setHidden(false);
          startAutoMode();
        }
      }
    }
  }

  function handleModifierDoubleTap(modName, e) {
    const now = Date.now();
    const last = lastTapTimes[modName] || 0;
    const diff = now - last;

    if (last > 0 && diff >= 0 && diff <= 650) {
      lastTapTimes[modName] = 0;
      if (singleTapTimers[modName]) {
        clearTimeout(singleTapTimers[modName]);
        singleTapTimers[modName] = null;
      }
      executeModifierAction(modName, true, e);
    } else {
      lastTapTimes[modName] = now;
      if (singleTapTimers[modName]) {
        clearTimeout(singleTapTimers[modName]);
      }
      if (modName === "Control" || modName === "Shift" || modName === "Fn") {
        singleTapTimers[modName] = setTimeout(() => {
          singleTapTimers[modName] = null;
          lastTapTimes[modName] = 0;
          executeModifierAction(modName, false, e);
        }, 260);
      }
    }
  }

  function onGlobalKeyDown(e) {
    if (!e) return;
    if (e.key === "Escape" || e.key === "Esc") {
      if (isSidePanelOpen) {
        sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "escape" });
        if (typeof e.preventDefault === "function") e.preventDefault();
        return;
      }
      if (isAutoRunning) {
        stopAutoMode("Escape key pressed.");
        if (typeof e.preventDefault === "function") e.preventDefault();
        return;
      }
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const key = (e.key || "").toLowerCase();
      const code = e.code || "";
      if (key === "s" || code === "KeyS") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (isSidePanelOpen) {
          sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_solve" });
        } else {
          solveCurrentQuestion();
        }
        return;
      }
      if (key === "a" || code === "KeyA") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (isSidePanelOpen) {
          sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_apply" });
        } else {
          applyCurrentSolution();
        }
        return;
      }
      if (key === "n" || code === "KeyN") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (isSidePanelOpen) {
          sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_next" });
        } else {
          clickNextOnPage((res) => {
            if (res && res.button_text && answerText) {
              answerText.textContent = `Advanced: ${res.button_text}`;
            }
          });
        }
        return;
      }
      if (key === "k" || code === "KeyK" || key === "w" || code === "KeyW") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (isSidePanelOpen) {
          sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_skip" });
        } else {
          skipCurrentQuestion("Skipped (Alt+K)", (res) => {
            if (res && res.button_text && answerText) {
              answerText.textContent = `Skipped: ${res.button_text}`;
            }
          });
        }
        return;
      }
      if (key === "m" || code === "KeyM") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (isSidePanelOpen) {
          sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_mode" });
        } else {
          if (e.shiftKey) {
            toggleMode();
          } else {
            toggleVisibility();
          }
        }
        return;
      }
      if (key === "o" || code === "KeyO") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (isSidePanelOpen) {
          sendExtensionMessage({ action: "FORWARD_SHORTCUT_TO_SIDEPANEL", command: "trigger_auto" });
        } else {
          if (isAutoRunning) {
            stopAutoMode("Stopped via Alt+O");
          } else {
            startAutoMode();
          }
        }
        return;
      }
    }

    if (e.repeat) return;

    const isControl = e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight";
    const isAlt = e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight";
    const isShift = e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight";
    const isZ = e.key === "z" || e.key === "Z" || e.code === "KeyZ";

    if (isControl) {
      ctrlDown = true;
      ctrlComboUsed = false;
    } else if (isAlt) {
      altDown = true;
      altComboUsed = false;
    } else if (isShift) {
      shiftDown = true;
      shiftComboUsed = false;
    } else if (isFnKey(e)) {
      fnDown = true;
      fnComboUsed = false;
      handleModifierDoubleTap("Fn", e);
    } else if (isZ) {
      const activeEl = (typeof document !== "undefined") ? document.activeElement : null;
      if (!isEditableElement(e.target) && !isEditableElement(activeEl) && !e.ctrlKey && !e.altKey && !e.metaKey && !ctrlDown && !altDown) {
        zDown = true;
        zComboUsed = false;
      } else {
        zDown = false;
        zComboUsed = true;
      }
    } else {
      if (ctrlDown) ctrlComboUsed = true;
      if (altDown) altComboUsed = true;
      if (shiftDown) shiftComboUsed = true;
      if (fnDown) fnComboUsed = true;
      if (zDown) zComboUsed = true;
    }
  }

  function onGlobalKeyUp(e) {
    if (!e) return;
    const isControl = e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight";
    const isAlt = e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight";
    const isShift = e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight";
    const isZ = e.key === "z" || e.key === "Z" || e.code === "KeyZ";

    if (isControl) {
      ctrlDown = false;
      if (!ctrlComboUsed) {
        handleModifierDoubleTap("Control", e);
      }
    } else if (isAlt) {
      altDown = false;
      if (!altComboUsed) {
        handleModifierDoubleTap("Alt", e);
      }
    } else if (isShift) {
      shiftDown = false;
      if (!shiftComboUsed) {
        handleModifierDoubleTap("Shift", e);
      }
    } else if (isFnKey(e)) {
      fnDown = false;
      if (!fnComboUsed) {
        handleModifierDoubleTap("Fn", e);
      }
    } else if (isZ) {
      if (zDown && !zComboUsed) {
        handleModifierDoubleTap("Z", e);
      }
      zDown = false;
      zComboUsed = false;
    }
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("keydown", onGlobalKeyDown, { capture: true, passive: false });
    window.addEventListener("keyup", onGlobalKeyUp, { capture: true, passive: false });
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("keydown", onGlobalKeyDown, { capture: true, passive: false });
    document.addEventListener("keyup", onGlobalKeyUp, { capture: true, passive: false });
  }

  // Runtime message listener for background commands & shortcuts
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;
      if (message.action === "KILL_SWITCH_TRIGGERED") {
        if (isAutoRunning) {
          stopAutoMode(message.reason || "Kill switch triggered.");
        }
        if (typeof sendResponse === "function") sendResponse({ success: true });
        return;
      }
      if (message.action === "TOGGLE_FLOATING_HUD_COMMAND") {
        toggleVisibility();
        if (typeof sendResponse === "function") sendResponse({ success: true });
        return;
      }
      if (message.action === "SHOW_FLOATING_HUD_COMMAND") {
        show(true);
        if (typeof sendResponse === "function") sendResponse({ success: true });
        return;
      }
      if (message.action === "HIDE_FLOATING_HUD_COMMAND") {
        hide();
        if (typeof sendResponse === "function") sendResponse({ success: true });
        return;
      }
      if (message.action === "SIDEPANEL_STATE_CHANGED") {
        isSidePanelOpen = Boolean(message.isOpen);
        if (isSidePanelOpen) {
          hide();
        }
        if (typeof sendResponse === "function") sendResponse({ success: true, isSidePanelOpen });
        return true;
      }
      if (message.action === "SHORTCUT_ACTION") {
        const cmd = message.command;
        if (cmd === "trigger_solve") {
          solveCurrentQuestion();
          if (typeof sendResponse === "function") sendResponse({ handled: true, success: true });
        } else if (cmd === "trigger_apply") {
          applyCurrentSolution();
          if (typeof sendResponse === "function") sendResponse({ handled: true, success: true });
        } else if (cmd === "trigger_auto_loop" || cmd === "trigger_auto") {
          if (isAutoRunning) {
            stopAutoMode("Stopped via shortcut");
          } else {
            startAutoMode();
          }
          if (typeof sendResponse === "function") sendResponse({ handled: true, success: true, running: isAutoRunning });
        } else if (cmd === "open_popup_hud" || cmd === "toggle_hud") {
          toggleVisibility();
          if (typeof sendResponse === "function") sendResponse({ handled: true, success: true });
        } else if (cmd === "trigger_next") {
          clickNextOnPage();
          if (typeof sendResponse === "function") sendResponse({ handled: true, success: true });
        } else if (cmd === "trigger_skip") {
          skipCurrentQuestion("Skipped via shortcut");
          if (typeof sendResponse === "function") sendResponse({ handled: true, success: true });
        } else {
          if (typeof sendResponse === "function") sendResponse({ handled: false });
        }
        return true;
      }
    });
  }

  // ==========================================================================
  // Public Instance Definition
  // ==========================================================================
  const hudInstance = {
    host,
    shadow,
    wrapper,
    fullBar,
    miniDot,
    isCodingMode: false,
    get quizzyMode() { return quizzyMode; },
    getMode: () => quizzyMode,
    setMode,
    toggleMode,
    isProctoredCodingPage: () => false,
    isVisible: () => isVisibleState && !isHiddenState,
    isHidden: () => isHiddenState,
    isMinimized: () => isMinimizedState,
    get isAutoRunning() { return isAutoRunning; },
    get isSidePanelOpen() { return isSidePanelOpen; },
    setSidePanelOpen: (val) => {
      isSidePanelOpen = Boolean(val);
      if (isSidePanelOpen) hide();
    },
    toggle: toggleVisibility,
    show,
    hide,
    setMinimized,
    setHidden,
    solve: solveCurrentQuestion,
    apply: applyCurrentSolution,
    skip: skipCurrentQuestion,
    next: clickNextOnPage,
    startAuto: startAutoMode,
    stopAuto: stopAutoMode,
    destroy: () => {
      clearInterval(healthInterval);
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("keydown", onGlobalKeyDown, true);
        window.removeEventListener("keyup", onGlobalKeyUp, true);
      }
      if (host && host.parentNode) {
        host.parentNode.removeChild(host);
      }
      delete window.__QUIZZY_HUD_INSTANCE__;
    }
  };

  window.__QUIZZY_HUD_INSTANCE__ = hudInstance;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = hudInstance;
  }

  return {
    success: true,
    mounted: true,
    visible: isVisibleState && !isHiddenState,
    instance: hudInstance,
    shadow,
    wrapper,
    fullBar,
    miniDot,
    ...hudInstance,
    get isAutoRunning() { return isAutoRunning; },
    get isSidePanelOpen() { return isSidePanelOpen; }
  };
})();
