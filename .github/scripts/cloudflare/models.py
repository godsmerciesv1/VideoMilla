"""Lists the Workers AI model IDs the blueprint relies on, as Cloudflare names them today. No secrets printed."""
import json, sys
sys.path.insert(0, ".github/scripts/cloudflare")
from _cf import ACC, call, errors

wanted = ["llama-3.1-8b", "llama-3.3-70b", "qwen3", "llama-guard", "flux-2", "melotts", "aura-2", "vision", "llava", "gemma", "mistral-small", "uform", "whisper"]
found, page = {}, 1
while page <= 12:
    st, p = call("GET", f"/accounts/{ACC}/ai/models/search?per_page=100&page={page}")
    if not p.get("success"):
        print(json.dumps({"error": errors(p), "http": st})); sys.exit(0)
    rows = p.get("result") or []
    if not rows:
        break
    for m in rows:
        n = m.get("name", "")
        if any(w in n.lower() for w in wanted):
            found[n] = {"task": (m.get("task") or {}).get("name"), "properties": [x.get("property_id") + "=" + str(x.get("value")) for x in (m.get("properties") or []) if x.get("property_id") in ("beta", "partner", "planned_deprecation_date", "context_window")]}
    page += 1
print(json.dumps(dict(sorted(found.items())), indent=1))
