# VideoMilla

VideoMilla turns a sentence, a script or a drawing into a narrated, captioned video made of shots.

One repository, three independent parts that never share code or a build trigger:

| Folder | What it is | Hosted on |
| --- | --- | --- |
| `app/` | Flutter app (Android and web from one codebase) | Google Play; Cloudflare Pages project `videomilla-app` |
| `worker/` | Cloudflare Worker API (`videomilla-api`) with D1, R2, Queues, Workers AI | Cloudflare Workers |
| `website/` | Static marketing and legal site (hand-written HTML, no build step) | Cloudflare Pages project `videomilla` |

Package ID: `com.zdmgold.videomilla`

## Documents

- `docs/blueprint.md` is the master blueprint (the guide for the build).
- `docs/decision.md` is the running log of decisions and deviations from the blueprint, updated phase by phase.

## How the build works

The product is built in dependency-ordered batches. After each batch:

1. Files are committed and pushed to `main`.
2. The light check workflow (`check.yml`) is run against the batch and its result is read.
3. The next batch starts only when the check is clean.

## Workflows

Every workflow is manual (`workflow_dispatch`). None has a `push:` trigger.
The only automatic deploy is the Cloudflare Pages Git integration for `website/`, which is outside GitHub Actions.

| Workflow | Purpose |
| --- | --- |
| `check.yml` | Light check: analyze and test (no app build, no signing) |
| `build_android.yml` | Release AAB and APK |
| `deploy_web.yml` | Build the web app and deploy to Cloudflare Pages |
| `deploy_worker.yml` | Deploy the Worker and apply D1 migrations |

## Secrets

Secrets live only in GitHub Actions secrets and Cloudflare Worker secrets. Nothing secret is ever committed.

## Support

[Contact support](mailto:stmakarios@gmail.com)
