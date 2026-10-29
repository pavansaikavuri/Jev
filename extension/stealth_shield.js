/**
 * QuizZy - Early-Initialization MAIN-World Lifecycle & Coordination Shield
 * 
 * Runs in world: "MAIN" at run_at: "document_start" on explicitly authorized
 * development and staging environments.
 * 
 * Capabilities:
 * 1. Deterministic Page-State & Editor Lifecycle Detection (Ace, Monaco).
 * 2. Environment Authorization Gate (disables privileged automation outside authorized test harnesses).
 * 3. Diagnostic Logging: Records host extension detection/blocking for analysis without modifying site controls.
 * 4. Zero Global API Tampering: Does not spoof Event.isTrusted, does not monkey-patch fetch/XHR,
 *    does not modify DOM prototypes, and does not alter site security scanners.
 */

(function () {
  "use strict";

  // Prevent multiple executions in the same execution context
  if (typeof window === "undefined" || window.__QUIZZY_EARLY_INIT_ACTIVE__) return;

  const AUTHORIZED_PATTERNS = [
    /^https?:\/\/localhost(?::\d+)?(?:\/.*)?$/i,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/.*)?$/i,
    /^https?:\/\/.*\.staging\.quizzy\.internal(?:\/.*)?$/i,
    /^https?:\/\/.*\.test(?::\d+)?(?:\/.*)?$/i
  ];

  function isAuthorizedEnvironment(loc) {
    if (!loc) return false;
    const href = loc.href || "";
    const hostname = loc.hostname || "";
    const origin = loc.origin || "";

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".test") || hostname.endsWith(".staging.quizzy.internal")) {
      return true;
    }
    return AUTHORIZED_PATTERNS.some((pattern) => pattern.test(href) || pattern.test(origin));
  }

  const isAuthorized = (typeof window !== "undefined" && window.location)
    ? isAuthorizedEnvironment(window.location)
    : false;

  const diagnosticsLog = [];

  function recordDiagnostic(entry) {
    try {
      const record = {
        timestamp: Date.now(),
        data: entry
      };
      diagnosticsLog.push(record);
      if (diagnosticsLog.length > 50) {
        diagnosticsLog.shift();
      }
    } catch (_) {}
  }

  function getEditorInfo() {
    try {
      if (typeof window !== "undefined") {
        if (window.ace && typeof window.ace.edit === "function") {
          return { type: "ace", ready: true };
        }
        if (window.monaco && window.monaco.editor) {
          const models = (typeof window.monaco.editor.getModels === "function") ? window.monaco.editor.getModels() : [];
          return { type: "monaco", ready: true, modelCount: models.length };
        }
      }
    } catch (_) {}
    return { type: "none", ready: false };
  }

  function getPageContext() {
    const loc = (typeof window !== "undefined") ? window.location : null;
    const pathname = (loc && loc.pathname) ? loc.pathname : "";
    const isCodingRoute = pathname.includes("/question/") || pathname.includes("/coding/");
    return {
      pathname,
      isCodingRoute,
      authorized: isAuthorized,
      editor: getEditorInfo()
    };
  }

  const coordinationInterface = {
    version: "1.0.0",
    runAt: "document_start",
    world: "MAIN",
    isAuthorizedEnvironment,
    isAutomationAuthorized: () => isAuthorized,
    getEditorInfo,
    getPageContext,
    recordDiagnostic,
    getDiagnostics: () => [...diagnosticsLog]
  };

  try {
    Object.defineProperty(window, "__QUIZZY_COORDINATION__", {
      value: coordinationInterface,
      writable: false,
      enumerable: false,
      configurable: false
    });
    Object.defineProperty(window, "__QUIZZY_EARLY_INIT_ACTIVE__", {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false
    });
  } catch (_) {
    window.__QUIZZY_COORDINATION__ = coordinationInterface;
    window.__QUIZZY_EARLY_INIT_ACTIVE__ = true;
  }
})();
