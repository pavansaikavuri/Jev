"""QuizZy FastAPI Backend Entry Point with Windows platform stability guard."""
import sys
import types
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Guard against Win32 _multiprocessing.pyd architecture DLL mismatch on Windows
if "_multiprocessing" not in sys.modules:
    try:
        import _multiprocessing
    except Exception:
        m = types.ModuleType("_multiprocessing")
        m.closesocket = lambda *a: None
        m.send = lambda *a: None
        m.recv = lambda *a: None
        sys.modules["_multiprocessing"] = m

# Safe logging streams when running windowless under pythonw.exe
if sys.stdout is None:
    try:
        sys.stdout = open(PROJECT_ROOT / "backend" / "server.log", "a", encoding="utf-8")
    except Exception:
        pass
if sys.stderr is None:
    try:
        sys.stderr = open(PROJECT_ROOT / "backend" / "server.err.log", "a", encoding="utf-8")
    except Exception:
        pass

import uvicorn
from backend.app import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
