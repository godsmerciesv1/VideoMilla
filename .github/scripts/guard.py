#!/usr/bin/env python3
"""Repo guard for check.yml. No third-party packages.

Errors (exit 1):
  * a workflow with a push / pull_request / schedule trigger (blueprint Section 12)
  * a workflow without workflow_dispatch
  * invalid JSON under website/
  * HTML that does not parse, a missing <title>, or a broken local link
    (links to pages listed in PLANNED only warn: later batches create them)
  * a committed secret-looking string
"""
import glob, json, os, re, sys
from html.parser import HTMLParser

errors, warnings = [], []
PLANNED = {"child-safety.html", "delete-account.html", "refunds.html", "sounds/"}
SECRET_PATTERNS = [
    r"ghp_[A-Za-z0-9]{30,}", r"github_pat_[A-Za-z0-9_]{30,}",
    r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----", r"AIza[0-9A-Za-z_\-]{30,}",
]

def err(m): errors.append(m); print(f"::error::{m}")
def warn(m): warnings.append(m); print(f"::warning::{m}")

# 1. workflows are manual only
for wf in sorted(glob.glob(".github/workflows/*.yml")):
    text = open(wf, encoding="utf-8").read()
    on_block = re.search(r"^on:\s*\n((?:[ \t]+.*\n?|\n)+)", text, re.M)
    if not on_block:
        err(f"{wf}: no 'on:' block found"); continue
    keys = re.findall(r"^[ \t]+([a-z_]+):", on_block.group(1), re.M)
    if "workflow_dispatch" not in keys:
        err(f"{wf}: missing workflow_dispatch")
    for bad in ("push", "pull_request", "pull_request_target", "schedule", "release", "create"):
        if bad in keys:
            err(f"{wf}: forbidden trigger '{bad}' (blueprint Section 12)")

# 2. website
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []; self.title = False; self.has_title = False; self.stack = []
    VOID = {"meta","link","img","br","hr","input","source","area","base","col","embed","track","wbr"}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title": self.title = True
        for k in ("href", "src", "poster"):
            if k in a and a[k]: self.links.append(a[k])
        if tag not in self.VOID: self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag == "title": self.title = False
        if tag in self.VOID: return
        if not self.stack or self.stack[-1] != tag:
            raise ValueError(f"unbalanced </{tag}> (open: {self.stack[-3:]})")
        self.stack.pop()
    def handle_data(self, d):
        if self.title and d.strip(): self.has_title = True

for j in glob.glob("website/**/*.json", recursive=True):
    try: json.load(open(j, encoding="utf-8"))
    except Exception as e: err(f"{j}: invalid JSON: {e}")

for h in sorted(glob.glob("website/**/*.html", recursive=True)):
    p = Page()
    try:
        p.feed(open(h, encoding="utf-8").read()); p.close()
        if p.stack: raise ValueError(f"unclosed tags: {p.stack}")
    except Exception as e:
        err(f"{h}: HTML problem: {e}"); continue
    if not p.has_title: err(f"{h}: missing <title>")
    for l in p.links:
        if re.match(r"^(https?:|mailto:|data:|#|javascript:)", l): continue
        target = l.split("#")[0].split("?")[0]
        if not target: continue
        path = os.path.normpath(os.path.join("website" if target.startswith("/") else os.path.dirname(h), target.lstrip("/")))
        if os.path.exists(path): continue
        (warn if target.lstrip("/") in PLANNED else err)(f"{h}: link to missing '{l}'")

# 3. secrets
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".dart_tool", "build"}]
    for f in files:
        path = os.path.join(root, f)
        if path.endswith("docs/blueprint.md"): continue
        try: body = open(path, encoding="utf-8").read()
        except Exception: continue
        for pat in SECRET_PATTERNS:
            if re.search(pat, body): err(f"{path}: looks like a secret ({pat})")

# 3b. the support address is shown only on the Support page (decision D-015)
EMAIL = "stmakarios@gmail.com"
def shown_text(body):
    body = body.replace("mailto:" + EMAIL, "")          # link targets are allowed
    return body
for path in ["README.md", "docs/decision.md"] + [h for h in glob.glob("website/**/*.html", recursive=True) if not h.endswith("support.html")]:
    if os.path.exists(path) and EMAIL in shown_text(open(path, encoding="utf-8").read()):
        err(f"{path}: shows the raw support address; use a 'Contact support' link (D-015)")

# 4. required docs
for need in ("docs/blueprint.md", "docs/decision.md", "README.md", ".gitignore"):
    if not os.path.exists(need): err(f"missing {need}")

print(f"guard finished: {len(errors)} error(s), {len(warnings)} warning(s)")
sys.exit(1 if errors else 0)
