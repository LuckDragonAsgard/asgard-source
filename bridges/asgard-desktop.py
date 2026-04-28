#!/usr/bin/env python3
"""Asgard Desktop Helper — gives Asgard control of your native desktop.

Polls asgard-ai's /bridge/poll endpoint for desktop_* commands, executes them
locally with pyautogui, posts results back.

Setup (one-time):
    pip install pyautogui pillow requests

Run:
    python asgard-desktop.py

Or set ASGARD_PIN environment variable for non-default PIN:
    ASGARD_PIN=2967 python asgard-desktop.py

Stops with Ctrl+C.
"""

import os, sys, time, json, base64, io, subprocess, traceback

try:
    import requests
except ImportError:
    print("ERROR: pip install requests")
    sys.exit(1)

try:
    import pyautogui
except ImportError:
    print("ERROR: pip install pyautogui pillow")
    sys.exit(1)

ASGARD_AI = os.environ.get("ASGARD_AI_URL", "https://asgard-ai.pgallivan.workers.dev")
PIN = os.environ.get("ASGARD_PIN", "")  # set ASGARD_PIN env or edit before running
UID = os.environ.get("ASGARD_UID", "paddy-desktop")
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "2.0"))

pyautogui.FAILSAFE = True   # move mouse to top-left to abort
pyautogui.PAUSE = 0.05      # tiny pause between actions


def screenshot(region=None):
    img = pyautogui.screenshot(region=tuple(region) if region else None)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return {"ok": True, "image_data_url": "data:image/png;base64," + b64, "size": len(buf.getvalue()), "width": img.width, "height": img.height}


def click(x, y, button="left", double=False):
    if double:
        pyautogui.doubleClick(x, y, button=button)
    else:
        pyautogui.click(x, y, button=button)
    return {"ok": True, "x": x, "y": y, "button": button, "double": double}


def type_text(text):
    pyautogui.typewrite(text, interval=0.01)
    return {"ok": True, "typed_chars": len(text)}


def press_keys(combo):
    parts = [p.strip().lower() for p in combo.replace("+", " ").split() if p.strip()]
    # Normalise modifier names
    norm = {"cmd": "command", "win": "winleft", "windows": "winleft", "control": "ctrl", "option": "alt", "esc": "escape"}
    keys = [norm.get(p, p) for p in parts]
    if len(keys) == 1:
        pyautogui.press(keys[0])
    else:
        pyautogui.hotkey(*keys)
    return {"ok": True, "keys": keys}


def run(command):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return {"ok": result.returncode == 0, "code": result.returncode, "stdout": result.stdout[:8000], "stderr": result.stderr[:4000]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout (30s)"}


def execute(cmd):
    t = cmd.get("type")
    inp = cmd.get("input") or {}
    try:
        if t == "screenshot":
            return screenshot(inp.get("region"))
        if t == "click":
            return click(inp["x"], inp["y"], inp.get("button", "left"), inp.get("double", False))
        if t == "type":
            return type_text(inp["text"])
        if t == "key":
            return press_keys(inp["keys"])
        if t == "run":
            return run(inp["command"])
        return {"ok": False, "error": "unknown type: " + str(t)}
    except Exception as e:
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()[:500]}


def main():
    print("Asgard Desktop helper — polling " + ASGARD_AI + " as uid=" + UID)
    print("PIN: " + PIN[:1] + "***  (set ASGARD_PIN env to change)")
    print("Press Ctrl+C to stop. Failsafe: drag mouse to top-left corner to abort actions.")
    headers = {"X-Pin": PIN, "Content-Type": "application/json"}
    while True:
        try:
            r = requests.get(ASGARD_AI + "/bridge/poll?uid=" + UID, headers={"X-Pin": PIN}, timeout=10)
            data = r.json()
            if data.get("idle"):
                time.sleep(POLL_INTERVAL); continue
            cmd_id = data.get("id")
            cmd = data.get("command") or {}
            print("→ " + (cmd.get("type", "?")) + "  " + json.dumps(cmd.get("input", {}))[:120])
            result = execute(cmd)
            r2 = requests.post(ASGARD_AI + "/bridge/result", headers=headers, json={"id": cmd_id, "result": result}, timeout=15)
            print("  ✓ posted result (" + ("ok" if result.get("ok") else "err") + ")")
        except KeyboardInterrupt:
            print("\nStopped.")
            return
        except Exception as e:
            print("  ! " + str(e))
            time.sleep(POLL_INTERVAL * 2)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
