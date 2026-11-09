"""Checks what the stored token can actually do. Prints a JSON report (no secrets)."""
import json, sys
sys.path.insert(0, ".github/scripts/cloudflare")
from _cf import ACC, call, summary

names = lambda rows: [r.get("name") or r.get("title") or r.get("queue_name") or r.get("id") for r in (rows or [])]
report = {}
report["token"] = summary(*call("GET", "/user/tokens/verify"), pick=lambda r: {"status": r.get("status"), "expires_on": r.get("expires_on")})
report["account"] = summary(*call("GET", f"/accounts/{ACC}"), pick=lambda r: {"name": r.get("name"), "type": r.get("type")})
report["workers"] = summary(*call("GET", f"/accounts/{ACC}/workers/scripts"), pick=names)
report["workers_subdomain"] = summary(*call("GET", f"/accounts/{ACC}/workers/subdomain"), pick=lambda r: r)
report["d1"] = summary(*call("GET", f"/accounts/{ACC}/d1/database"), pick=names)
report["kv"] = summary(*call("GET", f"/accounts/{ACC}/storage/kv/namespaces"), pick=names)
report["queues"] = summary(*call("GET", f"/accounts/{ACC}/queues"), pick=names)
report["r2"] = summary(*call("GET", f"/accounts/{ACC}/r2/buckets"), pick=lambda r: names((r or {}).get("buckets")))
st, p = call("POST", f"/accounts/{ACC}/ai/run/@cf/meta/llama-3.1-8b-instruct",
             {"messages": [{"role": "user", "content": "Reply with the single word: ok"}], "max_tokens": 5})
report["workers_ai"] = summary(st, p, pick=lambda r: (r or {}).get("response"))
print(json.dumps(report, indent=2))
