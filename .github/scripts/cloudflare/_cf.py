"""Tiny Cloudflare API helper (standard library only). Never prints the token."""
import json, os, urllib.error, urllib.request

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACC = os.environ["CLOUDFLARE_ACCOUNT_ID"]
BASE = "https://api.cloudflare.com/client/v4"


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, method=method, data=data,
                                 headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"success": False, "errors": [{"message": raw[:200]}]}


def errors(payload):
    return [f"{e.get('code')}: {e.get('message')}" for e in (payload.get("errors") or [])]


def summary(status, payload, pick=None):
    out = {"http": status, "ok": bool(payload.get("success")), "errors": errors(payload)}
    if pick is not None and payload.get("success"):
        out["data"] = pick(payload.get("result"))
    return out
