/**
 * QuizZy - DOM Action Executor (Phase 3 Auto Mode)
 * 
 * Strict Guardrail Architecture:
 * - Plain DOM element clicks (.click() / MouseEvent)
 * - Native property descriptor value setting + input/change event dispatch for React/Vue/Angular text inputs
 * - Verified HTML5 DragEvent reordering with post-drag order check (safe-pause fallback if unmoved)
 * - Next/Submit button navigation clicker
 * - ZERO node creation, ZERO DOM attribute/class tampering, ZERO style injection
 */

(function () {
  "use strict";

  /**
   * Cleans text content for matching.
   */
  function cleanText(text) {
    if (!text) return "";
    return String(text)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Normalizes TeX/LaTeX formulas from KaTeX annotation elements.
   * Mirrors 1:1 implementation in extractor.js.
   */
  function normalizeTeX(tex) {
    if (!tex) return "";
    let s = String(tex).trim();

    // 1. Loop-flatten inner constructs before and alongside fractions
    for (let pass = 0; pass < 4; pass++) {
      const prev = s;
      s = s.replace(/\\left\s*([(\[{|.\\])/g, "$1")
           .replace(/\\right\s*([)\]}|.\\])/g, "$1")
           .replace(/\\text\{([^{}]+)\}/g, "$1")
           .replace(/\^\{([^{}]+)\}/g, "^$1")
           .replace(/_\{([^{}]+)\}/g, "_$1")
           .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)");
      if (s === prev) break;
    }

    // 2. Resolve \frac and \dfrac with compound expression grouping
    for (let pass = 0; pass < 4; pass++) {
      const prev = s;
      s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (m, num, den) => {
        const cleanNum = num.trim();
        const cleanDen = den.trim();
        const wrappedNum = /[+\-]/.test(cleanNum) ? `(${cleanNum})` : cleanNum;
        const wrappedDen = /[+\-]/.test(cleanDen) ? `(${cleanDen})` : cleanDen;
        return `${wrappedNum}/${wrappedDen}`;
      });
      if (s === prev) break;
    }

    // 3. Clean operators and formatting commands
    s = s.replace(/\\times\b/g, "x")
         .replace(/\\cdot\b/g, "*")
         .replace(/\\pm\b/g, "+-")
         .replace(/\\neq\b/g, "!=")
         .replace(/\\leq\b/g, "<=")
         .replace(/\\geq\b/g, ">=")
         .replace(/\\approx\b/g, "~=")
         .replace(/\\pi\b/g, "pi")
         .replace(/\\infty\b/g, "inf")
         .replace(/\\[a-zA-Z]+/g, " ")
         .replace(/[{}]/g, "")
         .replace(/\s+/g, " ")
         .trim();

    return s;
  }

  /**
   * Helper to identify QuizZy internal elements (such as the Floating HUD)
   * so they are 100% shielded from quiz detection and DOM traversal.
   */
  function isQuizZyInternalElement(el) {
    if (!el) return false;
    if (el.id === "__quizzy_hud_host__") return true;
    if (typeof el.getAttribute === "function" && el.getAttribute("data-quizzy-ignore") === "true") return true;
    if (typeof el.closest === "function") {
      try {
        if (el.closest("#__quizzy_hud_host__, [data-quizzy-ignore='true']")) return true;
      } catch (_) {}
    }
    return false;
  }

  /**
   * Extracts clean visible text from elements while preserving KaTeX math formulas.
   * Mirrors 1:1 implementation in extractor.js.
   */
  function getCleanVisibleText(rootEl, preserveWhitespace = false) {
    if (!rootEl) return "";
    let extracted = "";

    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        extracted += node.nodeValue;
        return;
      }
      if (node.nodeType !== 1) return;
      if (isQuizZyInternalElement(node)) return;

      const tag = node.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript") return;
      if (tag === "br") {
        extracted += "\n";
        return;
      }

      const cls = (node.className && typeof node.className === "string") ? node.className : "";
      if (cls.includes("katex-mathml") || cls.includes("MJX_Assistive_MathML")) return;
      if (tag === "annotation" || tag === "annotation-xml") return;

      if (cls.includes("katex")) {
        const texAnno = node.querySelector("annotation[encoding*='tex']");
        if (texAnno && texAnno.textContent) {
          extracted += " " + normalizeTeX(texAnno.textContent) + " ";
          return;
        }
      }

      if (tag === "mjx-container" || cls.includes("MathJax")) {
        const texAnno = node.querySelector("annotation[encoding*='tex']");
        if (texAnno && texAnno.textContent) {
          extracted += " " + normalizeTeX(texAnno.textContent) + " ";
          return;
        }
        const texAttr = node.getAttribute("data-tex") || node.getAttribute("alt");
        if (texAttr) {
          extracted += " " + normalizeTeX(texAttr) + " ";
          return;
        }
      }

      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
      }
    }

    walk(rootEl);
    if (preserveWhitespace) {
      return extracted
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
    }
    return extracted.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  }

  /**
   * Strips decorative option prefixes (e.g. 'A. ', '(B) ', '1) ') while strictly
   * protecting mathematical subtraction and algebra expressions.
   * Mirrors 1:1 implementation in extractor.js.
   */
  function stripDecorativePrefix(text) {
    if (!text || typeof text !== "string") return "";
    let s = text.trim();

    // 1. Parenthesized or bracketed letter/digit prefix
    s = s.replace(/^\(\s*([A-Fa-f0-9]{1,2})\s*\)\s+/, "");
    s = s.replace(/^\[\s*([A-Fa-f0-9]{1,2})\s*\]\s+/, "");

    // 2. Bare option letter [A-Fa-f] followed immediately by . or ) or :
    s = s.replace(/^[A-Fa-f][\.\)\:]\s+/, "");

    // 3. Digit prefix followed immediately by . or )
    s = s.replace(/^[0-9]{1,2}[\.\)]\s+/, "");

    // 4. Bullet symbols
    s = s.replace(/^[\u2022\u25E6\u25AA\u2023]\s*/, "");

    return s.trim();
  }

  /**
   * Preserves multi-line indentation for code blocks while collapsing standard prose/math options.
   * Strips decorative prefixes only on the first line.
   * Mirrors 1:1 implementation in extractor.js.
   */
  function normalizeOptionWhitespace(text, hasCodeBlock) {
    if (!text) return "";
    const clean = String(text)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const isMultiLineCode = hasCodeBlock && clean.includes("\n");
    if (isMultiLineCode) {
      const lines = clean.split("\n");
      while (lines.length > 0 && lines[0].trim() === "") lines.shift();
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
      if (lines.length === 0) return "";

      lines[0] = stripDecorativePrefix(lines[0]);
      return lines.join("\n");
    }

    const single = clean.replace(/\s+/g, " ").trim();
    return stripDecorativePrefix(single);
  }

  /**
   * Checks if an element is part of an explanation, solution, or feedback container.
   * Mirrors 1:1 implementation in extractor.js.
   */
  function isExplanationOrFeedback(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "button" || tag === "input") {
      return false;
    }

    let curr = el;
    while (curr && curr !== (typeof document !== "undefined" ? document.body : null)) {
      const currTag = (curr.tagName || "").toLowerCase();
      if (currTag === "button") {
        curr = curr.parentElement;
        continue;
      }

      const cls = (curr.className && typeof curr.className === "string") ? curr.className : "";
      const id = curr.id || "";
      if (/\b(explanation|solution|feedback|answer-key|hint-box|correct-answer|result-drawer|explanation-container|explanation-drawer)\b/i.test(`${cls} ${id}`)) {
        return true;
      }

      if (curr.firstElementChild) {
        const firstTag = curr.firstElementChild.tagName ? curr.firstElementChild.tagName.toLowerCase() : "";
        if (firstTag !== "button" && (/^h[1-6]$/.test(firstTag) || firstTag === "strong" || firstTag === "b")) {
          const headingText = (curr.firstElementChild.innerText || curr.firstElementChild.textContent || "").trim();
          if (/^\s*(explanation|solution|correct answer|your answer|hint|note\s*:|answer\s*:)/i.test(headingText) && !/show\s*answer/i.test(headingText)) {
            return true;
          }
        }
      }

      const prev = curr.previousElementSibling;
      if (prev) {
        const prevTag = prev.tagName ? prev.tagName.toLowerCase() : "";
        if (prevTag !== "button" && (/^h[1-6]$/.test(prevTag) || prevTag === "strong" || prevTag === "b")) {
          const headingText = (prev.innerText || prev.textContent || "").trim();
          if (/^\s*(explanation|solution|correct answer|your answer|hint|note\s*:|answer\s*:)/i.test(headingText) && !/show\s*answer/i.test(headingText)) {
            return true;
          }
        }
      }

      curr = curr.parentElement;
    }
    return false;
  }

  /**
   * Identifies non-question header, navigation, button, or explanation strings to prevent false positives.
   */
  function isHeaderOrNavText(text) {
    if (!text) return true;
    const t = text.trim();

    // Standalone action buttons
    if (/^(?:show\s*answer|hide\s*answer|submit|submit\s*answer|skip|next|next\s*question|previous|back|continue|report(?:\s*an)?\s*issue|check|finish|view\s*report)$/i.test(t)) {
      return true;
    }

    // Validation error messages (e.g. learning.ccbp.in red error banner)
    if (/^(?:please\s*select\s*(?:an?\s*)?(?:option|answer)|select\s*(?:an?\s*)?(?:option|answer))$/i.test(t)) {
      return true;
    }

    // Top-bar navigation, controls, scores, instructions, CCBP student ID & disclaimers
    if (/^(?:mcq\s*practice|practice\s*instructions|end\s*practice|end\s*test|submit\s*test|score\s*:\s*\d+|questions?\s*attempted\s*:\s*\d+|time\s*left|timer\s*:|id\s*:\s*[A-Za-z0-9]+)/i.test(t)) {
      return true;
    }

    if (/^if\s+you\s+skip,\s+you\s+can\s+attempt\s+this\s+question\s+again/i.test(t)) {
      return true;
    }

    // Post-submit explanation or feedback title headers
    if (t.length <= 40 && /^(?:explanation|solution|correct\s*answer|your\s*answer|detailed\s*solution|answer\s*key|hint|review(?:\s*questions)?)$/i.test(t)) {
      return true;
    }

    // Numbering artifacts like "Question 1 of 15" or "Q1."
    if (/^(?:question\s*\d+\s*(?:of|\/)\s*\d+|q\s*\d+[\.\:\s]*)$/i.test(t)) {
      return true;
    }

    return false;
  }

  /**
   * Helper that checks if an element or any of its descendants is or contains an action button
   * (e.g. SUBMIT, SHOW ANSWER, SKIP) or a quiz footer/disclaimer (e.g. "If you skip...")
   * or a validation error message (e.g. "Please select an option").
   */
  function containsActionButtonOrFooter(el) {
    if (!el || el.nodeType !== 1) return false;
    const actionPattern = /^(?:SHOW ANSWER|HIDE ANSWER|SUBMIT|SUBMIT ANSWER|SKIP|NEXT|NEXT QUESTION|PREVIOUS|END PRACTICE|PRACTICE INSTRUCTIONS|HINT|REPORT|CHECK|FINISH|VIEW REPORT|PLEASE SELECT AN OPTION|PLEASE SELECT AN ANSWER|SELECT AN OPTION|SELECT AN ANSWER)$/;
    const footerKeywords = /(?:IF YOU SKIP, YOU CAN ATTEMPT|QUESTIONS ATTEMPTED|END PRACTICE|PRACTICE INSTRUCTIONS|PLEASE SELECT AN OPTION|PLEASE SELECT AN ANSWER|SELECT AN OPTION)/;

    const elText = cleanText(el.textContent || el.innerText || "").toUpperCase();
    if (actionPattern.test(elText) || footerKeywords.test(elText)) {
      return true;
    }

    const descendants = el.querySelectorAll ? Array.from(el.querySelectorAll("button, [role='button'], a, div, span, p")) : [];
    for (const d of descendants) {
      const dText = cleanText(d.textContent || d.innerText || "").toUpperCase();
      if (actionPattern.test(dText) || footerKeywords.test(dText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Finds the Quiz Card container.
   * Walks up from action button all the way until just BEFORE the top page navbar or document body,
   * verifying it contains substantial content above the buttons.
   */
  function findQuizCard(doc) {
    if (!doc) return null;
    if (isQuizZyInternalElement(doc)) return null;

    // 1. Semantic card classes
    const semanticSelectors = [
      "[class*='question-card']", "[class*='questionCard']",
      "[class*='questionContainer']", "[class*='question-container']",
      "[class*='quiz-card']", "[class*='quizCard']",
      "[class*='quiz-container']", "[class*='quizContainer']",
      "[class*='practice-card']", "[class*='problem-card']",
      "[class*='mcq-card']"
    ];
    for (const sel of semanticSelectors) {
      const found = Array.from(doc.querySelectorAll(sel)).filter(isVisible);
      for (const el of found) {
        if (isQuizZyInternalElement(el)) continue;
        if (!isExplanationOrFeedback(el)) return el;
      }
    }

    // 2. Button-anchored discovery (for styled-components / sc-...)
    const buttons = Array.from(doc.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']")).filter(isVisible);
    let actionBtn = null;
    for (const btn of buttons) {
      if (isQuizZyInternalElement(btn)) continue;
      const txt = cleanText(btn.textContent || btn.value || "");
      if (/^(?:submit|show\s*answer|next\s*question|next|check|skip)$/i.test(txt)) {
        actionBtn = btn;
        if (/^(?:submit|show\s*answer)$/i.test(txt)) break;
      }
    }

    if (actionBtn) {
      let curr = actionBtn.parentElement;
      let bestCard = null;

      while (curr && curr !== doc.body && curr !== doc.documentElement) {
        if (isQuizZyInternalElement(curr)) break;
        const currText = curr.textContent || "";
        const hasTopNavMarkers = /mcq\s*practice|end\s*practice|questions?\s*attempted|practice\s*instructions/i.test(currText);
        if (hasTopNavMarkers) {
          // Reached or surpassed page wrapper enclosing the navbar; stop here!
          break;
        }

        // Check if curr has substantial content above/outside the action buttons & skip footer
        const nonActionText = currText
          .replace(/show\s*answer|hide\s*answer|submit(?:\s*answer)?|skip|next(?:\s*question)?|previous|end\s*practice|practice\s*instructions|if\s*you\s*skip[^\n]*/gi, "")
          .trim();

        if (nonActionText.length >= 15) {
          bestCard = curr;
        }

        curr = curr.parentElement;
      }

      if (bestCard) {
        return bestCard;
      }
    }

    // 3. Fallbacks
    const generic = Array.from(doc.querySelectorAll("main, [role='main'], form, .card")).filter(isVisible);
    for (const el of generic) {
      if (isQuizZyInternalElement(el)) continue;
      if (!isExplanationOrFeedback(el)) return el;
    }

    return null;
  }

  /**
   * Classless Option Group Discovery (for styled-components / sc-... without radio inputs or semantic classes).
   * Disqualifies layout section wrappers and ensures options container is preceded by question stem text.
   */
  function findClasslessOptionElements(scopeRoot, docRef) {
    const scope = scopeRoot || docRef || (typeof document !== "undefined" ? document : null);
    if (!scope) return [];
    if (isQuizZyInternalElement(scope)) return [];

    const candidateContainers = Array.from(scope.querySelectorAll("div, ul, ol, section, form")).filter(isVisible);
    const allDescendants = Array.from(scope.querySelectorAll("*"));

    // Bottom-Up / Innermost scan: iterate backwards to favor innermost option group
    for (let i = candidateContainers.length - 1; i >= 0; i--) {
      const container = candidateContainers[i];
      if (container === scope) continue;
      if (isQuizZyInternalElement(container)) continue;

      const rawChildren = Array.from(container.children || []).filter(c => isVisible(c) && !isQuizZyInternalElement(c));
      const validChildren = rawChildren.filter(c => {
        const tag = (c.tagName || "").toLowerCase();
        return ["div", "li", "button", "label", "a", "span"].includes(tag) && !["hr", "br", "script", "style"].includes(tag);
      });

      if (validChildren.length < 2 || validChildren.length > 6) continue;

      // Disqualify immediately if ANY candidate child is or contains an action button or footer
      const hasActionChild = validChildren.some(c => containsActionButtonOrFooter(c));
      if (hasActionChild) continue;

      // All children should share the same tag name
      const firstTag = (validChildren[0].tagName || "").toLowerCase();
      const allSameTag = validChildren.every(c => (c.tagName || "").toLowerCase() === firstTag);
      if (!allSameTag) continue;

      // Check each child has clean visible text between 1 and 300 characters
      const texts = validChildren.map(c => getCleanVisibleText(c));
      const validTexts = texts.every(t => t.length >= 1 && t.length <= 300 && !isHeaderOrNavText(t));
      if (!validTexts) continue;

      const uniqueTexts = new Set(texts);
      if (uniqueTexts.size < 2) continue;

      // Disqualify immediately if there is NO non-blacklisted question text inside scope preceding this container
      const containerIdx = allDescendants.indexOf(container);
      if (containerIdx > 0) {
        let hasPrecedingText = false;
        for (let j = 0; j < containerIdx; j++) {
          const prev = allDescendants[j];
          if (container.contains && container.contains(prev)) continue;
          if (containsActionButtonOrFooter(prev)) continue;
          if (isExplanationOrFeedback(prev)) continue;
          const prevTxt = getCleanVisibleText(prev);
          if (prevTxt.length >= 8 && !isHeaderOrNavText(prevTxt)) {
            hasPrecedingText = true;
            break;
          }
        }
        if (!hasPrecedingText) continue;
      } else {
        continue;
      }

      return validChildren;
    }

    return [];
  }

  /**
   * Checks if an element is visible in the layout.
   */
  function isVisible(el) {
    if (!el) return false;
    if (isQuizZyInternalElement(el)) return false;
    if (el.hidden) return false;
    if (typeof window !== "undefined" && window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }
      } catch (e) {
        // Fallback if computed style throws
      }
    }
    return true;
  }

  /**
   * Dispatches a realistic mouse click on an element.
   */
  function dispatchClick(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: "instant", block: "nearest" });
    } catch (e) {}

    try {
      el.focus();
    } catch (e) {}

    // Dispatch pointer and mouse down/up in sequence
    const eventTypes = ["pointerdown", "mousedown", "pointerup", "mouseup"];
    eventTypes.forEach((type) => {
      try {
        let ev;
        if (type.startsWith("pointer") && typeof PointerEvent !== "undefined") {
          ev = new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1,
            pointerId: 1,
            pointerType: "mouse"
          });
        } else {
          ev = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
          });
        }
        el.dispatchEvent(ev);
      } catch (e) {}
    });

    // Native .click() or click event fallback
    if (typeof el.click === "function") {
      try {
        el.click();
      } catch (e) {}
    } else {
      try {
        const clickEv = (typeof MouseEvent !== "undefined")
          ? new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
          : new Event("click", { bubbles: true, cancelable: true });
        el.dispatchEvent(clickEv);
      } catch (e) {}
    }
    return true;
  }

  /**
   * Helper that checks if either the radio input or its container label/card is visible.
   * Crucial for React apps where <input type="radio"> is hidden via CSS while its <label> is visible.
   */
  function isRadioOrOptionVisible(radioEl, containerEl) {
    if (radioEl && isVisible(radioEl)) return true;
    if (containerEl && isVisible(containerEl)) return true;
    return false;
  }

  /**
   * Generates a deterministic CSS selector path for a DOM element.
   * e.g. #id or div:nth-of-type(1) > div:nth-of-type(2)
   */
  function getElementCssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id && !el.id.includes("quizzy")) {
      return `#${el.id}`;
    }
    const path = [];
    let curr = el;
    const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null);
    const stopNode = doc ? (doc.body || doc.documentElement) : null;

    while (curr && curr.nodeType === 1 && curr !== stopNode && curr !== (doc ? doc.documentElement : null)) {
      const tag = curr.tagName.toLowerCase();
      let selector = tag;
      if (curr.id && !curr.id.includes("quizzy")) {
        path.unshift(`#${curr.id}`);
        break;
      }
      const firstClass = (curr.className || "").split(/\s+/).find(c => c && !c.includes("quizzy") && !/^(active|selected|checked|hover|focus)$/i.test(c));
      if (firstClass) {
        selector += `.${firstClass}`;
      }
      let sibling = curr;
      let nth = 1;
      while (sibling.previousElementSibling) {
        sibling = sibling.previousElementSibling;
        if (sibling.tagName.toLowerCase() === tag) nth++;
      }
      selector += `:nth-of-type(${nth})`;
      path.unshift(selector);
      curr = curr.parentElement;
    }
    return path.join(" > ");
  }

  /**
   * Strict Leaf-Option Deduplication:
   * Excludes QuizZy UI elements, excludes action buttons and footers.
   * On React styled-components pages (sc-...), an outer option <div> often wraps an inner <div>
   * or <label> containing the same text. Never includes both a parent element and its descendant!
   * Keeps only the distinct interactive option row containers (2 to 6 sibling items sharing the same parent container or radio group).
   */
  function deduplicateOptionElements(elements) {
    if (!Array.isArray(elements) || elements.length === 0) return [];

    // Filter out QuizZy elements and action buttons / non-option headers
    const filtered = elements.filter(el => {
      if (!el || el.nodeType !== 1) return false;
      if (isQuizZyInternalElement(el)) return false;
      if (containsActionButtonOrFooter(el)) return false;
      const txt = cleanText(el.innerText || el.textContent || "");
      if (isHeaderOrNavText(txt)) return false;
      return true;
    });

    if (filtered.length <= 1) return filtered;

    // Remove any element that contains 2 or more other candidate elements (it is an outer container/wrapper)
    const withoutContainers = filtered.filter(el => {
      let containedCount = 0;
      for (const other of filtered) {
        if (other !== el && el.contains && el.contains(other)) {
          containedCount++;
        }
      }
      return containedCount < 2;
    });

    // Handle 1-on-1 parent/child duplicates:
    // If element A contains element B: keep the option row container (A) and drop inner descendant (B)
    const finalElements = [];
    for (let i = 0; i < withoutContainers.length; i++) {
      const a = withoutContainers[i];
      let hasParentInList = false;
      for (let j = 0; j < withoutContainers.length; j++) {
        if (i !== j) {
          const b = withoutContainers[j];
          if (b.contains && b.contains(a)) {
            hasParentInList = true;
            break;
          }
        }
      }
      if (!hasParentInList) {
        finalElements.push(a);
      }
    }

    return (finalElements.length >= 2 && finalElements.length <= 6) ? finalElements : withoutContainers;
  }

  /**
   * Finds option elements using custom selector or deterministic heuristics.
   * Excludes header/nav text and explanation boxes matching extractor.js rules.
   */
  function findOptionElements(customSelector, optionSelectors) {
    const doc = (typeof document !== "undefined") ? document : null;

    // 0. Deterministic optionSelectors locator metadata from extractor
    if (Array.isArray(optionSelectors) && optionSelectors.length >= 2 && doc) {
      try {
        const directQueried = optionSelectors.map(sel => doc.querySelector(sel)).filter(Boolean);
        if (directQueried.length === optionSelectors.length) {
          const deduped = deduplicateOptionElements(directQueried);
          if (deduped.length >= 2) return deduped;
        }
      } catch (_) {}
    }

    // 1. Direct memory parity with extractor.js if extracted in the same world (zero DOM mutation)
    if (!customSelector && typeof window !== "undefined" && Array.isArray(window.__QUIZZY_LAST_OPTION_ELEMENTS__) && window.__QUIZZY_LAST_OPTION_ELEMENTS__.length >= 2) {
      const allConnected = window.__QUIZZY_LAST_OPTION_ELEMENTS__.every(el => el && el.isConnected !== false);
      if (allConnected) {
        if (Array.isArray(window.__QUIZZY_LAST_OPTIONS_TEXT__) && window.__QUIZZY_LAST_OPTIONS_TEXT__.length === window.__QUIZZY_LAST_OPTION_ELEMENTS__.length) {
          const textMatches = window.__QUIZZY_LAST_OPTION_ELEMENTS__.every((el, i) => {
            const currentText = cleanText(getCleanVisibleText ? getCleanVisibleText(el) : (el.innerText || el.textContent || ""));
            const expectedText = cleanText(window.__QUIZZY_LAST_OPTIONS_TEXT__[i]);
            return currentText === expectedText || currentText.includes(expectedText) || expectedText.includes(currentText);
          });
          if (textMatches) {
            return deduplicateOptionElements(window.__QUIZZY_LAST_OPTION_ELEMENTS__);
          }
        } else {
          return deduplicateOptionElements(window.__QUIZZY_LAST_OPTION_ELEMENTS__);
        }
      }
    }

    if (!doc) return [];

    if (customSelector) {
      const customMatches = Array.from(doc.querySelectorAll(customSelector))
        .filter(isVisible)
        .filter((el) => !isExplanationOrFeedback(el) && !isHeaderOrNavText(cleanText(el.innerText || el.textContent || "")));
      const deduped = deduplicateOptionElements(customMatches);
      if (deduped.length >= 2) return deduped;
    }

    // Check for radio button groups (supporting CSS-hidden radio inputs with visible labels)
    const allRadios = Array.from(doc.querySelectorAll("input[type='radio']"));
    const radioRows = [];
    for (const r of allRadios) {
      if (isQuizZyInternalElement(r)) continue;
      const lbl = r.closest("label") || (r.id ? doc.querySelector(`label[for="${r.id}"]`) : null);
      const row = lbl || r.closest("[class*='option'], [class*='choice'], [class*='radio'], li, tr") || r.parentElement;
      if (isQuizZyInternalElement(row)) continue;
      if (isRadioOrOptionVisible(r, row)) {
        if (!isExplanationOrFeedback(row) && !isHeaderOrNavText(cleanText(row.innerText || row.textContent || ""))) {
          radioRows.push(row || r);
        }
      }
    }
    const dedupedRadios = deduplicateOptionElements(radioRows);
    if (dedupedRadios.length >= 2 && dedupedRadios.length <= 10) {
      return dedupedRadios;
    }

    const optionHeuristics = [
      "[data-quiz-option]",
      ".quiz-option",
      ".option-item",
      ".draggable-item",
      "[draggable='true']",
      "[role='option']",
      "[role='radio']",
      "[class*='radio-item']",
      "[class*='option-item']",
      ".quiz-choice",
      ".option-card",
      "li.choice",
      ".order-item",
      ".sortable-block"
    ];

    for (const sel of optionHeuristics) {
      const matches = Array.from(doc.querySelectorAll(sel))
        .filter(isVisible)
        .filter((el) => !isExplanationOrFeedback(el) && !isHeaderOrNavText(cleanText(el.innerText || el.textContent || "")));
      const deduped = deduplicateOptionElements(matches);
      if (deduped.length >= 2 && deduped.length <= 10) {
        return deduped;
      }
    }

    // Classless styled-components option group discovery (e.g. learning.ccbp.in)
    const quizCard = findQuizCard(doc);
    const classlessOptions = findClasslessOptionElements(quizCard || doc, doc);
    const dedupedClassless = deduplicateOptionElements(classlessOptions);
    if (dedupedClassless.length >= 2) {
      return dedupedClassless;
    }

    return [];
  }

  /**
   * Resolves the per-option row root container for an option element.
   * Walks up leafEl.parentElement while the parent exists, is not document.body (or docElement),
   * does NOT contain action buttons (SUBMIT, NEXT, SHOW ANSWER, SKIP) or footers,
   * and contains at most 1 option from allCandidateLeaves (stopping right before the shared parent
   * container that holds >= 2 options).
   */
  function resolveOptionRowRoot(leafEl, allCandidateLeaves) {
    if (!leafEl || !leafEl.parentElement) return leafEl;
    let curr = leafEl;
    const doc = leafEl.ownerDocument || (typeof document !== "undefined" ? document : null);
    const stopNode = doc ? (doc.body || doc.documentElement) : null;
    const leaves = Array.isArray(allCandidateLeaves) && allCandidateLeaves.length > 0 ? allCandidateLeaves : null;

    while (curr && curr.parentElement && curr.parentElement !== stopNode) {
      const parent = curr.parentElement;
      if (isQuizZyInternalElement(parent)) break;
      if (containsActionButtonOrFooter(parent)) break;

      if (leaves) {
        let containedCount = 0;
        for (const leaf of leaves) {
          if (leaf && (leaf === parent || (parent.contains && parent.contains(leaf)))) {
            containedCount++;
          }
        }
        if (containedCount >= 2) break;
      } else {
        const children = Array.from(parent.children || []).filter(c => isVisible(c) && !isQuizZyInternalElement(c));
        if (children.length >= 2 && children.length <= 6 && children.includes(curr)) {
          break;
        }
      }
      curr = parent;
    }
    return curr;
  }

  /**
   * Resolves the Option Row Container and an ordered sequence of clickable candidate targets.
   * Uses resolveOptionRowRoot to find the per-option row container.
   */
  function resolveOptionRowAndTargets(optEl, allOptions) {
    if (!optEl) return { rowEl: null, candidates: [] };

    // 1. Find the Option Row Container (rowEl)
    const rowEl = resolveOptionRowRoot(optEl, allOptions);

    // 2. Gather candidate click targets in priority order:
    //    1) rowEl itself (full container)
    //    2) <input type="radio" | "checkbox">
    //    3) <label>
    //    4) [role="radio"] / [role="option"] / button
    //    5) Indicator circle / dot child
    //    6) Primary text child element
    //    7) optEl itself (if different from rowEl)
    const candidates = [];
    const seen = new Set();

    function addCandidate(el) {
      if (el && el.nodeType === 1 && !seen.has(el) && isVisible(el) && !isQuizZyInternalElement(el)) {
        seen.add(el);
        candidates.push(el);
      }
    }

    // 1) rowEl itself (full container)
    addCandidate(rowEl);

    // 2) Radio inputs
    const inputs = rowEl.querySelectorAll ? Array.from(rowEl.querySelectorAll("input[type='radio'], input[type='checkbox']")) : [];
    if (["INPUT"].includes(rowEl.tagName)) inputs.push(rowEl);
    inputs.forEach(addCandidate);

    // 3) Labels
    const labels = rowEl.querySelectorAll ? Array.from(rowEl.querySelectorAll("label")) : [];
    if (rowEl.tagName === "LABEL") labels.push(rowEl);
    labels.forEach(addCandidate);

    // 4) Role or button targets
    const roles = rowEl.querySelectorAll ? Array.from(rowEl.querySelectorAll("[role='radio'], [role='option'], button")) : [];
    roles.forEach(addCandidate);

    // 5) Indicator circle/dot child (firstElementChild or matching classes)
    if (rowEl.querySelectorAll) {
      rowEl.querySelectorAll("[class*='circle'], [class*='dot'], [class*='indicator'], [class*='radio']").forEach(addCandidate);
    }
    if (rowEl.firstElementChild && rowEl.firstElementChild !== rowEl) {
      addCandidate(rowEl.firstElementChild);
    }

    // 6) text container (lastElementChild or matching classes)
    const lastChild = rowEl.lastElementChild || (rowEl.childNodes && rowEl.childNodes.length > 0 ? rowEl.childNodes[rowEl.childNodes.length - 1] : null);
    if (lastChild && lastChild.nodeType === 1 && lastChild !== rowEl) {
      addCandidate(lastChild);
    }

    // 7) optEl itself (if different from rowEl)
    if (optEl && optEl !== rowEl) {
      addCandidate(optEl);
    }

    return { rowEl, candidates };
  }

  /**
   * Dispatches realistic coordinates-aware pointer/mouse event sequence and .click().
   */
  function dispatchRealisticClick(el, bubbles = true) {
    if (!el || typeof el.dispatchEvent !== "function") return false;

    try {
      if (typeof el.focus === "function") el.focus();
    } catch (_) {}

    let clientX = 0;
    let clientY = 0;
    if (typeof el.getBoundingClientRect === "function") {
      try {
        const rect = el.getBoundingClientRect();
        clientX = Math.round(rect.left + rect.width / 2);
        clientY = Math.round(rect.top + rect.height / 2);
      } catch (_) {}
    }

    const mouseInit = {
      bubbles: !!bubbles,
      cancelable: true,
      composed: !!bubbles,
      view: (typeof window !== "undefined" ? window : null),
      clientX: clientX,
      clientY: clientY,
      button: 0,
      buttons: 1
    };

    // Cascade: pointerover -> mouseover -> pointerdown -> mousedown -> focus -> pointerup -> mouseup
    ["pointerover", "mouseover", "pointerdown", "mousedown", "focus", "pointerup", "mouseup"].forEach((type) => {
      try {
        if (type === "focus") {
          try {
            if (typeof el.focus === "function") el.focus();
          } catch (_) {}
          const focusEv = (typeof FocusEvent !== "undefined")
            ? new FocusEvent("focus", { bubbles: false, cancelable: false })
            : ((typeof Event !== "undefined") ? new Event("focus", { bubbles: false, cancelable: false }) : null);
          if (focusEv) el.dispatchEvent(focusEv);
          return;
        }

        let ev;
        if (type.startsWith("pointer") && typeof PointerEvent !== "undefined") {
          ev = new PointerEvent(type, Object.assign({}, mouseInit, { pointerId: 1, pointerType: "mouse" }));
        } else if (typeof MouseEvent !== "undefined") {
          ev = new MouseEvent(type, mouseInit);
        } else {
          ev = new Event(type, { bubbles: !!bubbles, cancelable: true });
        }
        el.dispatchEvent(ev);
      } catch (_) {}
    });

    // Native .click() or click event dispatch
    if (bubbles && typeof el.click === "function") {
      try {
        el.click();
      } catch (_) {}
    } else {
      try {
        const clickEv = (typeof MouseEvent !== "undefined")
          ? new MouseEvent("click", mouseInit)
          : new Event("click", { bubbles: !!bubbles, cancelable: true });
        el.dispatchEvent(clickEv);
      } catch (_) {}
    }

    // If input element, dispatch input & change
    if (el.tagName === "INPUT") {
      try {
        if (!el.checked) el.checked = true;
        el.dispatchEvent(new Event("input", { bubbles: !!bubbles, cancelable: true }));
        el.dispatchEvent(new Event("change", { bubbles: !!bubbles, cancelable: true }));
      } catch (_) {}
    }

    return true;
  }

  /**
   * Captures selection state snapshot of an option row and page context.
   * Inspects entire rowEl subtree plus rowEl.parentElement for style, class, aria, and input state.
   */
  function capturePreClickSnapshot(optionEl, allOptionEls, docRef) {
    const doc = docRef || (optionEl ? optionEl.ownerDocument : null) || (typeof document !== "undefined" ? document : null);
    if (!optionEl) return null;

    let inputsChecked = false;
    const inputs = optionEl.querySelectorAll ? Array.from(optionEl.querySelectorAll("input[type='radio'], input[type='checkbox']")) : [];
    if (optionEl.tagName === "INPUT") inputs.push(optionEl);
    inputsChecked = inputs.some(i => i.checked === true);

    const classes = [optionEl.className || ""];
    if (optionEl.parentElement) classes.push(optionEl.parentElement.className || "");
    if (optionEl.querySelectorAll) {
      optionEl.querySelectorAll("*").forEach(c => classes.push(c.className || ""));
    }
    const classNames = classes.join(" ");

    const aria = [
      optionEl.getAttribute ? (optionEl.getAttribute("aria-checked") || optionEl.getAttribute("aria-selected") || optionEl.getAttribute("data-state") || "") : ""
    ];
    if (optionEl.parentElement && optionEl.parentElement.getAttribute) {
      aria.push(optionEl.parentElement.getAttribute("aria-checked") || optionEl.parentElement.getAttribute("aria-selected") || optionEl.parentElement.getAttribute("data-state") || "");
    }
    if (optionEl.querySelectorAll) {
      optionEl.querySelectorAll("[aria-checked], [aria-selected], [data-state]").forEach(c => {
        aria.push(c.getAttribute("aria-checked") || c.getAttribute("aria-selected") || c.getAttribute("data-state") || "");
      });
    }

    function getStylesFor(node) {
      if (!node || node.nodeType !== 1) return "";
      try {
        const cs = window.getComputedStyle(node);
        if (!cs) return "";
        return `${cs.backgroundColor || ""}|${cs.borderColor || ""}|${cs.outline || ""}|${cs.boxShadow || ""}|${cs.color || ""}`;
      } catch (_) {
        return "";
      }
    }

    let styles = "";
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      try {
        styles = `row:${getStylesFor(optionEl)}`;
        if (optionEl.parentElement) {
          styles += `::parent:${getStylesFor(optionEl.parentElement)}`;
        }
        if (optionEl.querySelectorAll) {
          optionEl.querySelectorAll("*").forEach((c, idx) => {
            const st = getStylesFor(c);
            if (st && st !== "||||") styles += `::d${idx}:${st}`;
          });
        }
      } catch (_) {}
    }

    let submitDisabled = null;
    if (doc) {
      const submitBtn = doc.querySelector("button[type='submit'], input[type='submit'], button.btn-submit");
      if (submitBtn) {
        submitDisabled = submitBtn.disabled;
      }
    }

    const htmlLength = (optionEl.innerHTML || "").length;

    return { inputsChecked, classNames, aria: aria.join("|"), styles, submitDisabled, htmlLength };
  }

  const captureOptionSnapshot = capturePreClickSnapshot;

  /**
   * Mandatory Pre-Submit Selection Verification Gate:
   * Inspects 5 selection signals across rowEl, its full subtree, and its parentElement:
   * a) A nested <input type="radio"|"checkbox"> has .checked === true.
   * b) optionEl, child, or parent has aria-checked === "true" or aria-selected === "true" or data-state === "checked".
   * c) optionEl's className or a child's or parent's className changed compared to preClickSnapshot.
   * d) optionEl's, child's, or parent's computed styles changed compared to preClickSnapshot.
   * e) The SUBMIT button on the page transitioned from disabled to enabled.
   */
  function verifyOptionSelected(optionEl, allOptionEls, preClickSnapshot, docRef) {
    if (!optionEl) return false;
    const doc = docRef || (optionEl ? optionEl.ownerDocument : null) || (typeof document !== "undefined" ? document : null);

    // a) A nested <input type="radio"|"checkbox"> has .checked === true
    const inputs = optionEl.querySelectorAll ? Array.from(optionEl.querySelectorAll("input[type='radio'], input[type='checkbox']")) : [];
    if (optionEl.tagName === "INPUT" && ["radio", "checkbox"].includes((optionEl.type || "").toLowerCase())) {
      inputs.push(optionEl);
    }
    if (inputs.some(i => i.checked === true)) {
      return true;
    }

    // b) optionEl, child, or parent has aria-checked === "true" or aria-selected === "true" or data-state === "checked"
    const ariaChecks = [
      optionEl.getAttribute ? optionEl.getAttribute("aria-checked") : null,
      optionEl.getAttribute ? optionEl.getAttribute("aria-selected") : null,
      optionEl.getAttribute ? optionEl.getAttribute("data-state") : null
    ];
    if (optionEl.parentElement) {
      ariaChecks.push(optionEl.parentElement.getAttribute ? optionEl.parentElement.getAttribute("aria-checked") : null);
      ariaChecks.push(optionEl.parentElement.getAttribute ? optionEl.parentElement.getAttribute("aria-selected") : null);
      ariaChecks.push(optionEl.parentElement.getAttribute ? optionEl.parentElement.getAttribute("data-state") : null);
    }
    if (optionEl.querySelectorAll) {
      optionEl.querySelectorAll("[aria-checked='true'], [aria-selected='true'], [data-state='checked']").forEach(() => ariaChecks.push("true"));
    }
    if (ariaChecks.some(a => a === "true" || a === "checked")) {
      return true;
    }

    // c) optionEl's className or a child's/parent's className changed compared to preClickSnapshot
    const currClasses = [optionEl.className || ""];
    if (optionEl.parentElement) currClasses.push(optionEl.parentElement.className || "");
    if (optionEl.querySelectorAll) {
      optionEl.querySelectorAll("*").forEach(c => currClasses.push(c.className || ""));
    }
    const currClassNames = currClasses.join(" ");
    if (preClickSnapshot && currClassNames !== preClickSnapshot.classNames) {
      return true;
    }
    if (/\b(?:selected|active|checked|is-selected|is-active)\b/i.test(currClassNames)) {
      return true;
    }

    // d) optionEl's, child's, or parent's computed styles changed compared to preClickSnapshot
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      try {
        function getStylesFor(node) {
          if (!node || node.nodeType !== 1) return "";
          try {
            const cs = window.getComputedStyle(node);
            if (!cs) return "";
            return `${cs.backgroundColor || ""}|${cs.borderColor || ""}|${cs.outline || ""}|${cs.boxShadow || ""}|${cs.color || ""}`;
          } catch (_) {
            return "";
          }
        }

        let currStyles = `row:${getStylesFor(optionEl)}`;
        if (optionEl.parentElement) {
          currStyles += `::parent:${getStylesFor(optionEl.parentElement)}`;
        }
        if (optionEl.querySelectorAll) {
          optionEl.querySelectorAll("*").forEach((c, idx) => {
            const st = getStylesFor(c);
            if (st && st !== "||||") currStyles += `::d${idx}:${st}`;
          });
        }
        if (preClickSnapshot && preClickSnapshot.styles && currStyles !== preClickSnapshot.styles) {
          return true;
        }
      } catch (_) {}
    }

    // e) The SUBMIT button on the page transitioned from disabled to enabled
    if (doc && preClickSnapshot && preClickSnapshot.submitDisabled === true) {
      const submitBtn = doc.querySelector("button[type='submit'], input[type='submit'], button.btn-submit");
      if (submitBtn && submitBtn.disabled === false) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detects whether option row selection state changed compared to beforeSnapshot.
   */
  function didOptionSelectionChange(rowEl, beforeSnapshot) {
    if (!rowEl || !beforeSnapshot) return false;
    return verifyOptionSelected(rowEl, [], beforeSnapshot);
  }

  /**
   * React Selection Cascade:
   * 1. Scrolls optionEl smoothly into view.
   * 2. Resolves per-option row root container.
   * 3. Dispatches pointerover -> mouseover -> pointerdown -> mousedown -> focus -> pointerup -> mouseup -> click
   *    across:
   *    a) The resolved rowEl itself
   *    b) Descendant radio/checkbox or radio indicator (circle/dot child)
   *    c) The primary text child element
   * 4. Updates controlled <input type="radio"> via HTMLInputElement.prototype descriptor if present.
   */
  function triggerReactSelection(optionEl) {
    if (!optionEl) return false;

    // 1. Scroll optionEl smoothly into view
    try {
      if (typeof optionEl.scrollIntoView === "function") {
        optionEl.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
    } catch (_) {}

    // 2. Locate row container and candidate targets
    const { rowEl, candidates } = resolveOptionRowAndTargets(optionEl);
    const win = (typeof window !== "undefined") ? window : null;
    const doc = (typeof document !== "undefined") ? document : (optionEl.ownerDocument || null);

    // 3. Case 1: Standard or Sibling <input type="radio" | "checkbox"> / <label> exists inside rowEl
    let inputEl = null;
    if (rowEl.tagName === "INPUT" && ["radio", "checkbox"].includes((rowEl.type || "").toLowerCase())) {
      inputEl = rowEl;
    } else if (rowEl.querySelector) {
      inputEl = rowEl.querySelector("input[type='radio'], input[type='checkbox']");
    }

    let labelEl = null;
    if (rowEl.tagName === "LABEL") {
      labelEl = rowEl;
    } else if (rowEl.closest && rowEl.closest("label")) {
      labelEl = rowEl.closest("label");
    } else if (rowEl.querySelector) {
      labelEl = rowEl.querySelector("label");
    }

    if (!inputEl && labelEl && labelEl.getAttribute && labelEl.getAttribute("for") && doc && doc.getElementById) {
      inputEl = doc.getElementById(labelEl.getAttribute("for"));
    }
    if (!labelEl && inputEl && inputEl.id && doc && doc.querySelector) {
      labelEl = doc.querySelector(`label[for="${inputEl.id}"]`);
    }

    if (inputEl || labelEl) {
      if (labelEl) {
        dispatchRealisticClick(labelEl, true);
      }
      if (inputEl && !inputEl.checked) {
        dispatchRealisticClick(inputEl, true);
      }
      if (inputEl && !inputEl.checked) {
        const radio = inputEl;
        try {
          const proto = (typeof window !== "undefined" && window.HTMLInputElement)
            ? window.HTMLInputElement.prototype
            : null;
          const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "checked") : null;
          if (descriptor && descriptor.set) {
            descriptor.set.call(radio, true);
          } else {
            radio.checked = true;
          }
          if (radio._valueTracker && typeof radio._valueTracker.setValue === "function") {
            try {
              radio._valueTracker.setValue(false);
            } catch (_) {}
          }
          radio.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          radio.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        } catch (_) {}
      }
      return true;
    }

    // 4. Custom React Option Row:
    const beforeSnapshot = capturePreClickSnapshot(rowEl);
    if (beforeSnapshot && (beforeSnapshot.inputsChecked || beforeSnapshot.aria === "true")) {
      return true;
    }

    // Step A: Dispatch cascade across resolved rowEl itself
    dispatchRealisticClick(rowEl, true);
    if (verifyOptionSelected(rowEl, [], beforeSnapshot)) {
      return true;
    }

    // Step B: Dispatch cascade across descendant input / indicator
    const indicatorTargets = [];
    if (rowEl.querySelectorAll) {
      rowEl.querySelectorAll("input[type='radio'], input[type='checkbox'], [role='radio'], [role='checkbox'], [class*='circle'], [class*='dot'], [class*='indicator'], [class*='radio']").forEach(el => {
        if (el !== rowEl && !indicatorTargets.includes(el)) indicatorTargets.push(el);
      });
    }
    if (rowEl.firstElementChild && rowEl.firstElementChild !== rowEl && !indicatorTargets.includes(rowEl.firstElementChild)) {
      indicatorTargets.push(rowEl.firstElementChild);
    }
    for (const child of indicatorTargets) {
      dispatchRealisticClick(child, true);
      if (verifyOptionSelected(rowEl, [], beforeSnapshot)) {
        return true;
      }
    }

    // Step C: Dispatch cascade across primary text child element
    const textTargets = [];
    if (optionEl && optionEl !== rowEl && !indicatorTargets.includes(optionEl)) {
      textTargets.push(optionEl);
    }
    const lastChild = rowEl.lastElementChild;
    if (lastChild && lastChild !== rowEl && !indicatorTargets.includes(lastChild) && !textTargets.includes(lastChild)) {
      textTargets.push(lastChild);
    }
    for (const txt of textTargets) {
      dispatchRealisticClick(txt, true);
      if (verifyOptionSelected(rowEl, [], beforeSnapshot)) {
        return true;
      }
    }

    return true;
  }

  /**
   * Compatibility alias for triggerReactSelection.
   */
  function triggerOptionSelect(targetEl) {
    return triggerReactSelection(targetEl);
  }

  /**
   * Executes plain DOM click on targeted MCQ option with Mandatory Pre-Submit Verification Gate.
   * Handles 1:1 text parity with extractor.js and React 16-18 controlled radio selection.
   */
  function executeMcqAction(payload) {
    const doc = (typeof document !== "undefined") ? document : null;
    let options = [];

    // Check payload.optionSelectors first if provided
    if (payload && Array.isArray(payload.optionSelectors) && payload.optionSelectors.length >= 2 && doc) {
      try {
        const directQueried = payload.optionSelectors.map(sel => doc.querySelector(sel)).filter(Boolean);
        if (directQueried.length === payload.optionSelectors.length) {
          options = deduplicateOptionElements(directQueried);
        }
      } catch (_) {}
    }

    if (options.length === 0) {
      options = findOptionElements(payload ? payload.optionsSelector : null, payload ? payload.optionSelectors : null);
    }

    if (options.length === 0) {
      return { ok: false, success: false, selected: false, error: "OPTION_SELECTION_FAILED" };
    }

    // Resolve each option element to its per-option row root container
    if (options.length >= 2) {
      const resolved = options.map(el => resolveOptionRowRoot(el, options));
      const unique = [];
      for (const r of resolved) {
        if (!unique.includes(r)) unique.push(r);
      }
      if (unique.length === options.length) {
        options = unique;
      }
    }

    let targetIndex = null;
    if (payload && typeof payload.targetIndex === "number" && payload.targetIndex >= 0) {
      targetIndex = payload.targetIndex;
    } else if (payload && typeof payload.selected_index === "number" && payload.selected_index >= 0) {
      targetIndex = payload.selected_index;
    }

    // Check if payload.letter, payload.canonical_key, or payload.answer is a single synthetic letter "A"–"F"
    let syntheticLetter = "";
    if (payload && typeof payload.letter === "string" && /^[A-F]$/i.test(payload.letter.trim())) {
      syntheticLetter = payload.letter.trim().toUpperCase();
    } else if (payload && typeof payload.canonical_key === "string" && /^[A-F]$/i.test(payload.canonical_key.trim())) {
      syntheticLetter = payload.canonical_key.trim().toUpperCase();
    } else if (payload && typeof payload.answer === "string" && /^[A-F]$/i.test(payload.answer.trim())) {
      syntheticLetter = payload.answer.trim().toUpperCase();
    }

    // If targetIndex is not explicitly set, convert single letter "A"–"F" to 0–5 index
    if (targetIndex === null && syntheticLetter) {
      targetIndex = syntheticLetter.charCodeAt(0) - 65;
    }

    // Never try to text-match a single synthetic letter "A"–"F" against full option strings!
    let rawTargetText = (payload && (payload.targetText || payload.selected_text)) || null;
    if (!rawTargetText && payload && payload.answer && !/^[A-F]$/i.test(String(payload.answer).trim())) {
      rawTargetText = payload.answer;
    }

    // Clean text representations of all options using 1:1 extractor-identical logic
    const optionCleanTexts = options.map((optEl) => {
      const hasCode = !!(optEl.querySelector && optEl.querySelector("pre, code")) || (optEl.tagName && ["pre", "code"].includes(optEl.tagName.toLowerCase()));
      const raw = getCleanVisibleText(optEl, hasCode);
      return normalizeOptionWhitespace(raw, hasCode);
    });

    const targetHasCode = rawTargetText ? (rawTargetText.includes("\n") || /^\s*(def|class|import|return|for|while|if|else|print)\b/.test(rawTargetText)) : false;
    const cleanTargetText = rawTargetText ? normalizeOptionWhitespace(rawTargetText, targetHasCode) : null;

    // 1. Exact normalized text match (cleanOptText === cleanTargetText)
    if (cleanTargetText) {
      const exactIdx = optionCleanTexts.findIndex((optText) => optText && optText === cleanTargetText);
      if (exactIdx !== -1) {
        targetIndex = exactIdx;
      } else {
        // 2. Case-insensitive normalized text match
        const ciIdx = optionCleanTexts.findIndex((optText) => {
          if (!optText) return false;
          if (!targetHasCode && !optText.includes("\n")) {
            return optText.toLowerCase() === cleanTargetText.toLowerCase();
          }
          return false;
        });
        if (ciIdx !== -1) {
          targetIndex = ciIdx;
        }
      }
    }

    // 2.5 Single letter fallback if cleanTargetText is "A"–"F" and targetIndex unresolved
    if ((targetIndex === null || targetIndex === undefined) && cleanTargetText && /^[A-F]$/i.test(cleanTargetText.trim())) {
      const allMultiChar = optionCleanTexts.every(t => !t || t.trim().length > 1);
      if (allMultiChar) {
        targetIndex = cleanTargetText.trim().toUpperCase().charCodeAt(0) - 65;
      }
    }

    // 3. Valid targetIndex fallback (0 <= targetIndex < options.length)
    if (targetIndex === null || typeof targetIndex !== "number" || targetIndex < 0 || targetIndex >= options.length) {
      return {
        ok: false,
        success: false,
        selected: false,
        error: "OPTION_SELECTION_FAILED"
      };
    }

    const targetEl = options[targetIndex];

    // Remember last selected option for auto-mode retry & validation recovery
    if (typeof window !== "undefined") {
      window.__QUIZZY_LAST_SELECTED_OPTION__ = targetEl;
      window.__QUIZZY_LAST_ACTION_PAYLOAD__ = payload;
    }

    // MANDATORY PRE-SUBMIT SELECTION VERIFICATION GATE
    const preClickSnapshot = capturePreClickSnapshot(targetEl, options, doc);

    // Attempt 1: Full React selection event cascade
    triggerReactSelection(targetEl);

    // Verify selection signal
    let selected = verifyOptionSelected(targetEl, options, preClickSnapshot, doc);

    // Retry on unverified selection: targeted inner child click + elementFromPoint
    if (!selected) {
      const innerTarget = targetEl.firstElementChild || (targetEl.querySelector ? targetEl.querySelector("input, label, span, div") : null) || targetEl;
      dispatchRealisticClick(innerTarget, true);

      if (doc && typeof doc.elementFromPoint === "function" && typeof targetEl.getBoundingClientRect === "function") {
        try {
          const rect = targetEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const pointEl = doc.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            if (pointEl && pointEl !== targetEl) {
              dispatchRealisticClick(pointEl, true);
            }
          }
        } catch (_) {}
      }

      selected = verifyOptionSelected(targetEl, options, preClickSnapshot, doc);
    }

    // HARD ABORT RULE: If selection verification failed after retry, return failure
    if (!selected) {
      return {
        ok: false,
        success: false,
        selected: false,
        error: "OPTION_SELECTION_FAILED"
      };
    }

    return {
      ok: true,
      success: true,
      selected: true,
      action: "mcq_click",
      selected_index: targetIndex,
      option_text: optionCleanTexts[targetIndex] || cleanText(targetEl.innerText || targetEl.textContent)
    };
  }

  /**
   * Executes React/Vue/Angular compatible text input entry.
   */
  function executeTextAction(payload) {
    const textVal = payload.answer || payload.selected_text || "";
    const doc = (typeof document !== "undefined") ? document : null;
    if (!doc) return { success: false, error: "No document" };

    let inputEl = null;
    if (payload.textInputSelector) {
      inputEl = doc.querySelector(payload.textInputSelector);
    }

    if (!inputEl) {
      const inputHeuristics = [
        "[data-quiz-input]",
        "input.quiz-input",
        "input.fill-blank",
        "textarea.quiz-input",
        ".question-container input[type='text']",
        ".question-container textarea",
        "input[type='text']:not([aria-hidden='true'])",
        "textarea:not([aria-hidden='true'])",
        "input:not([type]):not([aria-hidden='true'])"
      ];
      for (const sel of inputHeuristics) {
        const el = doc.querySelector(sel);
        if (el && isVisible(el)) {
          inputEl = el;
          break;
        }
      }
    }

    if (!inputEl) {
      return { success: false, error: "Target text input element not found on page." };
    }

    try {
      inputEl.focus();
    } catch (e) {}

    // Use native prototype property descriptor to bypass React/Vue value interception
    try {
      const isTextArea = inputEl.tagName.toLowerCase() === "textarea";
      const prototype = isTextArea
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

      if (descriptor && descriptor.set) {
        descriptor.set.call(inputEl, textVal);
      } else {
        inputEl.value = textVal;
      }
    } catch (e) {
      inputEl.value = textVal;
    }

    // Dispatch input and change events
    try {
      inputEl.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (e) {}

    return {
      success: true,
      action: "text_fill",
      value: textVal
    };
  }

  /**
   * Helper to create a synthetic DataTransfer instance for HTML5 drag events.
   */
  function createSyntheticDataTransfer() {
    const dataStore = {};
    return {
      dropEffect: "move",
      effectAllowed: "all",
      files: [],
      items: [],
      types: [],
      setData: function (format, data) {
        dataStore[format] = data;
        if (!this.types.includes(format)) this.types.push(format);
      },
      getData: function (format) {
        return dataStore[format] || "";
      },
      clearData: function (format) {
        if (format) {
          delete dataStore[format];
          const idx = this.types.indexOf(format);
          if (idx !== -1) this.types.splice(idx, 1);
        } else {
          this.types = [];
        }
      }
    };
  }

  /**
   * Dispatches a full HTML5 drag-and-drop sequence between source and target elements.
   */
  function simulateDragDrop(sourceEl, targetEl) {
    if (!sourceEl || !targetEl || sourceEl === targetEl) return;
    const dt = createSyntheticDataTransfer();

    function fireDragEvent(type, el) {
      let ev;
      try {
        ev = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          dataTransfer: dt
        });
      } catch (e) {
        // Fallback for environments where DragEvent constructor is restricted
        ev = document.createEvent("CustomEvent");
        ev.initCustomEvent(type, true, true, null);
        ev.dataTransfer = dt;
      }
      el.dispatchEvent(ev);
    }

    fireDragEvent("dragstart", sourceEl);
    fireDragEvent("dragenter", targetEl);
    fireDragEvent("dragover", targetEl);
    fireDragEvent("drop", targetEl);
    fireDragEvent("dragend", sourceEl);
  }

  /**
   * Executes verified Order reordering with post-drag order check.
   * If simulated drag events do not cause the host page elements to reorder,
   * cleanly returns unmoved: true so Auto Mode can safely pause.
   */
  function executeOrderAction(payload) {
    const permutationIndices = payload.permutation_indices;
    const orderedTexts = payload.ordered_texts || [];

    if (!Array.isArray(permutationIndices) || permutationIndices.length < 2) {
      return { success: false, error: "Invalid permutation_indices for order action." };
    }

    const elements = findOptionElements(payload.optionsSelector);
    if (elements.length !== permutationIndices.length) {
      return {
        success: false,
        error: `Element count mismatch: found ${elements.length} blocks, expected ${permutationIndices.length}`
      };
    }

    // Capture initial text order before drag simulation
    const initialTexts = elements.map(el => cleanText(el.innerText || el.textContent));

    // Attempt sequential pairwise drag swaps based on target permutation
    // permutationIndices[targetSlot] = originalBlockIndex
    for (let targetSlot = 0; targetSlot < permutationIndices.length; targetSlot++) {
      const origIndex = permutationIndices[targetSlot];
      if (origIndex !== targetSlot && elements[origIndex] && elements[targetSlot]) {
        simulateDragDrop(elements[origIndex], elements[targetSlot]);
      }
    }

    // Post-drag verification: check if host DOM elements actually changed order
    const updatedElements = findOptionElements(payload.optionsSelector);
    const postTexts = updatedElements.map(el => cleanText(el.innerText || el.textContent));

    // Check if elements match orderedTexts
    let matchesTarget = true;
    if (orderedTexts.length === postTexts.length) {
      for (let i = 0; i < orderedTexts.length; i++) {
        if (!postTexts[i].includes(cleanText(orderedTexts[i])) && !cleanText(orderedTexts[i]).includes(postTexts[i])) {
          matchesTarget = false;
          break;
        }
      }
    } else {
      matchesTarget = false;
    }

    // Check if any change occurred at all
    const hasMoved = JSON.stringify(initialTexts) !== JSON.stringify(postTexts);

    if (!matchesTarget) {
      return {
        success: false,
        unmoved: !hasMoved,
        action: "order_swap_attempted",
        reason: hasMoved
          ? "Blocks shifted but do not match verified target sequence. Safe manual pause required."
          : "Host page drag library did not respond to synthetic DragEvents. Safe manual swap required.",
        current_order: postTexts,
        target_order: orderedTexts
      };
    }

    return {
      success: true,
      action: "order_reordered",
      verified: true
    };
  }

  /**
   * Finds and clicks the Next / Submit / Advance question button on the host page.
   * Handles the two-step SUBMIT -> NEXT button flow for quiz platforms like learning.ccbp.in.
   */
  async function clickNextButton(customNextSelector) {
    const doc = (typeof document !== "undefined") ? document : null;
    if (!doc) return { success: false, error: "No document" };

    // Ignore non-advance buttons like SHOW ANSWER, SKIP, END PRACTICE, HINT, PREVIOUS, BACK, REPORT
    function isIgnoredButton(btn) {
      if (!btn) return true;
      const t = cleanText(btn.innerText || btn.textContent || btn.value || btn.getAttribute("aria-label") || "").toLowerCase();
      if (/^(?:show answer|skip|end practice|practice instructions|reset|cancel|hint|previous|prev|back|report|report an issue|review)\b/i.test(t)) {
        return true;
      }
      return false;
    }

    function isNextCandidate(btn) {
      if (!btn || isIgnoredButton(btn) || btn.disabled) return false;
      const t = cleanText(btn.innerText || btn.textContent || btn.value || btn.getAttribute("aria-label") || "").toLowerCase();
      if (/^(?:next|continue|advance|forward|next question)\b/i.test(t)) return true;
      if (btn.matches && (btn.matches("[data-quiz-next]") || btn.matches(".btn-next") || btn.matches(".next-btn") || btn.matches(".quiz-next") || btn.matches(".next-button"))) return true;
      return false;
    }

    function isSubmitCandidate(btn) {
      if (!btn || isIgnoredButton(btn) || btn.disabled) return false;
      const t = cleanText(btn.innerText || btn.textContent || btn.value || btn.getAttribute("aria-label") || "").toLowerCase();
      if (/^(?:submit|check answer|check|submit answer)\b/i.test(t)) return true;
      if (btn.type === "submit" && !isNextCandidate(btn)) return true;
      return false;
    }

    function findReadyNext(customSelector) {
      if (customSelector) {
        try {
          const el = doc.querySelector(customSelector);
          if (el && isVisible(el) && !el.disabled && !isIgnoredButton(el)) {
            return el;
          }
        } catch (e) {}
      }

      const allButtons = Array.from(doc.querySelectorAll(
        "button, a.btn, [role='button'], input[type='button'], input[type='submit']"
      )).filter(isVisible);

      const candidate = allButtons.find(isNextCandidate);
      if (candidate) return candidate;

      const nextHeuristics = [
        "[data-quiz-next]",
        "#next-question",
        ".btn-next",
        ".next-btn",
        "button.quiz-next",
        "button.next-button"
      ];
      for (const sel of nextHeuristics) {
        try {
          const el = doc.querySelector(sel);
          if (el && isVisible(el) && !el.disabled && !isIgnoredButton(el)) {
            return el;
          }
        } catch (e) {}
      }
      return null;
    }

    // (A) Check if NEXT button is ALREADY visible and enabled
    const directNext = findReadyNext(customNextSelector);
    if (directNext) {
      const clicked = dispatchClick(directNext);
      const btnText = cleanText(directNext.innerText || directNext.textContent || directNext.value || "Next");
      return {
        ok: clicked,
        success: clicked,
        step: "next_direct",
        action: "next_button_clicked",
        button_text: btnText
      };
    }

    function isQuizCompleted(d) {
      if (!d) return false;
      const root = d.body || d;
      const bodyText = (root.innerText || root.textContent || "").toLowerCase();

      // NEVER treat "END PRACTICE" as completion
      // 1. Dedicated completion summary view or congratulatory screens
      if (/(?:quiz\s*summary|practice\s*summary|view\s*report|view\s*results|score\s*card|congratulations|assessment\s*completed)/i.test(bodyText)) {
        if (!bodyText.includes("end practice") || /(?:view\s*report|score\s*card|congratulations|practice\s*summary)/i.test(bodyText)) {
          return true;
        }
      }

      // 2. Check for explicit finish / view report buttons (EXCLUDING "End Practice", "Skip", "Show Answer")
      const btns = Array.from(d.querySelectorAll("button, a.btn, [role='button'], input[type='button']")).filter(isVisible);
      for (const b of btns) {
        const bText = cleanText(b.innerText || b.textContent || b.value || "").toLowerCase();
        if (bText.includes("end practice") || bText === "skip" || bText === "show answer") {
          continue; // EXPLICITLY IGNORE
        }
        if (/^(?:finish|view\s*report|view\s*results|review\s*test)\b/i.test(bText)) {
          return true;
        }
      }

      // 3. Check "QUESTIONS ATTEMPTED: X/Y" where X === Y and X > 0
      const match = bodyText.match(/questions?\s*attempted\s*:\s*(\d+)\s*\/\s*(\d+)/i);
      if (match && match[1] && match[2]) {
        const attempted = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (total > 0 && attempted >= total) {
          return true;
        }
      }

      return false;
    }

    // (B) If not, check if a SUBMIT button is present (two-step submit -> next)
    const allButtons = Array.from(doc.querySelectorAll(
      "button, a.btn, [role='button'], input[type='button'], input[type='submit']"
    )).filter(isVisible);

    const submitBtn = allButtons.find(isSubmitCandidate);
    if (submitBtn) {
      const submitText = cleanText(submitBtn.innerText || submitBtn.textContent || submitBtn.value || "Submit");
      dispatchClick(submitBtn);

      // Deterministic polling: check every 120ms up to 4500ms for NEXT button to appear/enable
      const pollIntervalMs = 120;
      const maxWaitMs = 4500;
      let waitedMs = 0;
      let postNext = null;
      let retriedOptionSelect = false;

      while (waitedMs < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        waitedMs += pollIntervalMs;

        postNext = findReadyNext(customNextSelector);
        if (postNext) {
          break;
        }

        // Check if "Please select an option" validation error appeared, OR after 360ms of waiting, SUBMIT hasn't transitioned
        const pageText = (doc.body ? doc.body.innerText || doc.body.textContent : doc.documentElement.textContent || "").toLowerCase();
        const hasSelectOptionError = /please\s*select\s*an?\s*(?:option|answer)|select\s*an?\s*option/i.test(pageText);

        if (!retriedOptionSelect && (hasSelectOptionError || waitedMs >= 360)) {
          const lastOpt = (typeof window !== "undefined") ? window.__QUIZZY_LAST_SELECTED_OPTION__ : null;
          if (lastOpt && typeof triggerOptionSelect === "function") {
            retriedOptionSelect = true;
            // Perform alternate deep click fallback on last selected option
            triggerOptionSelect(lastOpt);
            // Also directly click firstElementChild (circle) and lastElementChild (text) if present
            if (lastOpt.firstElementChild) {
              dispatchClick(lastOpt.firstElementChild);
            }
            if (lastOpt.lastElementChild && lastOpt.lastElementChild !== lastOpt.firstElementChild) {
              dispatchClick(lastOpt.lastElementChild);
            }
            // Wait 200ms for React state commit
            await new Promise((resolve) => setTimeout(resolve, 200));
            waitedMs += 200;
            // Re-click submit button
            const currentSub = doc.querySelector("button[type='submit'], input[type='submit'], button.btn-submit") || submitBtn;
            if (currentSub && isVisible(currentSub) && !currentSub.disabled) {
              dispatchClick(currentSub);
            }
          }
        }
      }

      // If NEXT button appeared, click it and return submit_then_next ALWAYS,
      // even if "QUESTIONS ATTEMPTED: 15/15" was on the page (e.g. during re-practice)!
      if (postNext) {
        const nextClicked = dispatchClick(postNext);
        const nextText = cleanText(postNext.innerText || postNext.textContent || postNext.value || "Next Question");
        return {
          ok: nextClicked,
          success: nextClicked,
          step: "submit_then_next",
          action: "submit_then_next_clicked",
          button_text: `${submitText} -> ${nextText}`,
          waited_ms: waitedMs
        };
      }

      // If no NEXT button rendered after submit within maxWaitMs:
      // Only now evaluate whether the quiz is actually completed!
      // Check if submit button became disabled or disappeared (or feedback appeared)
      const currentSubmit = doc.querySelector("button[type='submit'], input[type='submit'], button.btn-submit") || submitBtn;
      const submitGoneOrDisabled = !currentSubmit || !isVisible(currentSubmit) || currentSubmit.disabled;

      if (submitGoneOrDisabled && isQuizCompleted(doc)) {
        return {
          ok: true,
          success: true,
          step: "quiz_completed",
          action: "quiz_completed",
          button_text: submitText,
          waited_ms: waitedMs,
          reason: "Final question submitted; quiz completed."
        };
      }

      // If submit button is still enabled and no next button appeared, return next_timeout
      if (currentSubmit && isVisible(currentSubmit) && !currentSubmit.disabled) {
        return {
          ok: false,
          success: false,
          step: "next_timeout",
          error: "NEXT QUESTION did not appear within 4500ms after SUBMIT (Submit button is still enabled; submission may have failed)."
        };
      }

      return {
        ok: false,
        success: false,
        step: "next_timeout",
        error: "NEXT QUESTION did not appear within 4500ms after SUBMIT."
      };
    }

    // (C) If neither Next nor Submit found, check if dedicated completion summary screen is active
    if (isQuizCompleted(doc)) {
      return {
        ok: true,
        success: true,
        step: "quiz_completed",
        action: "quiz_completed",
        reason: "Quiz completion detected."
      };
    }

    return {
      ok: false,
      success: false,
      error: "Next / Continue button not found. Please specify 'Next Button Selector' in Settings."
    };
  }

  /**
   * Main router for executing quiz actions.
   */
  function executeAction(payload) {
    if (!payload || (!payload.q_type && !payload.question_type)) {
      return { ok: false, success: false, selected: false, error: "Payload missing q_type" };
    }

    const qType = String(payload.q_type || payload.question_type).toLowerCase().trim();

    let res;
    if (qType === "mcq") {
      res = executeMcqAction(payload);
    } else if (qType === "text") {
      res = executeTextAction(payload);
    } else if (qType === "order") {
      res = executeOrderAction(payload);
    } else {
      return { ok: false, success: false, selected: false, error: `Unsupported action q_type: ${qType}` };
    }

    if (res && (res.selected === false || res.ok === false || res.success === false)) {
      return Object.assign({}, res, {
        ok: false,
        success: false,
        selected: false,
        error: res.error || "OPTION_SELECTION_FAILED"
      });
    }

    return Object.assign({}, res, {
      ok: res.ok !== undefined ? res.ok : res.success,
      selected: res.selected !== undefined ? res.selected : res.success
    });
  }

  // Idempotent Escape key listener for host page emergency kill switch
  if (typeof window !== "undefined") {
    if (!window.__QUIZZY_EXECUTOR_LISTENER_REGISTERED__) {
      window.__QUIZZY_EXECUTOR_LISTENER_REGISTERED__ = true;

      if (typeof window.addEventListener === "function") {
        window.addEventListener("keydown", (e) => {
          if (e.key === "Escape" || e.key === "Esc") {
            try {
              if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                  action: "KILL_SWITCH_TRIGGERED",
                  reason: "Escape key pressed on host quiz page. Auto Mode halted."
                }).catch(() => {});
              }
            } catch (err) {}
          }
        }, true);
      }
    }
  }

  // Export to window for Chrome isolated world execution and module for testing
  const QuizZyExecutor = {
    cleanText,
    normalizeTeX,
    getCleanVisibleText,
    stripDecorativePrefix,
    isHeaderOrNavText,
    containsActionButtonOrFooter,
    isExplanationOrFeedback,
    isVisible,
    isRadioOrOptionVisible,
    findQuizCard,
    findClasslessOptionElements,
    getElementCssPath,
    deduplicateOptionElements,
    resolveOptionRowRoot,
    dispatchClick,
    dispatchRealisticClick,
    resolveOptionRowAndTargets,
    captureOptionSnapshot,
    capturePreClickSnapshot,
    verifyOptionSelected,
    didOptionSelectionChange,
    findOptionElements,
    triggerOptionSelect,
    triggerReactSelection,
    executeMcqAction,
    executeTextAction,
    simulateDragDrop,
    executeOrderAction,
    clickNextButton,
    executeAction,
    executeQuizAction: executeAction,
    isQuizZyInternalElement
  };

  if (typeof window !== "undefined") {
    window.QuizZyExecutor = QuizZyExecutor;
    window.__QuizZyExecutor = QuizZyExecutor;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = QuizZyExecutor;
  }

  return QuizZyExecutor;
})();
