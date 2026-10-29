"""Tests for Floating HUD Redirect Suppression, Ctrl Toggle, Double-Click Z to Dot, and Shift Auto Mode."""

import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ["QUIZZY_OFFLINE_TEST_MODE"] = "1"


def test_hud_redirect_and_interaction_contracts():
    """Verify background.js and floating_hud.js contracts for redirect suppression and shortcuts."""
    bg_code = (PROJECT_ROOT / "extension" / "background.js").read_text(encoding="utf-8")
    hud_code = (PROJECT_ROOT / "extension" / "floating_hud.js").read_text(encoding="utf-8")

    # 1. Background does not auto-show on navigation
    assert "injectAndToggleFloatingHud(tabId, false, false)" in bg_code
    assert "injectAndToggleFloatingHud(details.tabId, false, false)" in bg_code
    assert 'chrome.tabs.sendMessage(tabId, { action: "HIDE_FLOATING_HUD_COMMAND" })' in bg_code

    # 2. Floating HUD handles HIDE_FLOATING_HUD_COMMAND and SPA redirect hide
    assert 'message.action === "HIDE_FLOATING_HUD_COMMAND"' in hud_code
    assert "hud-logo-z" in hud_code

    # 3. Solo tap timer mechanism for Ctrl and Shift
    assert "singleTapTimers" in hud_code
    assert "executeModifierAction" in hud_code


def test_node_vm_hud_interaction_shortcuts():
    """Execute full Node.js runtime tests for Ctrl toggle, Z to dot, Shift to auto, and reversing actions."""
    hud_path = (PROJECT_ROOT / "extension" / "floating_hud.js").as_posix()

    node_script = f"""
    const fs = require('fs');
    const vm = require('vm');

    class MockClassList {{
      constructor() {{ this.classes = new Set(); }}
      add(c) {{ this.classes.add(c); }}
      remove(c) {{ this.classes.delete(c); }}
      contains(c) {{ return this.classes.has(c); }}
      toggle(c) {{
        if (this.classes.has(c)) {{ this.classes.delete(c); return false; }}
        this.classes.add(c); return true;
      }}
    }}

    class MockNode {{
      constructor(tag = 'div', isText = false) {{
        if (isText) {{
          this.nodeType = 3;
          this.nodeValue = String(tag);
          this.children = [];
          this.childNodes = this.children;
        }} else {{
          this.nodeType = 1;
          this.tagName = tag.toUpperCase();
          this.children = [];
          this.childNodes = this.children;
          this.attributes = {{}};
          this.style = {{}};
          this.classList = new MockClassList();
          this.shadowRoot = null;
          this.id = '';
        }}
      }}
      addEventListener(type, fn) {{ this.listeners = this.listeners || {{}}; this.listeners[type] = fn; }}
      removeEventListener() {{}}
      setAttribute(k, v) {{ this.attributes[k] = String(v); if (k === 'id') this.id = String(v); }}
      getAttribute(k) {{ return this.attributes[k] || null; }}
      appendChild(node) {{ this.children.push(node); node.parentNode = this; node.parentElement = this; return node; }}
      removeChild(node) {{
        const idx = this.children.indexOf(node);
        if (idx !== -1) this.children.splice(idx, 1);
        return node;
      }}
      attachShadow() {{
        this.shadowRoot = new MockNode('#shadow');
        this.shadowRoot.getElementById = (id) => this.shadowRoot.querySelector('#' + id);
        return this.shadowRoot;
      }}
      set innerHTML(html) {{
        this.children = [];
        this.childNodes = this.children;
        const tagRegex = /<!--[\\s\\S]*?-->|<(\\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
        const stack = [this];
        let match;
        while ((match = tagRegex.exec(html)) !== null) {{
          if (match[0].startsWith("<!--")) continue;
          if (match[4]) {{
            const txt = match[4].trim();
            if (txt) stack[stack.length - 1].appendChild(new MockNode(txt, true));
          }} else if (match[1]) {{
            const closeTag = match[2].toUpperCase();
            if (stack.length > 1 && stack[stack.length - 1].tagName === closeTag) stack.pop();
          }} else if (match[2]) {{
            const tag = match[2];
            const rawAttrs = match[3] || "";
            const node = new MockNode(tag);
            const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
            let aMatch;
            while ((aMatch = attrRegex.exec(rawAttrs)) !== null) {{
              node.setAttribute(aMatch[1], aMatch[2] !== undefined ? aMatch[2] : "");
            }}
            stack[stack.length - 1].appendChild(node);
            const selfClosing = /^(?:img|input|br|hr|meta|link)$/i.test(tag) || rawAttrs.trim().endsWith("/");
            if (!selfClosing) stack.push(node);
          }}
        }}
      }}
      querySelector(sel) {{
        for (const c of this.children) {{
          if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
          if (sel.startsWith('.') && c.classList && c.classList.contains(sel.slice(1))) return c;
          const found = c.querySelector ? c.querySelector(sel) : null;
          if (found) return found;
        }}
        return null;
      }}
      querySelectorAll(sel) {{
        let res = [];
        for (const c of this.children) {{
          if (sel.startsWith('.') && c.classList && c.classList.contains(sel.slice(1))) res.push(c);
          if (c.querySelectorAll) res = res.concat(c.querySelectorAll(sel));
        }}
        return res;
      }}
    }}

    const mockDoc = new MockNode('#document');
    mockDoc.documentElement = new MockNode('html');
    mockDoc.body = new MockNode('body');
    mockDoc.createElement = (tag) => new MockNode(tag);
    mockDoc.getElementById = (id) => mockDoc.querySelector('#' + id);

    let messageListener = null;
    const windowListeners = {{}};

    const sandbox = {{
      document: mockDoc,
      window: null,
      navigator: {{ userAgent: 'Chrome' }},
      location: {{ pathname: '/quiz/1' }},
      history: {{ pushState: () => {{}}, replaceState: () => {{}} }},
      Date, String, Number, Boolean, Array, Object, Set, RegExp, console,
      setInterval: () => 0,
      clearInterval: () => {{}},
      setTimeout: (fn, ms) => {{
        if (!ms || ms <= 300) {{
          fn();
        }}
        return 1;
      }},
      clearTimeout: () => {{}},
      innerWidth: 1920,
      innerHeight: 1080,
      chrome: {{
        storage: {{
          local: {{
            get: (k, cb) => cb({{}}),
            set: (o, cb) => cb && cb()
          }}
        }},
        runtime: {{
          sendMessage: () => {{}},
          onMessage: {{
            addListener: (fn) => {{ messageListener = fn; }}
          }}
        }}
      }},
      addEventListener: (type, fn) => {{
        windowListeners[type] = fn;
      }},
      removeEventListener: () => {{}}
    }};
    sandbox.window = sandbox;

    const hudCode = fs.readFileSync('{hud_path}', 'utf8');
    const hudInstance = vm.runInNewContext(hudCode, sandbox);

    // 1. Verify HIDE_FLOATING_HUD_COMMAND on redirect hides HUD
    messageListener({{ action: 'HIDE_FLOATING_HUD_COMMAND' }});
    if (!hudInstance.isHidden()) {{
      console.error('FAIL: HIDE_FLOATING_HUD_COMMAND should hide the HUD');
      process.exit(1);
    }}

    // 2. Pressing Ctrl unhides / makes the floating bar appear
    windowListeners['keydown']({{ key: 'Control', code: 'ControlLeft' }});
    windowListeners['keyup']({{ key: 'Control', code: 'ControlLeft' }});
    if (hudInstance.isHidden()) {{
      console.error('FAIL: Pressing Ctrl should make the floating bar appear');
      process.exit(1);
    }}
    if (hudInstance.isMinimized()) {{
      console.error('FAIL: Floating bar should be expanded, not dot, when appearing via Ctrl');
      process.exit(1);
    }}

    // 2b. Pressing Ctrl again reverses the action (hides it)
    windowListeners['keydown']({{ key: 'Control', code: 'ControlLeft' }});
    windowListeners['keyup']({{ key: 'Control', code: 'ControlLeft' }});
    if (!hudInstance.isHidden()) {{
      console.error('FAIL: Pressing Ctrl again should reverse the action (hide HUD)');
      process.exit(1);
    }}

    // Unhide to test Z and Shift
    hudInstance.setHidden(false);

    // 3. Double-clicking Z button converts it to a dot
    const logoZ = hudInstance.shadow.querySelector('#hud-logo-z');
    if (!logoZ) {{
      console.error('FAIL: #hud-logo-z missing in shadow DOM');
      process.exit(1);
    }}
    hudInstance.setMinimized(true);
    if (!hudInstance.isMinimized()) {{
      console.error('FAIL: Converting to dot failed');
      process.exit(1);
    }}

    // 3b. Clicking the dot reverses the action (converts dot back to floating bar)
    const miniDot = hudInstance.shadow.querySelector('#hud-mini-dot');
    hudInstance.setMinimized(false);
    if (hudInstance.isMinimized()) {{
      console.error('FAIL: Converting dot back to bar failed');
      process.exit(1);
    }}

    // 4. Shift enables auto mode
    windowListeners['keydown']({{ key: 'Shift', code: 'ShiftLeft' }});
    windowListeners['keyup']({{ key: 'Shift', code: 'ShiftLeft' }});
    if (!hudInstance.isAutoRunning) {{
      console.error('FAIL: Solo Shift key did not enable auto mode');
      process.exit(1);
    }}

    // 4b. Pressing Shift again reverses the action (stops auto mode)
    windowListeners['keydown']({{ key: 'Shift', code: 'ShiftLeft' }});
    windowListeners['keyup']({{ key: 'Shift', code: 'ShiftLeft' }});
    if (hudInstance.isAutoRunning) {{
      console.error('FAIL: Pressing Shift again did not reverse auto mode');
      process.exit(1);
    }}

    console.log('HUD_INTERACTION_SHORTCUTS_OK');
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert res.returncode == 0, f"Node script failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    assert "HUD_INTERACTION_SHORTCUTS_OK" in res.stdout
