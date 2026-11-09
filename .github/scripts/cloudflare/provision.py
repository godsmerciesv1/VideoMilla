"""Creates the Cloudflare resources the Worker needs, if they do not exist yet. Prints a JSON report (IDs are not secrets)."""
import json, sys
sys.path.insert(0, ".github/scripts/cloudflare")
from _cf import ACC, call, errors

D1_NAME, R2_NAME, QUEUE_NAME = "videomilla-db", "videomilla-clips", "clip-jobs"
out = {}

# D1 database
st, p = call("GET", f"/accounts/{ACC}/d1/database")
found = [d for d in (p.get("result") or []) if d.get("name") == D1_NAME] if p.get("success") else []
if not found and p.get("success"):
    st, p = call("POST", f"/accounts/{ACC}/d1/database", {"name": D1_NAME})
    found = [p["result"]] if p.get("success") else []
out["d1"] = {"name": D1_NAME, "database_id": found[0].get("uuid") if found else None, "errors": errors(p) if not found else []}

# R2 bucket
st, p = call("GET", f"/accounts/{ACC}/r2/buckets")
have = [b for b in ((p.get("result") or {}).get("buckets") or []) if b.get("name") == R2_NAME] if p.get("success") else []
if not have and p.get("success"):
    st, p = call("POST", f"/accounts/{ACC}/r2/buckets", {"name": R2_NAME})
    have = [p["result"]] if p.get("success") else []
out["r2"] = {"name": R2_NAME, "created_or_found": bool(have), "errors": errors(p) if not have else []}

# Queue
st, p = call("GET", f"/accounts/{ACC}/queues")
have = [q for q in (p.get("result") or []) if q.get("queue_name") == QUEUE_NAME] if p.get("success") else []
if not have and p.get("success"):
    st, p = call("POST", f"/accounts/{ACC}/queues", {"queue_name": QUEUE_NAME})
    have = [p["result"]] if p.get("success") else []
out["queue"] = {"name": QUEUE_NAME, "queue_id": have[0].get("queue_id") if have else None, "errors": errors(p) if not have else []}

print(json.dumps(out, indent=2))
