# VideoMilla — Master Blueprint

*VID-ee-oh MIL-ah (Hebrew milah, 'word') · Android app, web app, static site, Cloudflare Worker · Package `com.zdmgold.videomilla` · Drafted October 29, 2026*

**This is the single authoritative document.** It supersedes every earlier draft, chat summary and appendix. Prices, limits, models and policies in it were checked against current sources in October 2026 and carry that date. Anything only running code can settle is a numbered gate (G1 to G16, Part V), never an assumption. There are no version labels: one release, one build run. Phases and batches describe build order only.

## 0. How this document is organized and used

| Part | Sections | Contents |
| --- | --- | --- |
| I Product | 1 to 8 | Decisions, scope, identity table, accounts, every feature, 20 languages, credits and packs, input-to-output flow |
| II Architecture and money | 9 to 19 | Repository, layering, platforms, CI, rendering, permissions, state, errors, performance, compliance, costs, fallbacks |
| III Design system | 20 to 22 | Tokens, components, motion, accessibility, right-to-left, styles |
| IV Backend | 23 to 24 | Worker routes, D1 schema, wallet ledger, request protocol, moderation, providers |
| V Build plan | 25 to 29 | 11 phases, 32 batches, 16 gates, 603 commands, the Termux loop, the single final gate |
| VI File specification | 30 to 42 | All 318 files (F001 to F320; F038 and F161 are retired): contents, workings, connections, snippets |
| VII Registers | 43 to 47 | Loophole register, open items, final checklist |
| VIII Test plan | 48 to 50 | Environments, cases, exit criteria. Part IX (sections 51 to 59) adds accounts, email, referrals, sounds, Cartoon Me, the final counts and their tests |

**Conventions.** `F###` is a file number. In file tables, D means depends on and U means used by (file numbers). Batch ids (s0, site-a, p1a and so on) are listed in Section 25. `G##` is a gate. Counts are exact: **318 files, 11 phases, 32 batches, 16 gates, 603 commands.**

**How the generating agent uses it.** (1) Read Parts I and II. (2) Confirm the Section 3 table is filled. (3) Run the Batch 0 gates. (4) Emit the contract block (Section 27). (5) Generate files strictly in batch order. (6) Run the single final gate (Section 29). Nothing is generated that this document does not list, and nothing listed is skipped.

---

# PART I. PRODUCT

## 1. Locked decisions

| Decision | Value |
| --- | --- |
| Product | VideoMilla turns a sentence, a script or a drawing into a narrated, captioned video made of shots. A few shots are animated; the rest are pictures with a slow pan or zoom |
| Store title | `VideoMilla: Story to Video` (26 characters; Google Play caps titles at 30) |
| App name in legal pages | `VideoMilla`. Google Play accepts the app name in the privacy policy in place of the entity name; the policy also carries a privacy contact (User Data policy, checked October 2026) |
| Support and privacy contact | `stmakarios@gmail.com` (public: it appears in the store listing and on the legal pages) |
| Package ID | `com.zdmgold.videomilla` (fixed permanently by the first bundle uploaded to Google Play) |
| Platforms in this run | Android (APK and AAB), web app, static marketing and legal site, Cloudflare Worker. iOS is not generated in this run; `core/` stays platform-free so an iOS adapter set can be added later without touching it |
| Front end | One Flutter codebase in `app/`, built for Android and for the web |
| Backend | One Cloudflare Worker (`worker/`) with D1 and Workers AI; external providers sit behind adapters |
| Repository | One public GitHub repository `videomilla`: `app/`, `worker/`, `website/` |
| Static site hosting | Cloudflare Pages project `videomilla`, connected to the repo (root directory `website`, no build command), auto-deploys on push. URL `https://videomilla.pages.dev` (name subject to availability; recorded in Section 3; once the custom domain is attached the site is served at https://\<DOMAIN>, Section 52.1) |
| Web app hosting | A separate Cloudflare Pages project `videomilla-app`, built and deployed only by a manual workflow. URL `https://videomilla-app.pages.dev` |
| Money | Consumable credit packs. No subscriptions, no ads, no free generation. One shared wallet |
| Android payments | Google Play Billing only. The app never links to or encourages a web purchase |
| Web payments | Polar as merchant of record, three packs |
| Accounts | Email sign-in (magic link plus 6-digit code) and Sign in with Google; anonymous until the first purchase; one wallet per account |
| Audience | Global, 13+, not a children's app |
| Languages | 20; each ships only when it passes its language gate (G7) |
| Output | MP4, 720x1280 (9:16) or 1280x720 (16:9), narration and burned-in captions, optional background sound |
| Styles | Six illustrated styles, Photoreal Story (fictional adults only), Realistic Scenes (no people) |
| Children | Appear only in the four cartoon styles. No exceptions |
| Excluded content | Real people other than the user's own Cartoon Me avatar; celebrities and licensed characters; photoreal children and photoreal self-likeness; sexual content; AI-generated music; editing a user's own footage; screen recordings |
| Animation | The AI recommends about one shot in three; the user may choose 0 to all with graded warnings; 2 credits per second of clip |
| Talking characters | Each character has its own voice; a talking shot is lip-synced from that character's audio |
| Free trial | None. Sample videos on Home and on the website are the trial |
| Reference test phone | Xiaomi Redmi A5, Unisoc T7250, 4 GB RAM, 128 GB, Android 15 Go. Memory extension is switched off for every test |
| Toolchain | Flutter and every plugin pinned exactly at gate G3. Floating versions are forbidden |
| Spend caps (whole app) | Video providers $10 a day; Workers AI $3.30 a day (300,000 neurons); fallback providers $3 a day |
| Fair use (per wallet) | 150 animated seconds a day, 2 clips in flight, 200 pictures a day |
| Credit lifetime | Credits never expire; what an action costs in credits lives in D1 config and may change for future spending only |
| Store fee assumption | 15% on Google Play (reduced-fee program). Polar: 4% plus 40 cents per sale |

## 2. Scope

**In (everything ships in this one release):**

- Inputs: a sentence, a full script, a drawing or picture, an imported .txt; optional brief; up to 4 reference images of the user's own art.
- AI script drafting, idea brainstorm, script improver, character builder.
- Scene and shot editor; six illustrated styles, Photoreal Story, Realistic Scenes.
- Cast with templates, profiles, four-portrait sheets, one voice per character plus a narrator.
- One picture per shot, approved before any video is made.
- AI animation plan, user slider with graded warnings, talking shots with lip-sync, pan and zoom motion stills.
- On-device (Android) and in-browser (web) rendering with burned-in captions.
- Series with a locked cast, saved locations and a running summary; free compilation.
- One shared credit wallet across the Android app and the web app; Play Billing on Android, Polar on the web.
- Moderation, reporting, email and Google sign-in, referrals, background sound, Cartoon Me (off until the Play approval), data export and deletion, 20 languages, right-to-left layouts.
- Static marketing and legal site, sample videos, store listing documents.

**Out (permanently, not deferred):** AI-generated music; real people other than the user's own Cartoon Me avatar, celebrities and licensed characters; photoreal children and photoreal self-likeness; sexual content; editing the user's own footage; screen recordings; accounts with passwords; subscriptions; advertising; a native iOS app in this run.

## 3. Identity and account tracking table (MANDATORY, kept current)

Check this table before every dashboard action and update it immediately after.

| Field | Value | Status |
| --- | --- | --- |
| Package ID | `com.zdmgold.videomilla` | ⬜ |
| Play Console app entry (the first bundle uploaded to a test track locks the ID) | — | ⬜ |
| Google Play payments-profile country, checked against Google's list of countries where in-app products can be sold | — | ⬜ |
| Play developer account creation date (decides whether the 12-tester, 14-day closed test applies) | — | ⬜ |
| Play product IDs | `com.zdmgold.videomilla.credits_25`, `.credits_90`, `.credits_160`, `.credits_350`, `.credits_750` | ⬜ |
| Repository | `videomilla` (public) | ⬜ |
| Cloudflare account ID | — | ⬜ |
| Worker and D1 database | `videomilla-api`, `videomilla-db` | ⬜ |
| Pages project, static site | `videomilla` at `https://videomilla.pages.dev` | ⬜ |
| Pages project, web app | `videomilla-app` at `https://videomilla-app.pages.dev` | ⬜ |
| Polar organization, access token, webhook secret, three product IDs | existing Polar account | ⬜ |
| Segmind API key and prepaid balance | — | ⬜ |
| Pruna direct API key (fallback route) | — | ⬜ |
| Google Cloud project, service-account email and JSON key | Play API and Text-to-Speech | ⬜ |
| Custom domain (registered at Cloudflare Registrar, DNS on Cloudflare) | `<DOMAIN>` | ⬜ |
| Brevo API key and the authenticated sender domain | — | ⬜ |
| Google OAuth client IDs for sign-in (web and Android) | — | ⬜ |
| Gemini API key (restricted to the Generative Language API) | — | ⬜ |
| Android upload keystore and fingerprint (stored offline) | — | ⬜ |
| GitHub secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | ⬜ |
| Worker secrets | `GOOGLE_SA_JSON`, `GEMINI_API_KEY`, `SEGMIND_API_KEY`, `PRUNA_API_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `BREVO_API_KEY`, `GOOGLE_OAUTH_CLIENT_IDS`, `PEPPER` | ⬜ |
| Legal URLs | privacy, terms, support, child-safety, delete-account, refunds under the static site's address | ⬜ |
| Support email | `stmakarios@gmail.com` | ✅ |
| Reference test phone | Xiaomi Redmi A5, 4 GB RAM, 128 GB, Android 15 Go | ✅ |

## 4. Accounts to open, in order, and what each needs

| # | Account | Link | You submit and extract | Cost now |
| --- | --- | --- | --- | --- |
| 1 | GitHub | https://github.com/signup | Repo URL; an SSH key added at https://github.com/settings/keys | $0 |
| 2 | Cloudflare | https://dash.cloudflare.com/sign-up | Account ID; API token (Workers, D1 and Pages edit); D1 `database_id`; a payment method; register the domain at Cloudflare Registrar and turn on Email Service (beta) | Workers Paid $5 a month (the free plan's CPU limit is too small for these routes) plus the domain ($10.46 a year for a .com) |
| 3 | Polar (your existing account) | https://polar.sh | A VideoMilla organization or product set; payout onboarding; three one-time products ($4.99, $9.99, $19.99); access token; webhook secret | $0 (4% plus 40 cents per sale) |
| 4 | Segmind | https://www.segmind.com/models/p-video-2 | API key; prepaid credits | $30 float at launch |
| 5 | Google Cloud | https://console.cloud.google.com | Project; enable the Text-to-Speech API and the Google Play Android Developer API; service account and JSON key; OAuth client IDs for Google sign-in (web and Android); link billing | $0 inside the free monthly allowance |
| 6 | Google AI Studio | https://aistudio.google.com | Gemini API key restricted to the Generative Language API; prepaid balance | about $10 (the minimum shown on the billing page) |
| 7 | Pruna direct API | https://docs.api.pruna.ai/guides/models/p-video-2 | API key for the fallback route to the same model | $0 until used |
| 8 | Brevo | https://www.brevo.com | Account; authenticate the sender domain with the DNS records Brevo shows; API key | $0 (free plan: 300 emails a day) |
| 9 | Google Play Console | https://play.google.com/console | Personal account; payments profile (first confirm your payments-profile country is on Google's list for in-app sales); app entry; five consumable products; license testers | $25 once, if not already paid |

**Cash needed.** To launch the web version: Cloudflare $5 plus Segmind $30 and the domain $10.46 equal about $45. Fallback readiness adds $10 (Gemini). The Android release adds $25 (Play). Planning total about **$80**. Payment lag: Google pays around the 15th of the following month; Polar pays out on request once the balance reaches its $10 minimum (new accounts have a settlement delay of about 7 days and a 4 to 7 business-day transfer; check the dashboard), so the float needed to carry provider costs is small.

**Order:** GitHub, Cloudflare, Polar dry run (create the products and finish payout onboarding before any code is written), Segmind, Google Cloud, Brevo (after the domain is on Cloudflare), Google AI Studio, Pruna, then Play Console. Play account rule: a personal account created after November 13, 2023 must run a closed test with at least 12 testers opted in for 14 continuous days before it can apply for production access; internal testing does not count. The APK is built at the final gate regardless; Play distribution follows the closed test.

## 5. Features, complete

### 5.1 Inputs

- **Idea mode.** 5 words or more. The AI writes a script to the target length; the user reviews it before anything else is spent.
- **Script mode.** 10 to 450 words, typed, pasted, or imported from a .txt file (UTF-8 or UTF-16 with a byte-order mark, 100 KB maximum). Text in square brackets is a visual direction and is not narrated. A line that starts with a name and a colon is a character line (`MARA: Wait for me!`); any other line is narration.
- **Image mode.** The user adds one drawing, picture, object or place. The AI describes it and drafts a script around it; the picture may also become a style or location reference. Any image in which a human face is detected is rejected by the server check (`POST /v1/reference/check`, fail closed), is never stored, and is never reused; the one exception is Cartoon Me (Section 55), which accepts exactly one face, only in the four cartoon styles.
- **Reference images.** Up to 4 of the user's own art, resized on the device to 512 px or smaller (EXIF removed) before upload.
- **Settings.** Content language; aspect 9:16 or 16:9 (locked after the first picture); length 5 to 90 seconds (presets 15, 30, 60, 90 or custom); style; caption style (Bold, Clean, Outline); narrator voice and character voices.
- **Optional brief.** Genre and tone, setting, character notes. Blanks are inferred by the AI and shown on the scene review screen for editing before credits are spent.
- **AI helpers.** Idea brainstorm (five ideas, each a title and one line), script improver (expand, fit the target length, change tone, simplify), character builder (a sentence becomes a profile). The first 3 uses per project, shared with Analyze, are free; then 1 credit each.

### 5.2 Understanding the script

The Worker turns the script into JSON: characters (at most 6 per project, at most 2 per shot), scenes, and shots (at most 15, planned at 3 to 10 seconds each to total the target length within 10%). Every shot carries: a visual description, narration, optional speaker lines, a camera move, an age band for each character (`child` under 13, `teen` 13 to 17, `adult`, `mid`, `elder`), and a motion (`animate`, `zoom_in`, `zoom_out`, `pan_left`, `pan_right`, `hold`).

Style compatibility check: if any character is a `child` or `teen` and the chosen style is not a cartoon style, the app offers two choices, **switch to a cartoon style** (the default) or **keep the style and do not show those characters on screen** (they may still be mentioned). Realistic Scenes requires an empty character list; any shot that lists a character is rejected by the validator. The user can edit, add, delete and reorder scenes and shots.

### 5.3 Styles

Each preset bundles style text, palette, one style-anchor image (448 px or smaller, used as the fourth reference), and one uniform color grade applied as a color matrix (values tuned at G2).

| Style | Look | Palette | Children |
| --- | --- | --- | --- |
| Vivid Storybook | Saturated children's-book illustration | #FF6B4A #FFC93C #2EC4B6 #3A86FF, cream #FFF4E0 | Yes |
| Comic Book | Bold outlines, flat shading | #E63946 #1D3557 #FFD60A, paper #F1FAEE, ink #111111 | Yes |
| Flat Vector Pop | Clean shapes, limited bright palette | #FF5D8F #00C2A8 #FFD23F #5B5BD6 #1B1B2F | Yes |
| Pastel Watercolor | Soft and light | #F7C8D4 #BFE3F0 #FFF1C9 #CDE7C6 #D9C7F0 | Yes |
| Ink Noir | High-contrast, near-monochrome | #0E0E10 #F5F5F5 #8A8A93, accent #C81E2B | No |
| Cinematic | Painterly, moody light (not photographic) | #1E5F74 #F4A259 #0B132B #E0B48A #F2E9DC | No |
| Photoreal Story | Photographic look, fictional adult characters only | Natural, neutral filmic grade | No |
| Realistic Scenes | Photographic landscapes, food, buildings, objects, animals; no people | Natural light | n/a (no people) |

No preset names a living studio, franchise or artist.

### 5.4 Cast

Six templates (Young Hero, Wise Elder, Child, Rival, Animal Companion, Robot Sidekick) plus free text. The Child template is offered only in the four cartoon styles. Each character has an editable profile (age band, build, hair, outfit, signature item, expressions) with explicit skin-tone and hair pickers. A sheet is four 448x448 portraits that the user approves before any keyframe is made. Each character is assigned a voice (Section 5.5); the narrator is separate. A character approved once can be reused in a series at no cost. Cartoon Me (Section 55) adds the user's own cartoon avatar once the flag is on.

### 5.5 Voices and captions

- **Standard voice (free).** Android: the device voice first, then a cloud voice if the device has none for that language. Web: cloud voices only (a browser's speech output cannot be captured into a video file).
- **Studio voice (credits).** 1 credit per 9 seconds of video, minimum 2, higher-quality cloud voices.
- **Per-character voices.** A voice picker per character offers the available voices for the content language, labeled by tone (warm, bright, deep, soft). A voice chosen for a character never changes mid-video.
- **Captions.** Burned in, split by sentence, timing proportional to character count within each shot's audio; three caption styles; right-to-left aware; each script has a bundled font (Section 6).

### 5.6 Shots and pictures

One keyframe per shot at native 720p. Per shot: approve, regenerate (1 credit), edit narration (free; the audio is re-made), edit the visual prompt (offers a regeneration), report. A shot is a persisted state machine: `pending`, `reserved`, `generating`, `ready`, `approved`, `failedRetriable`, `failedTerminal`. The board shows a sticky summary such as '9 shots, 7 approved, 22 credits'.

### 5.7 Animation

- **Plan.** The AI marks shots as `animate` or as a camera move. About one in three is animated: recommended count R = max(1, round(n / 3)) for n shots. Openings, the climax and talking shots are preferred.
- **Slider.** The user chooses k from 0 to n. Zones: **green** k up to R ('the video will look complete'); **amber** k above R and up to H = ceil(n / 2), half rounded up (warning card); **red** k above H (warning card plus a confirm button 'I understand, animate k shots for X credits'); choosing all n (n of 3 or more) also needs a checkbox. The AI's pick is the labeled default ('Recommended'). Worked examples: n = 6 gives R = 2, amber 3, red 4 to 6; n = 9 gives R = 3, amber 4 to 5, red 6 to 9; n = 15 gives R = 5, amber 6 to 8, red 9 to 15.
- **What the warnings say.** Each extra animated shot adds 10 credits; waiting time grows because only 1 or 2 clips run at once; each clip is generated separately so faces, clothing or hands can drift and a rejected clip is charged again; a failed clip is refunded; more clips take longer to process on the phone; on busy days the app may say 'busy' and charge nothing; try the recommended number first, animate more later.
- **Clips.** 3 to 8 seconds each (default 5), 2 credits per second. All selected clips are reserved up front and refunded individually on failure. The user previews each clip and keeps or rejects it.
- **Talking shots.** A talking shot starts from the approved keyframe; the character's line audio is passed to the video provider, which lip-syncs it. Lines beyond the animated count, or when lip-sync fails, play as that character's voice-over on a pan or zoom shot and the app says so.
- **Later.** A finished video can be re-opened and more shots animated; unchanged shots are reused and re-rendering is free.

### 5.8 Output

Render: Android uses Jetpack Media3 Transformer through a platform channel under a foreground service; the web uses an in-browser pipeline with checkpoints in browser storage. Both consume the same render plan (F055). Output: MP4, 720x1280 or 1280x720, narration, captions and optional background sound (Section 54). Actions: preview, save (Android gallery; web download), share (Android share sheet; web Share API where available), report. If rendering fails, the app exports the approved images and audio files instead.

### 5.9 Series

A series is a saved bible plus linked episodes. The bible holds title, language, aspect, style, caption style, characters with approved portraits and voices, locations (name, description, optional reference), and a running summary (150 words or less). A new episode inherits the bible; the script screen shows the summary and offers to open on the previous episode's last frame. Reusing an approved character costs 0; a new character costs 4. After each episode the AI updates the summary (free) and the user can edit it. Finished episodes compile into one MP4 on the device at no cost. Series live on the device: reinstalling or switching devices loses them unless exported.

### 5.10 Accounts, wallet, purchases

- **One wallet** per account. Signing in with email or Google gives every device the same wallet (up to 10 signed-in devices), so a purchase on the web is spendable in the app and the reverse. Before the first purchase a device has its own anonymous wallet, which is merged into the account at sign-in.
- **Sign-in. Email (a magic link plus a 6-digit code) or Sign in with Google; sign-in is required to buy and to use Cartoon Me (Section 52**). A non-secret 8-character **Support ID** helps support find a purchase.
- **Purchases.** Android: Play Billing consumables, verified server-side. Web: Polar checkout; the webhook credits the wallet once per order. Credits are usable only inside VideoMilla (web and app together are one product).
- **Anti-steering.** The Android app never links to or encourages web purchase; it shows the balance, a Link device screen and a Restore screen only.
- **Final sales and debt. All purchases are final. A refund or chargeback forced by a platform reverses that purchase, credits already spent stay spent, and any shortfall becomes a debt that blocks spending until repaid; a new purchase pays debt first (Section 53)**.

### 5.11 Safety

- Moderation on scripts, English narration translations, and every final image and clip prompt; fail closed (a failed check blocks and charges nothing).
- Frightening themes (horror, ghosts, monsters, suspense, peril) are allowed at moderate intensity, in every style. Graphic gore, detailed torture and sustained realistic cruelty are blocked.
- Blocked: sexual content; any sexual or romantic content involving a person who is or appears under 18, in every style; graphic gore; hate; real people, celebrities and licensed characters; deceptive election content; self-harm instruction; weapons-making instruction.
- Children appear only in the four cartoon styles; Photoreal Story and Realistic Scenes never show a minor.
- Reference images: no human faces (the one exception is the user's own single face in Cartoon Me, Section 55), no real-person photos, own art only.
- A report control on every output; reports are triaged within 72 hours (a target); the response is blocking the wallet's further generation. The Worker keeps a clip for at most 24 hours so the app can download it, then deletes it; it never stores pictures or scripts.

### 5.12 Settings, legal, support

Theme (light, dark, system); UI language; content language; caption default; account (email or Google, devices, referral code, sign-out) and wallet (balance, Support ID); storage; export and delete my server data; About with licenses and the 'Built with Llama' notice; links to privacy, terms, support, child-safety, delete-account and refunds pages; support email `stmakarios@gmail.com`; a 'Report a translation problem' link that opens an email to the same address.

## 6. Languages (20)

Chosen from download volume (India, Brazil, the United States, Indonesia, Mexico, the Philippines and Turkey lead Google Play), spend (the United States, Japan and South Korea lead) and technical support (Qwen3 covers all the languages routed to it; Google Cloud voices cover Hebrew, Hindi, Indonesian, Bengali, Filipino, Urdu and the rest). **All 20 are built. A language ships when it passes gate G7.** Wave 1 is tried first.

| Language | Locale | Wave | Script model | Android voice | Web voice | Caption font | Dir |
| --- | --- | --- | --- | --- | --- | --- | --- |
| English | en | 1 | Llama 3.1 8B | Device, else MeloTTS or Aura-2 | MeloTTS or Aura-2 | Inter | LTR |
| Portuguese (Brazil) | pt\_BR | 1 | Llama 3.1 8B | Device, else Google | Google | Inter | LTR |
| Spanish (Latin America) | es | 1 | Llama 3.1 8B | Device, else Aura-2 | Aura-2 | Inter | LTR |
| Hindi | hi | 1 | Llama 3.1 8B | Device, else Google | Google | Noto Sans Devanagari | LTR |
| Indonesian | id | 1 | Qwen3-30B-A3B | Device, else Google | Google | Inter | LTR |
| Arabic | ar | 1 | Qwen3-30B-A3B | Device, else Google | Google | Noto Sans Arabic | RTL |
| Turkish | tr | 1 | Qwen3-30B-A3B | Device, else Google | Google | Inter | LTR |
| Russian | ru | 1 | Qwen3-30B-A3B | Device, else Google | Google | Inter | LTR |
| Japanese | ja | 1 | Qwen3-30B-A3B | Device, else Google | Google | Noto Sans JP | LTR |
| Korean | ko | 1 | Qwen3-30B-A3B | Device, else Google | Google | Noto Sans KR | LTR |
| German | de | 1 | Llama 3.1 8B | Device, else Google | Google | Inter | LTR |
| Hebrew | he | 1 | Qwen3-30B-A3B | Google (Chirp 3 HD or WaveNet he-IL) | Google | Noto Sans Hebrew | RTL |
| French | fr | 2 | Llama 3.1 8B | Device, else MeloTTS | MeloTTS | Inter | LTR |
| Italian | it | 2 | Llama 3.1 8B | Device, else Google | Google | Inter | LTR |
| Vietnamese | vi | 2 | Qwen3-30B-A3B | Device, else Google | Google | Inter | LTR |
| Thai | th | 2 | Llama 3.1 8B | Device, else Google | Google | Noto Sans Thai | LTR |
| Filipino | fil | 3 | Qwen3-30B-A3B | Device, else Google | Google | Inter | LTR |
| Bengali | bn | 3 | Qwen3-30B-A3B | Google | Google | Noto Sans Bengali | LTR |
| Urdu | ur | 3 | Qwen3-30B-A3B | Google | Google | Noto Nastaliq Urdu | RTL |
| Chinese (Traditional) | zh\_Hant | 3 | Qwen3-30B-A3B | Device, else Google (confirmed at G7) | Google (confirmed at G7) | Noto Sans TC | LTR |

**Rules.** Llama 3.1 officially supports English, German, French, Italian, Portuguese, Hindi, Spanish and Thai; the rest route to Qwen3. Llama Guard 3 covers those same eight languages, so every Qwen-routed language also gets (a) an English translation of each narration line that is moderated and (b) an independent source-language classifier call. Model IDs are pinned in config with named fallbacks (Section 17). Translations are machine-made with a fixed glossary, a back-translation cross-check and pseudo-localization tests; Settings labels any language not yet reviewed 'beta translation'. Legal pages are English; English governs. Right-to-left: Arabic, Hebrew, Urdu. Complex-script shaping (Hindi, Bengali, Thai, Arabic, Hebrew, Urdu) is proven per script at G1, G2 and G7, never assumed.

## 7. Credits, packs, pricing

1 credit is roughly one picture. Credits never expire.

**Action costs (D1 config `credit_costs`).**

| Action | Credits |
| --- | --- |
| Script analysis and AI helpers | 0 for the first 3 per project (one shared counter), then 1 each; a purchase must exist on the wallet first |
| Character sheet (4 portraits) | 4 per character; one portrait redone: 1 |
| Picture (keyframe) or regeneration | 1 |
| Animated clip | 2 per second (3 s = 6, 5 s = 10, 8 s = 16) |
| Studio voice | 1 per 9 s of video, minimum 2 |
| Standard voice, captions, motion stills, render, export, series compile, reusing an approved character, editing narration | 0 |

A failed clip or picture is refunded. A moderation block costs nothing. A clip the user rejects is charged again when regenerated.

**Packs.**

| Pack | Price | Credits | Per credit | Where sold | Fee taken |
| --- | --- | --- | --- | --- | --- |
| credits\_25 | $0.99 | 25 | $0.0396 | Android | 15% = $0.15 |
| credits\_90 | $2.99 | 90 | $0.0332 | Android | 15% = $0.45 |
| credits\_160 | $4.99 | 160 | $0.0312 | Android and web | Play $0.75; Polar $0.60 |
| credits\_350 | $9.99 | 350 | $0.0285 | Android and web | Play $1.50; Polar $0.80 |
| credits\_750 | $19.99 | 750 | $0.0267 | Android and web | Play $3.00; Polar $1.20 |

The web sells only the three largest packs because Polar's fixed 40-cent fee would take 44% of $0.99 and 17% of $2.99. Polar's payout fees are extra: $2 a month while paying out, 0.25% plus $0.25 per payout, and 0.25% to 1% currency conversion; request payouts monthly. Displayed Android prices always come from the store. Every pack shows 'All purchases are final'. Regional price overrides must stay above credits times $0.0147 (worst case every credit spent on clips at $0.0125 provider cost per credit, divided by 0.85).

**Examples (animated shots at the recommended count; 5 s clips).**

| Video | Shots | Animated | Characters | Credits | User pays | Your cost |
| --- | --- | --- | --- | --- | --- | --- |
| 15 s | 3 | 1 | 1 | 17 | $0.45 to $0.67 | about $0.15 |
| 30 s | 6 | 2 | 2 | 34 | $0.91 to $1.35 | about $0.29 |
| 45 s | 9 | 3 | 2 | 47 | $1.25 to $1.86 | about $0.43 |
| 60 s | 12 | 4 | 2 | 60 | $1.60 to $2.38 | about $0.56 |
| 90 s | 15 | 5 | 2 | 73 | $1.95 to $2.89 | about $0.71 |
| 45 s, all animated | 9 | 9 | 2 | 107 | $2.86 to $4.24 | about $1.18 |

**Fair use per wallet (D1 config `fair_use`).** 150 animated seconds a day, 2 clips in flight, 200 pictures a day. When a limit is reached the app says 'Daily limit reached, resume tomorrow. Your credits are safe.' A limit is raised for one wallet by a support runbook entry using its Support ID.

## 8. Input to output flow and maneuverability

| Step | The user does | The app produces | Credits | If it fails |
| --- | --- | --- | --- | --- |
| 1 Welcome and Home | Opens the app, watches samples, taps New | An empty project; no permission prompts | 0 | Samples collapse to zero height; nothing else is affected |
| 2 Input | Types, pastes, imports or adds a picture; picks language, ratio, length, style | A summary of choices; picture checked | 0 | Face found: the picture is refused with a message |
| 3 Analyze | Taps Analyze (needs a purchase on the wallet once) | Characters, scenes, shots, motion plan | first 3 free | Invalid output: two automatic retries, then 'edit the script'; moderation block: no charge |
| 4 Review | Edits, adds, deletes, reorders shots | Updated list; style check for children | 0 | Child in a non-cartoon style: choose switch or hide |
| 5 Cast | Picks templates, edits, assigns voices | Four-portrait sheet per character | 4 each | A portrait that fails is refunded and retried alone |
| 6 Pictures | Generates, approves, redoes | One approved keyframe per shot | 1 each | Failed picture refunded; retry |
| 7 Animation plan | Keeps the AI plan or moves the slider | Live price and warnings | shown first | Beyond half: extra confirmation |
| 8 Generate | Confirms | Per-shot progress; all credits reserved | clips | Failed clip refunded alone; busy: no charge |
| 9 Clips | Previews, keeps or rejects | Locked clips | rejected = paid again | Lip-sync failure: voice-over on a motion shot, refund |
| 10 Voice and captions | Chooses standard or studio voice | Narration and caption files | studio only | Missing device voice: cloud fallback |
| 11 Render | Taps Render | A finished MP4 | 0 | Render failure: export images and audio |
| 12 Share | Saves, shares, reports | A file in the gallery or downloads | 0 | Storage full: clear message |
| 13 Series | Taps Next episode | Same cast, new script | new shots only | Summary editable |

**Maneuverability rules.** Every step can be revisited with autosave. An edit invalidates only what it must and shows the price first: a narration edit re-makes audio free; a visual edit regenerates the picture (1 credit) and the clip (paid again); a style change after pictures exist offers a project copy. The aspect ratio locks after the first picture; duplicate the project to change it. Every shot can be redone alone; projects can be duplicated or deleted; there are no dead ends: every error offers retry, edit or export. A job never charges twice, and an interrupted job resumes with the same key on reopen.

---

# PART II. ARCHITECTURE AND MONEY

## 9. Repository structure

```
videomilla/
├── app/                     Flutter app, Android and web targets from one codebase
│   ├── lib/  android/  web/  assets/  test/  tool/
│   ├── pubspec.yaml  analysis_options.yaml  l10n.yaml
├── worker/                  Cloudflare Worker (TypeScript)
│   ├── src/  migrations/  test/
│   ├── wrangler.toml  package.json  tsconfig.json  vitest.config.ts
├── website/                 static marketing and legal site (Pages project videomilla)
├── .github/workflows/       deploy_worker.yml  deploy_web.yml  build_android.yml  check.yml  (all manual)
├── store_submission/        ASO_METADATA.md  DATA_BACKING.md  SCREENSHOT_STRATEGY.md
└── README.md
```

`app/`, `worker/` and `website/` never share code, imports or a build trigger. The static site has no build step. The web app is built from `app/` by a manual workflow and deployed to its own Pages project, so the marketing site stays crawlable and the app can never break it.

## 10. Layering (MANDATORY, real folders)

```
app/lib/
├── core/       platform-free: config, tokens, theme, errors, models, services (contracts), logic, providers.
│               No dart:io, no dart:js_interop, no plugin imports. Unit-testable without a device.
├── platform/   shared/ (HTTP adapters, image prep) · android/ (plugin and channel bound) · web/ (js_interop bound)
│               platform_registry.dart picks the adapter set with conditional imports
├── widgets/  screens/  utils/  l10n/
├── app_scope.dart   builds and exposes every provider and service
└── main.dart
```

Every capability is a contract in `core/services/` with one implementation per platform. The screens and providers know only the contracts.

| Contract (file) | Android implementation | Web implementation | Shared implementation |
| --- | --- | --- | --- |
| StructureService (F042) |  |  | structure\_adapter F114 |
| ImageService + reference check (F043) |  |  | image\_adapter F115 |
| VoiceService (F044) | android\_voice\_service F135 | web\_voice\_service F126 |  |
| ClipGenerator (F045) |  |  | clip\_generator\_worker F116 |
| RenderService, RenderHost, FileService (F046) | native\_renderer F132, foreground\_service F137, android\_file\_service F138 | web\_renderer F127, web\_file\_service F125 |  |
| ProjectStore (F047) | android\_store\_adapter F133 | web\_store\_adapter F123 |  |
| CreditsService (F048) |  |  | credits\_adapter F117 |
| PurchaseService (F049) | billing\_adapter F136 | not registered |  |
| WebCheckoutService (F050) | not registered |  | web\_checkout\_adapter F121 |
| ReportService (F051) |  |  | report\_adapter F119 |
| RemoteConfigService (F052) |  |  | remote\_config\_adapter F120 |
| IdentityService (F053) | android\_identity F134 | web\_identity F124 |  |
| AssistService (F054) |  |  | assist\_adapter F118 |

Anti-steering is structural: `WebCheckoutService` is never registered in the Android build, so no code path in the Play app can open a web checkout.

## 11. Platforms and hosting

| Surface | Built from | Hosted on | Deploy trigger |
| --- | --- | --- | --- |
| Android app | `app/` with `flutter build appbundle` and `apk` | Google Play (AAB); APK for sideload | Manual workflow `build_android.yml` |
| Web app | `app/` with `flutter build web` | Cloudflare Pages project `videomilla-app` | Manual workflow `deploy_web.yml` (wrangler) |
| Static site | `website/` (hand-written HTML) | Cloudflare Pages project `videomilla`, Git-connected, root directory `website`, no build command | Automatic on push to main; Pages uses its own build quota (500 builds a month on the free plan), not GitHub Actions minutes |
| Backend | `worker/` | Cloudflare Workers with D1, R2, Queues, Workers AI | Manual workflow `deploy_worker.yml` |

**Web app browser support.** Rendering needs WebCodecs: Chrome and Edge 94 or later, Firefox 130 or later; Safari and iOS Safari 26 or later also support it (older Safari has partial support), so iPhones on iOS 26 or later can render in the web app; Firefox for Android does not. The capability probe in `web_renderer.dart` (F127) checks `VideoEncoder` and `AudioEncoder` at load. When absent, the app still creates and previews videos, and Export offers the approved images and audio instead, with a message to use Chrome or Edge for MP4.

## 12. CI and deploy: manual only (MANDATORY)

No workflow has a `push:` trigger, ever. Every workflow is `workflow_dispatch`. The static site's Git integration is a Cloudflare feature outside GitHub Actions and is the single automatic deploy, because it has no build and its own quota. Failure states never permit adding `push:`.

```yaml
on:
  workflow_dispatch:
jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { channel: stable, flutter-version-file: app/pubspec.yaml }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17' }
      - run: bash tool/fetch_assets.sh && flutter pub get && flutter gen-l10n
        working-directory: app
      - run: ./tool/write_key_properties.sh
        working-directory: app
      - run: flutter build appbundle --release --obfuscate --split-debug-info=symbols
        working-directory: app
      - run: flutter build apk --release --obfuscate --split-debug-info=symbols
        working-directory: app
```

The web workflow runs `flutter build web --release --wasm` only if G3 proves WebAssembly output works with `package:web`; otherwise it runs plain `flutter build web --release`. Deploy: `npx wrangler pages deploy build/web --project-name=videomilla-app`.

## 13. Rendering architecture (the same video, two renderers)

Both renderers consume one platform-neutral **render plan** (F055): an ordered list of segments (a clip or a still with a motion), the audio events with offsets (narration and per-character lines), the caption cues with timings, the grade, and the output size. The plan is pure Dart and unit-tested.

| Aspect | Android | Web |
| --- | --- | --- |
| Engine | Jetpack Media3 Transformer (Kotlin, Apache-licensed, maintained by Google), hardware H.264 and AAC through MediaCodec | WebCodecs (VideoEncoder, AudioEncoder) with Mediabunny (MPL-2.0) for MP4 writing, running in a Web Worker on an OffscreenCanvas |
| Still with motion | An image item with a duration and frame rate plus a `MatrixTransformation` whose matrix is a function of the presentation time (zoom in, zoom out, pan) | Per frame draw of the picture with a computed transform |
| Clips | Video items, scaled to the output size, provider audio removed | Frames decoded at the output size (resizing YUV frames is on a known Chrome slow path) and drawn |
| Grade | Media3 color effect (RGB matrix) with values from the style preset | Canvas filter or per-pixel matrix, same values |
| Captions | Caption bitmaps drawn with the Android text layout and bundled Noto fonts, shown through an `OverlayEffect` (the system text stack shapes complex scripts) | Canvas `fillText` with web fonts (the browser shapes complex scripts) |
| Audio | One audio sequence: each shot's voice file padded with silence to its segment length (voices never overlap), plus an optional second sequence for the background sound with a gain, encoded as AAC | Web Audio mixes the voices and the optional background sound offline, then AudioEncoder |
| Keep-alive | Foreground service of type `mediaProcessing` (Android 15 and later) | Wake lock where available; segment checkpoints |
| Checkpoints | Each finished segment is stored as an intermediate file; a restart resumes at the first missing segment | Each finished segment is stored in IndexedDB; a restart resumes the same way |
| Fallback | Export approved images and audio | Same |

Facts and cautions (checked October 2026): Transformer supports compositions, built-in effects (presentation, scale and rotate, crop, overlays of text or images), custom matrix effects driven by presentation time, audio processors, and output of H.264 or H.265 with AAC. Chrome has open WebCodecs reports that matter here: VideoEncoder performance degrades if the page re-renders (so rendering runs in a worker), and drawing resized YUV frames is 5 to 10 times slower (so clips are decoded at output size). The earlier plan used the community FFmpegKit fork; it is dropped because that fork publishes an arm64-only prebuilt library, has paid tiers, and leaves complex-script shaping unproven, while Media3 has none of those problems.

**Render targets.** On the reference phone: 90-second 720p video renders in at most 6 times real time on Android (target 3) and at most 8 times on the web (target 4). Above that the gate fails and the default maximum length or resolution is lowered.

## 14. Background work, notifications, permissions

- **No engagement notifications.** The only notification is the ongoing render notification required by the foreground service.
- **Android 15 and later:** foreground service type `mediaProcessing`; stop when done or failed; handle the timeout callback. Rendering is resumable.
- **Web:** no background execution; the tab must stay open. The app says so before render, and checkpoints survive a reload.

| Android permission | Reason |
| --- | --- |
| `INTERNET` | Worker calls, sample streaming |
| `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PROCESSING` | Render survives backgrounding |
| `POST_NOTIFICATIONS` (only if the target SDK requires it to show the service notification) | Render progress |

No storage, camera, microphone or location permission: pictures come from the system picker; exports go through the share sheet and the app's own storage. Exact names are confirmed by the manifest merge at G15. The web asks for no permission.

## 15. State, data layer, errors

- `ValueNotifier<T>` with `ListenableBuilder`; never `setState` for business logic. One provider per state domain (the 21 in Phase 6).
- Models are immutable: `final` fields, `copyWith`, `toJson`, `fromJson`, `==`, `hashCode`, and a `schemaVersion` where persisted.
- Storage: SQLite on Android, IndexedDB on the web, both behind `ProjectStore`. Every storage call is wrapped in try-catch with an in-memory fallback and a visible warning banner. `schemaVersion` is stored with every structure; migrations run on open; a corrupt project triggers a recovery path.
- Every paid request carries an idempotency key; resuming reuses the same key. Every async call checks `mounted`. Every save, delete, export and share shows explicit success or failure.

| Error | Class | UI treatment |
| --- | --- | --- |
| Offline | recoverable, retriable, system | banner and Retry |
| Provider busy or daily cap | recoverable, retriable | 'Busy, try later', no charge |
| Moderation blocked | terminal for that input, user-caused | explain, edit script, no charge |
| Insufficient credits | recoverable, user | pack sheet (Android) or link-device and balance message (web) |
| Purchase pending or failed | recoverable | status chip |
| Invalid model output | retriable twice, then terminal | auto-retry, then 'edit the script' |
| Clip failed or wrong size | retriable | refund that clip, Retry |
| Lip-sync failed | recoverable | voice-over on a motion shot, refund |
| Render failure | terminal for the render | error screen, report, export images and audio |
| Storage full | recoverable, user | storage screen |
| Persistence failure | recoverable | warning banner, in-memory fallback |
| Corrupt project | terminal for that project | recovery path |
| Bad sign-in code | recoverable, user | rate-limited message |
| Signed-in device removed or account deleted elsewhere (401) | recoverable, user | the sign-in sheet opens with 'You were signed out. Sign in to see your credits.'; no new wallet is made |
| Negative balance after a refund | recoverable, user | debt banner; buy credits to continue |
| Browser lacks WebCodecs | recoverable | message, export images and audio |

## 16. Third-party failure handling and the provider chain

No third-party failure may crash an app or block Home.

| Function | Primary | Fallback 1 | Fallback 2 |
| --- | --- | --- | --- |
| Animation and lip-sync | Pruna P Video 2 through Segmind | Pruna's direct API | Veo 3.1 Lite through the Gemini API |
| Pictures | FLUX.2 klein 4B on Workers AI | klein 9B on Workers AI | Segmind P-Image-Edit |
| Script and helpers | Llama 3.1 8B or Qwen3-30B-A3B on Workers AI | Llama 3.3 70B on Workers AI | Gemini Flash-Lite |
| Moderation | Llama Guard 3 on Workers AI | none: fails closed |  |
| Cloud voices | Workers AI (MeloTTS, Aura-2) for English, French, Spanish | Google Cloud Text-to-Speech |  |
| Purchase checks | Play Developer API and Polar webhook | retry |  |

**Rules.** Prices are per action, not per provider, so users see one price whichever provider runs. A fallback provider may cost more (Veo 3.1 Lite lists at $0.05 to $0.08 a second against $0.025 for P Video 2, which makes a 5 s shot $0.25 to $0.40 against $0.125). The router therefore spends at most the **fallback budget** ($3 a day) on fallback providers; past it the Worker returns busy before reserving credits. A fallback that cannot accept supplied audio turns the shot into voice-over on a motion shot. Every job records its expected cost, so margin by provider is visible. Model IDs and the chain live in D1 config, never in the apps. Providers change prices and retire models without much notice (Google AI Ultra was listed at $249.99 in June 2026 and at $99.99 or $199.99 in September; OpenAI shut its Sora app on April 26, 2026), so a weekly cost reconciliation is part of the runbook. Login email has its own counter-driven chain: Brevo while under 290 sends a day, then Cloudflare Email Service (Section 52.8).

## 17. Performance targets (numeric, measured on the Redmi A5 with memory extension off)

| Metric | Target |
| --- | --- |
| Cold start to interactive | under 2 s on Android; first content under 3 s on the web |
| Frame rate | 60 fps, no dropped frames |
| Shot board, 15 shots | thumbnails decoded at 360 px, smooth scroll |
| Project list | virtualized, 100 or more projects |
| Local reads | under 50 ms |
| Render, 90 s | Android at most 6 times real time (target 3); web at most 8 (target 4) |
| Network timeouts | structure 60 s, picture 90 s, voice 60 s, clip submit 30 s; two retries with backoff |
| Concurrency | at most 3 picture calls and 2 clip jobs in flight per wallet |
| Memory and storage | one clip decoded at a time; intermediates deleted after success; free-space check before render |

Model IDs pinned in config: Llama 3.1 8B Instruct, Qwen3-30B-A3B, Llama Guard 3 8B, FLUX.2 klein 4B (fallback 9B). Do not use `gemma-3-12b-it`; it is deprecated.

## 18. Compliance and store-policy mapping

| Policy | Applies | Mitigation |
| --- | --- | --- |
| Google Play AI-generated content | Always | Moderation of scripts and prompts, in-app report control on every output that works without leaving the app, red-team set at G5 |
| Google Play child safety | Always | No sexual content in any style; children only in the four cartoon styles; moderation; child-safety page; abuse contact `stmakarios@gmail.com` |
| Google Play payments | Android | Play Billing for credits; no link or wording that steers to the web inside the app; credits usable only inside VideoMilla |
| Google Play User Data and Data safety | Always | Privacy policy names VideoMilla and the contact; discloses processing by Cloudflare, Google Cloud and the video and image providers; stored data is the device credential, wallet ledger, purchase records, the account email (and Google subject), referral records and clips held up to 24 hours for download |
| Marketing honesty | Always | Listing and samples show the real mix of a few animated shots and mostly motion; samples are labeled AI-generated |
| Polar acceptable use | Web | Digital delivery as described, refunds handled, chargebacks monitored; Polar is the seller of record on web purchases |
| Privacy law (including GDPR Articles 13 and 15 to 17) | Global | Controller named as VideoMilla with the contact; in-app export and delete; Support ID or the account email to identify a wallet |
| Model and provider licenses | Always | 'Built with Llama' in About and on the site; each model's license and each provider's terms are re-read at G3 and whenever a model changes |
| Content rights | Always | Own art only; no real people or licensed characters; terms prohibit impersonation |
| Age rating | Always | Questionnaire answered honestly for AI-generated, user-driven content; 13+ |

## 19. Money flow, costs, caps

**Who pays whom.** A user pays Google (Android) or Polar (web). Google keeps 15% and pays around the 15th of the following month; Polar keeps 4% plus 40 cents and pays out on request through Stripe Connect. The wallet credits instantly on a verified purchase or webhook; provider costs are paid from your prepaid balances as videos are made.

| Service | Cost | Limits that shape the design |
| --- | --- | --- |
| Workers Paid | $5 a month | CPU 30 s per request by default (up to 5 minutes), no cap on wall time while a client stays connected; `waitUntil` extends only 30 s; Queue consumers get 15 minutes wall time |
| Workers AI | per use | FLUX.2 klein 4B at $0.000287 per 512 output tile; script and moderation calls fractions of a cent |
| R2 (temporary clips) | free inside 10 GB, no egress fee | objects deleted after 24 hours by the daily cron |
| Queues | included with the plan at this volume | each clip job runs in a consumer for up to 15 minutes |
| Segmind (P Video 2) | $0.025 a second, draft $0.015 | sync endpoint returns the MP4; billed per second returned |
| Google Cloud Text-to-Speech | free monthly allowance, then per character | billing must be linked |
| Polar | 4% plus 40 cents; payout fees extra | see Section 7 |

**Why clips go through a queue.** The Segmind call returns the MP4 in its response, which can take about 30 seconds or more. An HTTP request is cancelled if its client disconnects, and `waitUntil` only adds 30 seconds, so a clip job is enqueued; the consumer calls the provider, writes the MP4 to R2 and updates D1; the app polls status and downloads from R2. A lost phone connection therefore never costs a second provider call.

**Caps (D1 config, USD):** video providers $10 a day; Workers AI $3.30 a day; fallback providers $3 a day; Google characters cap. Each is checked before credits are reserved; reaching one returns 'busy' and charges nothing. Milestones at 50% and 80% are written to D1 for the daily check in the runbook. A cap is a brake, not a target; sustaining $10 a day of video cost implies about $33 a day of credit sales. Raise caps in steps ($25, $50, $100) as sales and your float grow.

**Cash timeline.** Launch needs about $45 (Cloudflare $5, the domain $10.46, Segmind $30). Costs go out as videos are made; Polar money is available on request; Google money arrives up to about six weeks after a sale.

## 19A. Verified facts register (checked October 2026)

| Fact | Value |
| --- | --- |
| Flutter stable | 3.47.1 with Dart 3.13.1, released August 19, 2026; Material and Cupertino are standalone packages (this app uses neither); 3.50 is scheduled for November 2026 |
| P Video 2 on Segmind | `POST https://api.segmind.com/v1/p-video-2`; image-to-video from a first frame; audio-conditioned generation; `last_frame_image`; `duration` 1 to 20 s; 720p; 7 aspect ratios; `draft`, `save_audio`, `seed`; MP4 in the response body; billed per second returned |
| Polar checkout | `POST` checkout with `products`, `external_customer_id`, `metadata`, `success_url` containing `{CHECKOUT_ID}`; checkout metadata is copied to the order; webhook `order.paid` (also `order.updated` for status changes and refunds); signatures must be verified |
| Cloudflare limits | HTTP: no wall limit while connected, cancelled on disconnect, `waitUntil` +30 s; Queue consumer 15 min wall; Workers Paid CPU default 30 s, configurable to 5 min |
| Media3 Transformer | Compositions, effects (presentation, scale and rotate, crop, text and image overlays, time-driven matrix transformation), audio processors, H.264 or H.265 with AAC; current docs show version 1.11.1 |
| Mediabunny | MPL-2.0, pure TypeScript, MP4 and WebM writing, canvas video source, hardware acceleration through WebCodecs; WebCodecs in Chrome 94, Firefox 130 and Safari 26 or later (caniuse, October 2026) |
| Play closed test | 12 testers for 14 continuous days for personal accounts created after November 13, 2023 |
| Redmi A5 | Unisoc T7250, 3 GB or 4 GB RAM, Android 15 Go, memory extension available |

---

# PART III. DESIGN SYSTEM (iOS-standard finish on Android and the web)

Target: the finish of the best iOS-standard apps: grouped layering, restrained color, large-title navigation, hairline borders, no framework defaults. **The ten values are binding.** V1 it must feel like its tier, not the framework. V2 every interactive element looks interactive. V3 icons and type match in visual weight. V4 brand appears once per screen. V5 space is intentional. V6 empty boxes are bugs. V7 anything that should be fixed is structurally fixed. V8 the cheapest supported phone is the target device. V9 two gates before any screen is done: analysis and tests, and a screenshot compared with a reference-tier app. V10 uncertain visuals are prototyped in isolation first. **No raw values in widget code: always a token.** The app is built on `WidgetsApp` with its own components; Material and Cupertino widgets and imports are not used in `widgets/` and `screens/` (test F234 scans for them). The one exception is the platform text-selection handles and toolbar.

## 20. Tokens

### 20.1 Color (contrast computed; every text pair meets 4.5:1)

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `bgPrimary` | #F2F2F7 | #000000 | Scaffold |
| `bgSecondary` | #FFFFFF | #1C1C1E | Cards, sheets, dialogs |
| `bgTertiary` | #E8E8EE | #2C2C2E | Inputs, empty and disabled fills |
| `accent` | #4338CA | #8F89FF | Primary actions, active state |
| `accentDim` | #372FA8 | #756DF0 | Pressed state |
| `textPrimary` | #111114 | #F5F5F7 | Headlines, body |
| `textSecondary` | #55555F | #A8A8B3 | Subtitles |
| `textTertiary` | #62626D | #9A9AA5 | Placeholders, timestamps |
| `borderSubtle` | #D8D8E0 | #38383D | Card borders, dividers |
| `borderFocus` | = accent | = accent | Active input border |
| `error` | #C81E2B | #FF6B63 | Validation, destructive, red animation zone |
| `success` | #15793A | #3DDC84 | Approved, saved, green animation zone |
| `warning` | #9A5200 | #FFB340 | Attention, amber animation zone |

Key ratios: textPrimary on cards 18.85 (light) and 15.63 (dark); textSecondary on bgPrimary 6.60 and 8.92; textTertiary on bgTertiary 4.93 and 5.00; button label on accent 7.90 (white) and 6.71 (dark ink #0B0B14); accent text on cards 7.90 and 5.83; error on cards 5.71 and 6.11. Domain tokens by meaning: `statusPending`, `statusGenerating`, `statusReady`, `statusApproved`, `statusFailed`, `scrim` (black at 40%). **Status and zones are never color alone: always an icon and a label.**

### 20.2 Typography (bundled, open-license; fetched by F257)

| Role | Face | Use |
| --- | --- | --- |
| Brand | Instrument Serif | The wordmark only, once, on Home |
| Chrome | Inter 600 | Navigation titles, buttons, chips, labels |
| Body | Inter 400 | Reading text, the script editor |
| Monospace | JetBrains Mono | The 6-digit sign-in code and the referral code |
| Per-script | Noto Sans (Devanagari, Thai, Arabic, Hebrew, Bengali, JP, KR, TC) and Noto Nastaliq Urdu | UI text and captions in those languages |

SF Pro is not used. Ramp (size / weight / line height): Display 34/700/1.1, Headline 28/600/1.2, Title 1 22/600/1.3, Title 2 17/600/1.3, Body 17/400/1.5, Callout 16/500/1.4, Footnote 13/400/1.4, Caption 12/400/1.3. Fonts are bundled as assets on both platforms; the web never loads fonts from a CDN.

### 20.3 Spacing, shape, icons

- Spacing (4 px grid): 2, 4, 8, 16, 24, 32, 48, 64. Every gap is a decision; unrelated elements never share one uniform gap.
- Radii: card 16, hero 20, button 12, input 12, sheet top 20, chip full pill. Shadows: none (hairline border in light, fill only in dark); the scrim is the only overlay.
- Touch targets 48x48 dp minimum. Safe area honored at both edges of every screen.
- Icons: Phosphor Bold through one `AppIcon` wrapper and one alias file (F018). The bold stroke is 24 units on a 256 grid, 2.06 px at 22 px and 2.25 px at 24 px, matching the 2.0 to 2.25 rule. Sizes: nav 24, row leading 22, row trailing 16, hero 40. Each icon sits in a 40x40 container unless it lives inside a card or chip. The icon font is a direct dependency, checked at G3 so no icon renders as an empty box.

### 20.4 Motion and accessibility

| Interaction | Duration | Easing |
| --- | --- | --- |
| Screen push / pop | 350 / 280 ms | ease-in-out (fade plus 20 px slide) |
| Sheet present | 400 ms | ease-out |
| Button press | 150 ms | ease-out, scale to 0.97 |
| Card press | 150 ms | opacity to 0.7 (no ripple, no elevation) |
| Slider thumb | 0 ms follow, 150 ms zone-color change | ease-out |
| Theme toggle | 200 ms | linear cross-fade |
| Reduce Motion | 0 ms | every animation becomes an instant opacity change |

No spring or bounce anywhere. Accessibility: a semantic label on every interactive element; dynamic type up to the platform maximum; color never the only signal; 4.5:1 contrast; 48x48 targets; Reduce Motion honored; verified reading order; web keyboard navigation with a visible focus ring (`borderFocus`).

## 21. Components (built before any screen; screens never reimplement them)

| Component | Behavior |
| --- | --- |
| Card | Secondary fill, hairline border, radius 16, optional leading icon, label, value, chevron; opacity press |
| Row | Transparent tappable row, leading icon, label, chevron; tint press |
| Chip | Small labeled pill (status, metadata) |
| Primary button | Filled accent, contrasting label, radius 12, 48 dp minimum, disabled at reduced opacity. Outlined primary buttons are forbidden |
| Section header | Small uppercase, letter-spaced, tertiary color |
| Empty state | Icon, title, optional subtitle, centered |
| Navigation bar | Large title in the chrome face; the wordmark only on Home; actions as 40x40 chips |
| Bottom action bar | Fixed; holds the primary button over a hairline border; collapses with its border and gap when the keyboard opens |
| Text field, sheet, dialog, switch, segmented control, snackbar, loading indicator, slider | Custom, built on `EditableText` and gesture primitives |

**Forbidden:** library defaults (ripple, elevation, surface tint); bare icons without a container; plain centered text as a control; outlined primary actions; duplicated brand; empty shadowed boxes while third-party content loads (collapse to zero height); scrolling on screens that do not need it; sticky headers not verified on device; any component reimplemented per screen; the body face used for UI labels.

## 22. Screens, layouts and responsive rules

**Shape of every screen.** Navigation bar; primary content; secondary actions as cards or rows; a fixed bottom bar with the primary filled button. No ads and no third-party embed slot.

**Responsive (the web is the same app).** Compact width under 600 dp: one column, bottom bar. Medium 600 to 1024: shot board three columns, sheets centered at 560 dp. Expanded over 1024: content in a centered column of at most 960 dp, shot board four columns with the summary row pinned at the top. Keyboard and pointer: every control reachable by Tab, Enter and Space; Escape closes sheets and dialogs. The layout never relies on hover.

**Shot board.** Two-column grid of 9:16 shot cards (thumbnail, number, status chip, an icon marking Animated or Pan/Zoom, credit badge); per-shot approve, regenerate, edit narration, report; a sticky summary row ('9 shots, 7 approved, 22 credits'); the fixed Render bar. Only the grid scrolls.

**Animate screen.**

1. A horizontal strip of shot cards (F199), each labeled with an icon and the word Animated or Pan/Zoom; tapping a card toggles it.
2. A slider (F184) from 0 to n with the AI's pick marked 'Recommended'; a live total of animated seconds and credits.
3. A zone card (F200) under the slider: green with a check icon and 'The video will look complete'; amber with a warning icon and the heavier-use text; red with an alert icon, the full list of implications, and the confirm button 'I understand, animate k shots for X credits'. Choosing all adds a checkbox.
4. Clip previews (F201) after generation, each with Keep and Reject and the credits already spent.

**Wallet screens.** Android: balance, Support ID, packs (Play sheet) and a row to the Account screen. Web: balance, Support ID, the three Polar packs and a row to the Account screen. Neither platform shows the other's purchase path.

**Right-to-left (Arabic, Hebrew, Urdu).** Layout flips from the locale through the directionality of the app shell. Use start and end insets only, never left and right. Mirror directional icons (chevrons, back). Flip the shot-board grid order. Keep the sign-in code, referral code, numbers and credit amounts left-to-right. Screenshot-test all three locales at G7.

**Style presets.** Defined in Section 5.3. Each carries a 448 px anchor image under `assets/styles/` (F259) and grade values tuned at G2.

---

# PART IV. BACKEND (CLOUDFLARE WORKER `videomilla-api`)

## 23. Worker specification

### 23.1 Routes (all under `/v1`)

Every route except `POST /session` requires `Authorization: Device <deviceId>.<secret>`. The secret is 256 random bits created at registration, stored only as a SHA-256 hash with the pepper. The API version is in the path. Request bodies are never logged. Sign-in, referral and account routes are listed in Part IX (Sections 52, 53 and 56).

| Route | Purpose | Rules |
| --- | --- | --- |
| `POST /session` | Register a device; create a wallet; return the device credential, balance and config version | Rate limited; stores no content |
| `GET /balance`, `GET /config` | Balance and debt; flags, credit costs, packs, language list, model IDs, voice routes, minimum app version | `426` below `min_app_version` |
| `POST /auth/email/request` | Send a login email (magic link plus 6-digit code) | Limits in Section 52.5; always answers 'sent' |
| `POST /auth/email/verify` | Verify a link token or a code and sign in | Five wrong attempts kill the code; merges this device's wallet into the account's |
| `POST /auth/google` | Sign in with a Google ID token |  |
| `DELETE /me`, `GET /me/export` | Delete server data; export ledger and purchase records as JSON (never the hash) | Anonymized purchase records are kept and the policy says so |
| `POST /structure` | Script to JSON scenes | Purchase gate; first 3 free per project then 1 credit; moderation; model per language; schema validation; style rules |
| `POST /assist` | Ideas, script improver, character builder, series summary | Shares the free counter with `/structure` |
| `POST /reference/check` | Reject images that contain a human face | Fail closed; image not stored |
| `POST /image` | One picture (portrait or keyframe) | Idempotency key; spend cap; moderation; reserve; commit or refund |
| `POST /tts` | Narration or line audio | Purchase gate for studio voices; text-length cap |
| `POST /clip/submit` | Reserve and enqueue 1 to n clips | Zone validation (`confirm_high`, `confirm_all`); fair use; caps; atomic reservation |
| `GET /clip/status`, `GET /clip/file` | Poll job state; download the MP4 from R2 with Range support | Files deleted after 24 hours |
| `POST /ack` | The app confirms it saved a result | Moves `committed` to `delivered` |
| `POST /report` | Report an output | Rate limited |
| `POST /purchase/play` | Verify a Play purchase and credit the wallet | Android only |
| `POST /checkout/polar` | Create a Polar checkout session | Web only |
| `POST /hooks/polar` | Polar webhook | Signature verified; idempotent by order ID |
| Cron (daily) and queue consumer | Maintenance; clip jobs | Capped batches; idempotent |

### 23.2 D1 schema (`migrations/0001_schema.sql` and `0002_clips.sql`)

```sql
CREATE TABLE wallets(
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  owed INTEGER NOT NULL DEFAULT 0 CHECK (owed >= 0),
  guard INTEGER NOT NULL DEFAULT 1,
  ever_purchased INTEGER NOT NULL DEFAULT 0,
  support_id TEXT UNIQUE,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE devices(
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  secret_hash TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE requests(
  key TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, device_id TEXT, action TEXT NOT NULL,
  credits INTEGER NOT NULL, status TEXT NOT NULL, settled INTEGER NOT NULL DEFAULT 0,
  project_id TEXT, provider TEXT, est_cost_micro INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER
);
CREATE TABLE ledger(
  id INTEGER PRIMARY KEY AUTOINCREMENT, wallet_id TEXT NOT NULL, delta INTEGER NOT NULL,
  kind TEXT NOT NULL, ref TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE purchases(
  ref_hash TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, channel TEXT NOT NULL,
  product_id TEXT, credits INTEGER NOT NULL, order_id TEXT, state TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), voided_at INTEGER
);
CREATE TABLE reports(id TEXT PRIMARY KEY, wallet_id TEXT, kind TEXT, ref TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), handled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE counters(key TEXT PRIMARY KEY, window TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE spend(day TEXT NOT NULL, kind TEXT NOT NULL, micro_usd INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, kind));
CREATE TABLE heartbeats(job TEXT PRIMARY KEY, last_run INTEGER NOT NULL);
CREATE TABLE config(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX idx_ledger_wallet ON ledger(wallet_id);
CREATE INDEX idx_requests_wallet ON requests(wallet_id, status);
CREATE INDEX idx_devices_wallet ON devices(wallet_id);

-- 0002_clips.sql
CREATE TABLE clips(
  key TEXT PRIMARY KEY REFERENCES requests(key), wallet_id TEXT NOT NULL, shot_id TEXT NOT NULL,
  provider TEXT, provider_job TEXT, seconds INTEGER NOT NULL, talking INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL, error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_clips_wallet ON clips(wallet_id, state);
```

### 23.3 Wallet ledger rules

D1 has no interactive transactions. Every critical operation is **one `db.batch([...])` of fixed statements**, which D1 runs atomically. A batch aborts only when a statement throws, not when an update changes zero rows, so the schema makes unwanted cases throw: `CHECK (balance >= 0)`, `CHECK (owed >= 0)`, primary keys on `requests.key` and `purchases.ref_hash`, and NOT NULL columns (`wallets.guard`, `requests.status`) that the statements set to NULL when a precondition fails. Route mapping: a primary-key error on `requests` is a duplicate (return the stored state, charge nothing); a CHECK error is insufficient credits; a `guard` error is outstanding debt; a NOT NULL error on status is an unknown wallet. The error-message substrings are confirmed at G6; only `classify()` changes if D1 words them differently.

```sql
-- reserve one request (several clips: several of these groups inside one batch, so all or none)
INSERT INTO requests(key,wallet_id,device_id,action,status,credits,project_id,provider,est_cost_micro,updated_at)
  VALUES(:k,:w,:d,:action,'reserved',:cost,:project,:provider,:est,:now);
UPDATE requests SET status = CASE WHEN EXISTS(SELECT 1 FROM wallets WHERE id=:w AND deleted=0) THEN 'reserved' END WHERE key=:k;
UPDATE wallets SET balance = balance - :cost, guard = CASE WHEN owed = 0 THEN 1 END WHERE id=:w;
INSERT INTO ledger(wallet_id,delta,kind,ref) VALUES(:w,-:cost,'reserve',:k);

-- commit (one statement; check the changed-row count)
UPDATE requests SET status='committed', updated_at=:now WHERE key=:k AND status='reserved';

-- refund (one batch; the settled flag makes a repeat a no-op)
UPDATE requests SET status='refunded' WHERE key=:k AND status IN ('reserved','committed');
INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT wallet_id,credits,'refund',key FROM requests WHERE key=:k AND status='refunded' AND settled=0;
UPDATE wallets SET balance = balance + (SELECT credits FROM requests WHERE key=:k AND status='refunded' AND settled=0)
  WHERE id = (SELECT wallet_id FROM requests WHERE key=:k AND status='refunded' AND settled=0);
UPDATE requests SET settled=1 WHERE key=:k AND status='refunded' AND settled=0;

-- credit a purchase (token or order key rejects a replay; debt is paid first)
INSERT INTO purchases(ref_hash,wallet_id,channel,product_id,credits,order_id,state) VALUES(:h,:w,:ch,:product,:credits,:order,'paid');
UPDATE purchases SET wallet_id = CASE WHEN EXISTS(SELECT 1 FROM wallets WHERE id=:w AND deleted=0) THEN :w END WHERE ref_hash=:h;
INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT id, MAX(:credits-owed,0), 'purchase', :h FROM wallets WHERE id=:w;
UPDATE wallets SET balance = balance + MAX(:credits-owed,0), owed = MAX(owed-:credits,0), ever_purchased = 1 WHERE id=:w;

-- void a purchase (refund or chargeback)
INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT id, -MIN(balance,:credits), 'void', :h FROM wallets WHERE id=:w;
UPDATE wallets SET balance = MAX(balance-:credits,0), owed = owed + MAX(:credits-balance,0) WHERE id=:w;
UPDATE purchases SET state='voided', voided_at=:now WHERE ref_hash=:h;
```

The **link** operation (also used by sign-in) is a batch that points the device at the target wallet, moves the old wallet's balance, debt, open requests and purchases to it, writes `merge_out` and `merge_in` ledger rows, and marks the old wallet deleted. Scenarios the tests must prove (G6): 300 concurrent spends against a balance of 100 (exactly 100 succeed); the same key retried 80 times (charged once); 40 racing refunds (once); commit racing refund (one consistent state); the same purchase reference 60 times (credited once); two devices signing in to one account at once (balance conserved); 500 random concurrent operations (balance never negative, ledger equals balance); debt after a void (spending blocked, repaid first); an unknown wallet (no free action, no burned reference); atomic multi-clip reservation (all or none).

### 23.4 Request protocol (idempotent, crash-safe)

- **States:** `reserved` (work in flight), `committed` (work done, delivery unknown), `delivered` (the app confirmed it saved the result), `refunded`.
- **First call:** the reserve batch, then the work, then one conditional update to `committed`; a failure runs the refund batch.
- **Retry with the same key:** `reserved` and changed within 120 seconds returns `in_progress`; `reserved` and older is taken over with a conditional update on `updated_at`; `committed` serves the stored result again (clips are in R2, so no second provider call) or redoes a picture without charging; `delivered` returns `delivered`; `refunded` returns `refunded` and the app may start a new job with a new key.
- **Cron:** refunds `reserved` requests whose `updated_at` is older than 15 minutes (30 minutes for clips, which can wait in the queue).
- **Free counters** use `UPDATE counters SET count = count + 1 WHERE key = ? RETURNING count`, and the caller treats a returned value above 3 as chargeable. D1 support for `RETURNING` and changed-row counts is confirmed at G6.

### 23.5 Structuring, moderation and style rules

1. Moderate the script (Llama Guard 3 on Workers AI; fail closed).
2. Choose the model by language (Section 6); call it in JSON mode; validate against the schema (at most 15 shots, 6 characters, 2 per shot; camera and motion enums); retry twice.
3. For Qwen-routed languages: also get an English translation of each narration line and moderate it, and run the independent source-language classifier (a JSON verdict, the script passed as quoted data).
4. Apply `style_rules.ts`: children (`child`, `teen`) only in `storybook`, `comic`, `flat_vector`, `watercolor`; Realistic Scenes needs an empty character list; any violation returns `needs_style_change` with the allowed options.
5. Moderate every final picture and clip prompt before generation. The prompt always appends: no text in the image; for Realistic Scenes, no people and no human figures.

```ts
const CARTOON = new Set(['storybook', 'comic', 'flat_vector', 'watercolor']);
export function styleVerdict(style: string, ages: string[]): 'ok' | 'needs_style_change' | 'invalid' {
  if (style === 'realistic_scenes') return ages.length === 0 ? 'ok' : 'invalid';
  const minors = ages.some((a) => a === 'child' || a === 'teen');
  return minors && !CARTOON.has(style) ? 'needs_style_change' : 'ok';
}
```

### 23.6 Animation rules on the server

```ts
export function zoneCheck(n: number, k: number, confirmHigh: boolean, confirmAll: boolean): boolean {
  const half = Math.ceil(n / 2);   // half, rounded up
  if (k > half && k > Math.max(1, Math.round(n / 3)) && !confirmHigh) return false;
  if (k === n && n >= 3 && !confirmAll) return false;
  return true;
}
```

Clip seconds are 3 to 8, billed at 2 credits per second (a request with audio is billed by the audio's length, so credits for a talking shot are `max(6, 2 * ceil(audioSeconds))`). Fair use per wallet: 150 animated seconds a day, 2 clips in flight, 200 pictures a day; the queue consumer re-queues a job with a delay when its wallet already has 2 in flight.

### 23.7 Clip jobs and providers

`POST /clip/submit` validates, moderates, checks caps, reserves all clips atomically, writes each input (first-frame JPEG, optional line audio) to R2 under `in/<key>`, and enqueues `{key}`. The queue consumer (15 minutes of wall time) loads the inputs, calls the provider chosen by the router, writes the MP4 to `out/<key>`, commits the request, updates the `clips` row, deletes the inputs, and on failure after retries refunds. The app polls `GET /clip/status`, downloads from `GET /clip/file`, then calls `POST /ack`.

| Provider call | Shape (checked October 2026) |
| --- | --- |
| Segmind (primary) | `POST https://api.segmind.com/v1/p-video-2`, header `x-api-key`; body `prompt`, `image` (first frame), `audio` (line audio, optional), `duration` (omitted when audio is given), `resolution` '720p', `fps` 24, `draft` false, `save_audio` false, `prompt_upsampling` false, `seed`; the MP4 is the response body; billed per second returned |
| Pruna direct (fallback 1) | `POST https://api.pruna.ai/v1/predictions` with headers `apikey` and `Model: p-video-2` (add `Try-Sync: true` for a synchronous reply); body `{ input: {...} }` with the same fields; the image is first uploaded with `POST https://api.pruna.ai/v1/files` (multipart field `content`) and referenced by the returned file URL; `disable_safety_filter` is **set to false** (its default is true); rate limit 250 requests a minute |
| Gemini Veo (fallback 2) | `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:predictLongRunning` with header `x-goog-api-key`; poll the returned operation name; read the video URI at `response.generateVideoResponse.generatedSamples[0].video.uri` and download it with the key header; 16:9 or 9:16; first and last frame supported; the Lite model ID is read from the model list and pinned in config at G8 |

`aspect_ratio` is ignored by Pruna when an input image is given, so the keyframe's own aspect (9:16 or 16:9) decides the clip. The router reads `clip_routes` from D1: an ordered list of `{provider, model, cost_per_second_micro, role, accepts_audio}`; it skips providers whose daily cap or the fallback budget is exhausted, and records the chosen provider and expected cost on the request.

### 23.8 Polar and Play

**Polar.** `POST /checkout/polar` creates a checkout with `products` (one Polar product ID), `external_customer_id` set to the wallet ID, `metadata` carrying the wallet ID and pack, and a `success_url` containing `{CHECKOUT_ID}`. The webhook `order.paid` credits the wallet once per order (the reference is a hash of the order ID); `order.updated` with a refund or full refund voids it. The signature is verified with the webhook secret using Polar's documented method before anything else runs; the exact scheme is confirmed at G12 with a test-mode event. The wallet ID is the external customer identifier, and the signed-in account's email is passed to Polar as the customer email so the checkout page opens pre-filled (Section 52.6); the Worker keeps the email only in the accounts table.

**Play.** `POST /purchase/play` reads `{product_id, purchase_token}`, calls the Play Developer API with a service-account token signed by Web Crypto, requires the purchased state, maps the product to credits from config, runs the credit batch with the SHA-256 of the token, consumes the purchase (and acknowledges if G14 shows it is needed). The route requires a signed-in wallet and runs `grantReferral` (Section 53) on a qualifying first purchase. The daily cron pages the voided-purchases list and applies voids.

### 23.9 Cron (daily) and cleanup

In order, each with a capped batch: refund stale reservations; refund stale clip jobs; delete R2 objects older than 24 hours; apply Play voids; write cap milestones (50% and 80%) to D1; write the heartbeat. Every write is idempotent. D1 has no billing cap, so no loop is unbounded.

### 23.10 Config keys, secrets, bindings

Config (D1 `config`): `credit_costs`, `packs_play`, `packs_polar`, `models`, `language_models`, `voice_routes`, `clip_routes`, `languages_enabled`, `flags`, `min_app_version`, `caps` (video $10, workers\_ai $3.30, fallback $3, google\_chars), `fair_use`, auth, referral, r7. Secrets: `GOOGLE_SA_JSON`, `GEMINI_API_KEY`, `SEGMIND_API_KEY`, `PRUNA_API_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `BREVO_API_KEY`, `GOOGLE_OAUTH_CLIENT_IDS`, `PEPPER`. Bindings: `AI`, `DB`, `CLIPS` (R2), `CLIP_JOBS` (queue, producer and consumer).

```toml
name = 'videomilla-api'
main = 'src/index.ts'
compatibility_date = '2026-10-29'

[ai]
binding = 'AI'

[[d1_databases]]
binding = 'DB'
database_name = 'videomilla-db'
database_id = '<printed by: wrangler d1 create videomilla-db>'
migrations_dir = 'migrations'

[[r2_buckets]]
binding = 'CLIPS'
bucket_name = 'videomilla-clips'

[[queues.producers]]
queue = 'clip-jobs'
binding = 'CLIP_JOBS'

[[queues.consumers]]
queue = 'clip-jobs'
max_batch_size = 1
max_concurrency = 4
max_retries = 2

[triggers]
crons = ['0 3 * * *']

[limits]
cpu_ms = 60000
```

### 23.11 Conversion counters (the purchase-gate metric)

With no free trial, the purchase gate is the number that decides whether the product works, so the Worker counts it. Both counters use the existing `counters` table; no new table or file is added.

- `r7:gate_wallets` goes up once per wallet, the first time `POST /structure` or `POST /assist` answers 'purchase required' (F091, F094). A marker row `r7:seen:<walletId>` makes it once only.
- `r7:first_buyers` goes up once per wallet, when `creditPurchase` changes `ever_purchased` from 0 to 1 (F073). A refund does not decrement it.
- The daily cron (F106) writes `r7_summary` (gate wallets, first buyers, ratio) into D1 config, and a milestone row when gate wallets pass the `r7.review_at` figure (default 500).
- The Worker only records. Whether to change the gate, for example the free analysis allowance, is a decision you take from the figures in the runbook; nothing changes by itself. No identifier leaves the Worker.

## 24. The three flows that cross the most files

**Picture.** The shot board (F209) asks the shot-board provider (F155) for a cost preview from `ledger_math` (F057) and shows the cost sheet (F192). On confirm the job queue (F060) marks the shot `reserved` and calls `ImageService` (F043, adapter F115), which posts to `/image` (F092). The Worker reserves through `ledger.ts` (F073), moderates through `moderation.ts` (F078), calls FLUX.2 klein, commits, and returns base64. The app re-saves the picture through the store adapter (F123 or F133), calls `/ack`, and the shot card (F186) rebuilds because its `ListenableBuilder` listens to the provider.

**Animated clip.** The animate screen (F211) reads the animation planner (F058) for zones and warnings, shows the warning card (F200), and on confirm the animate provider (F156) synthesizes any line audio through the voice service, builds the clip requests, and posts them through `clip_generator_worker` (F116) to `/clip/submit` (F100). The consumer calls the provider, writes R2, and commits; the provider polls `/clip/status` (F101), downloads from `/clip/file` (F102), shows the clip preview (F201), and the user keeps or rejects it.

**Purchase and wallet.** Android: the store screen (F214) lists pack cards (F191) from the purchase provider (F160), which uses `billing_adapter` (F136); the result goes to `/purchase/play` (F111). Web: the same provider uses `web_checkout_adapter` (F121) to open the Polar checkout from `/checkout/polar` (F103); Polar calls `/hooks/polar` (F104). Both credit the same wallet through `ledger.ts`; the wallet provider (F159) refreshes the balance chip (F190).

---

# PART V. BUILD PLAN

## 25. Phases and the 32 batches (dependency order)

Phases are logical dependency order; batches are operational push cadence. A batch never spans phases out of order. Batch size follows dependency order and has no fixed cap (the largest is p1a, with 16 files).

| Phase | Contents | Files | Numbers |
| --- | --- | --- | --- |
| 0 Pre-build | Repo scaffold, website skeleton | 8 | F001 to F008 |
| 1 Foundation | Dependencies, lint, tokens, theme, errors, constants, English strings | 16 | F009 to F024 |
| 2 Models | 16 immutable models (F038 retired) plus account, referral and sound models | 19 | F025 to F041 except F038; F293 to F295 |
| 3 Contracts and logic | 13 contracts, 6 pure-logic files, 3 new contracts, referral math | 23 | F042 to F060; F296 to F299 |
| 4 Worker | Core, ledger, safety, providers, AI routes, clips, Polar, Play, accounts, email, referrals, tests | 65 | F061 to F112; F280 to F292 |
| 5 Platform adapters | Shared, web, Android (including Kotlin), sign-in adapters and the registry | 39 | F113 to F146; F300 to F304 |
| 6 Providers | 18 providers (F161 retired), 3 new providers and the app scope | 22 | F147 to F166 except F161; F305 to F307 |
| 7 Widgets | 37 components and widgets plus 5 new widgets | 42 | F167 to F203; F308 to F312 |
| 8 Screens | 17 screens plus the account and login screens | 19 | F204 to F220; F313, F314 |
| 9 Shell, tests, translations | Shell, 15 tests, 19 translation files | 37 | F221 to F254; F315 to F317 |
| 10 Assets, CI, store | Assets, sound manifest, workflows, final site files, Android config, store documents, Android tests | 28 | F255 to F279; F318 to F320 |

| # | Batch | Files | Range | Adds | Depends on | Gate at end |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | gates | 0 | none | Throwaway spikes for G1, G2, G3, G5, G8, G13, G15 | accounts (Section 4) | all pass |
| 1 | s0 | 2 | F001 to F002 | Ignore file, README | repo URL | push succeeds |
| 2 | site-a | 6 | F003 to F008 | Website skeleton; connect Pages; record the URL | s0 | Pages build green |
| 3 | p1a | 16 | F009 to F024 | Pinned dependencies, lint, tokens, theme, errors, constants, `l10n.yaml`, English strings | G3 | pub get, gen-l10n, analyze |
| 4 | m1 | 9 | F025 to F033 | Models | p1a | analyze |
| 5 | m2 | 10 | F034 to F037, F039 to F041, F293 to F295 | Models (F038 retired); account, referral and sound models | m1 | analyze |
| 6 | c1 | 13 | F042 to F054 | Contracts | m1, m2 | analyze |
| 7 | c2 | 10 | F055 to F060, F296 to F299 | Render plan, captions, ledger math, animation planner, dialogue planner, job queue; auth, referral and sound contracts; referral math | m1, m2 | analyze |
| 8 | wa | 12 | F061 to F066, F068 to F072, F076 | Worker core, schema, rate limit | accounts | typecheck, test |
| 9 | wb | 11 | F073 to F075, F077 to F081, F083 to F085 | Ledger, caps, tokens, moderation, style rules, prompts, schemas, report, tests | wa | typecheck, test; **G6** |
| 10 | wc | 13 | F086 to F098 | Provider adapters, AI routes, reference check, tests | wb | typecheck, test |
| 11 | wd | 14 | F099 to F109, F280, F289, F292 | Clip routes, Polar, cron, protocol tests; accounts migration, referral logic and its test | wc | typecheck, test |
| 12 | wp | 3 | F110 to F112 | Play verification, test | wd | typecheck, test |
| 13 | wq | 12 | F067, F082, F281 to F288, F290, F291 | Router (`index.ts`), accounts library, account routes, email router and senders, email templates, email and Google sign-in routes, referral route, two tests | wp | typecheck, test; **G16** |
| 14 | a1 | 13 | F113 to F122, F300 to F302 | Shared adapters, image prep; auth, referral and sound adapters | c1, c2, wa to wq | analyze |
| 15 | a2 | 8 | F123 to F129, F303 | Web adapters, render worker, host page, web Google sign-in | a1 | analyze |
| 16 | n1 | 8 | F130 to F136, F304 | Android adapters, render spec, billing, Android Google sign-in | a1 | analyze |
| 17 | n2 | 10 | F137 to F146 | Foreground service, file service, Kotlin plugin and service, platform registry | n1, a2 | analyze |
| 18 | p3a | 10 | F147 to F156 | Providers 1 to 10 | c1, c2, n2 | analyze |
| 19 | p3b | 12 | F157 to F160, F162 to F166, F305 to F307 | Providers 11 to 19 (F161 retired), `app_scope`; auth, referral and sound providers | p3a | analyze |
| 20 | p4a | 14 | F167 to F179, F308 | Primitives; code field | p1a, p3b | analyze |
| 21 | p4b | 14 | F180 to F191, F309, F310 | Widgets; referral card, sound picker | p4a | analyze |
| 22 | p4c | 14 | F192 to F203, F311, F312 | Sheets, animate widgets; auth sheet, Cartoon Me sheet | p4b | analyze |
| 23 | p5a | 9 | F204 to F212 | Create-flow screens | p4c | analyze |
| 24 | p5b | 10 | F213 to F220, F313, F314 | Library, wallet, settings screens; account and login screens | p5a | analyze |
| 25 | p6a | 7 | F221 to F227 | `main`, shell, router, 4 tests | p5b | analyze, test |
| 26 | p6b | 11 | F228 to F235, F315 to F317 | 8 tests; auth, referral and sound tests | p6a | analyze, test |
| 27 | p6c | 10 | F236 to F245 | 10 translations | p6b | gen-l10n, analyze |
| 28 | p6d | 9 | F246 to F254 | 9 translations | p6c | gen-l10n, analyze |
| 29 | p7a | 9 | F255 to F261, F318, F319 | Icon, splash, fonts script, notices, styles, templates, PWA manifest; sound manifest and licenses; pubspec asset sections | p6d | analyze |
| 30 | p7b | 6 | F262 to F266, F320 | Two workflows, three legal pages, `_headers` | p7a | analyze |
| 31 | n3 | 8 | F267 to F274 | Android build files, signing script, Android workflow, check workflow | p7b | analyze |
| 32 | n4 | 5 | F275 to F279 | Store documents, Android tests | n3 | analyze, test; final gate |

Strict dependency chain: models need nothing; contracts need models; adapters need contracts and the Worker routes they call; providers need contracts and models; widgets need tokens, theme, localization and providers; screens need widgets and providers; the router and `main` need screens. The Worker depends on accounts only. A file may refer to a later batch's asset or page by path or URL (icons, fonts, JSON assets, manifests, legal pages); it may never import a later batch's code. English strings are appended to `app_en.arb` in batches p4a to p6a (6 appends); the other 19 languages are generated after the screens are final.

## 26. Gates (16)

| Gate | When | What is proven | Pass | If it fails |
| --- | --- | --- | --- | --- |
| **G1 Browser render** | Batch 0 | A 6 s 720x1280 sample (still with zoom, a 5 s clip, two audio lines, captions) rendered in Chrome on the Redmi A5 | Captions correctly shaped for Latin, Cyrillic, Devanagari, Thai, Arabic, Hebrew, Bengali, Urdu, Japanese, Korean, Chinese; audio within 100 ms; at most 8 times real time; hardware encoder present | Lower the default resolution or length; Export images and audio becomes the web fallback |
| **G2 Face, style, color** | Batch 0 | 10 shots of one character in each cartoon style and in Photoreal Story, each using references and the style anchor; 20 Realistic Scenes prompts | Character recognizable in at least 8 of 10 with one regeneration each; palette holds after the grade; no person in any Realistic Scenes image; the 8 style anchors saved | Tune prompts, references and grades; evaluate klein 9B; one character per shot |
| **G3 Toolchain and licenses** | Batch 0 | Flutter 3.47.1 (Dart 3.13.1) installed and analysis clean in Ubuntu on the phone; every plugin and library pinned; Media3 version compile-confirmed (image items, matrix transformation, overlay effect); Mediabunny pinned; icon font renders; licenses read (P Video 2's LTX-2 license, FLUX.2 klein, Qwen3, Llama) | Analyze clean; timings recorded (if analysis exceeds 5 minutes a batch, `check.yml` handles analysis); all license terms allow this use | Different versions; never proceed unpinned |
| **G4 Deploy dry run** | After wq | `deploy_worker` and `deploy_web` run by hand to staging names; Pages builds the static site | All succeed | Fix workflow files in a `p7-fix` batch |
| **G5 Moderation red-team** | Batch 0 and after wc | Harmful, sexual, minors, real-person, celebrity, licensed-character and injection prompts, plus horror prompts at the moderate line and over it in English and each language; a failed moderation call; provider safety filter on | All blocked or sanitized; failure blocks and charges nothing | Tighten prompts and rules; a language with poor results does not ship |
| **G6 D1 ledger** | After wb | The ledger scenarios in Section 23.3 and protocol cases on real D1, locally and on staging; `RETURNING` and changed-row counts; error-message strings; wallet link merge; atomic multi-clip reservation | All pass | Fix the SQL before any ledger code |
| **G7 Language quality** | Per language, from p6d on | Per language: five scripts structure within two tries; translated red-team set blocked; a voice works on Android and the web (Hebrew and Traditional Chinese voices confirmed); captions render; UI has no truncation; right-to-left mirrors; machine translation cross-checked | Every item passes for that language | That language does not ship until fixed |
| **G8 Animation providers** | Batch 0 and after wd | 30 clips through Segmind, a sample through Pruna direct and through Veo Lite; per-second billing; per-clip latency; queue consumer duration; rate limits; talking shots with audio; `disable_safety_filter` false accepted | First frame matches the keyframe; face and outfit recognizable in at least 80% without regeneration; billing equals returned seconds; every provider reachable | Revise prompts, tier or provider order; keep Animate at the fallback route |
| **G9 Series continuity** | Final gate | Three episodes of about 30 s, 2 characters, 2 locations | At least 80% of shots recognizable; summary keeps names and facts; reused characters cost 0; compilation joins matching audio | Tighten reference priority or the summary prompt |
| **G10 Talking and voices** | Final gate | 10 dialogue scenes with per-character voices | Each character's voice is consistent; lip-sync acceptable in at least 80%; voice-over fallback works; clip seconds follow the audio length rule | Fall back to voice-over for all talking shots |
| **G11 No-people style** | After wc and final | 100 prompts (landscapes, food, buildings, objects, animals, adversarial) | No picture contains a person; the validator rejects any shot that lists a character | Strengthen the prompt suffix and the check |
| **G12 Polar round trip** | After wd | Test-mode checkout, `order.paid` credits once, replay ignored, refund voids, signature verified, the same account reaches one wallet on the web and in the app; payout onboarding shows active for the seller and, after the first live order, a payout request is accepted (the $10 minimum, settlement delay and transfer time are recorded) | All pass | Fix before live mode |
| **G13 Reference check** | Batch 0 | 50 face images and 50 plain art images | At least 98% of faces rejected; at least 90% of plain art accepted; outage fails closed | Change the vision model or threshold |
| **G14 Play round trip** | Final gate | License-tester purchase of each pack, verification, consume (acknowledge if needed), replay rejected, refund voided by cron | Credits appear once | Fix the verifier |
| **G15 Android render and service** | Batch 0 and final | Media3 render on the Redmi A5; captions per script; audio sync; at most 6 times real time; foreground service on Android 15 Go survives backgrounding; resumes after the app is killed; manifest merge names; ABI check (`Build.SUPPORTED_ABIS`) | All pass | Different service type or smaller defaults |

G16 Sign-in and email runs after batch wq; its definition and the extended checks inside G1, G3, G5, G6, G12, G13 and G15 are in Section 58.2. Batch 0 spikes are throwaway scripts and one small Kotlin app and one HTML page; none is committed to main.

## 27. The Termux execution loop (MANDATORY)

**Preconditions.** Create the empty public repo `videomilla` (no README, ignore file or license). Send its URL to the generating agent; no command is generated against an assumed URL. Open the accounts in the Section 4 order and fill Section 3.

**Phone environment (once; the 18 setup commands).**

```
pkg update && pkg upgrade -y
pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
apt update && apt install -y git curl unzip xz-utils zip nodejs npm
git config --global user.name 'VideoMilla'
git config --global user.email 'stmakarios@gmail.com'
ssh-keygen -t ed25519 -C 'stmakarios@gmail.com'
cat ~/.ssh/id_ed25519.pub        # add this key at github.com/settings/keys
ssh -T git@github.com
git clone https://github.com/flutter/flutter -b 3.47.1 ~/flutter
echo 'export PATH=$HOME/flutter/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
flutter doctor
flutter precache --web
git clone git@github.com:<your-user>/videomilla.git ~/videomilla
node --version && npm --version
flutter --version
```

`flutter analyze` needs Flutter and Dart only, not the Android SDK; release builds run in CI. iOS is never built. If analysis cannot run on the phone the loop pauses; the fix is never a `push:` trigger.

**Per-batch loop.** Every batch emits exactly four command groups, in order, then waits.

```
# 1 place files (one command per file, in manifest order)
# 2 analyze
cd ~/videomilla/app && flutter pub get && flutter gen-l10n && flutter analyze      # app batches
cd ~/videomilla/worker && npm install && npm run typecheck && npm test              # worker batches
# 3 stage and commit
cd ~/videomilla && git add . && git commit -m '<batch-id>: <batch-purpose>'
# 4 push
git push origin main
```

Hard rules: zero analysis errors before group 3 (warnings and infos are tolerated; errors never); the commit format is fixed (`p4b: widgets`, for example); no batch is pushed with analysis failing; the next batch starts only after the developer confirms group 4 succeeded. Batch s0 also runs `git branch -M main` and `git push -u origin main`; its commit holds the ignore file before any dependency resolution.

**Command accounting (exact).**

| Category | Count |
| --- | --- |
| One-time setup | 18 |
| Per-batch fixed commands: s0 6, site-a 4, 30 batches at 8 | 250 |
| File placements, one per file | 318 |
| English string appends (p4a, p4b, p4c, p5a, p5b, p6a) | 6 |
| pubspec asset, font and plugin sections (p7a) | 1 |
| Assets script run (1) and style-anchor copies (8) | 9 |
| Sound files copied with one command (p7a) | 1 |
| **Total** | **603** |

Fix cycles add 5 commands each (edit, analyze, add, commit, push); plan for about 6. The first real compile of the Kotlin and JavaScript files happens at the final gate, because `flutter analyze` neither compiles Kotlin nor runs a browser; the optional manual `check.yml` can compile earlier at a cost of CI minutes.

**Contract block (emitted before batch 1).**

```
REPO URL:       <supplied by developer>
WORKING DIR:    ~/videomilla (inside the Ubuntu environment)
BATCH PLAN:     0 gates, then s0, site-a, p1a, m1, m2, c1, c2, wa, wb, wc, wd, wp, wq, a1, a2, n1, n2,
                p3a, p3b, p4a, p4b, p4c, p5a, p5b, p6a, p6b, p6c, p6d, p7a, p7b, n3, n4
PER-BATCH LOOP: place -> analyze -> commit -> push
FINAL GATE:     manual workflows after the last batch only
```

| Failure | Response |
| --- | --- |
| Dependency resolution fails | Patch `pubspec.yaml` or `package.json`; restart at group 2 |
| Analysis errors | The agent receives the output verbatim, patches, restarts at group 2 |
| Push rejected | Pull with rebase, re-run group 4 |
| A clean batch breaks a later batch | Batching error; re-split before continuing |
| A workflow fails at the end | A CI configuration failure: fix in a `p7-fix` batch and re-trigger manually |

## 28. Accounts needed before each batch

| Before | Needed |
| --- | --- |
| Batch 0 | Segmind key and float; Cloudflare; Google Cloud; Gemini key; Pruna key; the Redmi A5 |
| s0 | GitHub repo URL |
| site-a | Cloudflare Pages project connected to the repo |
| wa | Cloudflare token, D1 created, R2 bucket and queue created |
| wb to wp | Worker secrets; Polar products; Play service account (wp); for wq also the domain on Cloudflare, the Brevo key with its domain authentication and the Google OAuth client IDs |
| n3 | Android keystore and the four GitHub secrets |
| Final gate | All of the above plus Play Console app entry |

## 29. The single final gate

After batch 31 is pushed and analysis is clean at HEAD:

1. Run `deploy_worker` (manual): the Worker, D1 migrations, R2 and the queue go live.
2. Dispatch `deploy_web` and `build_android` back to back. The static site is already live from batch 2.
3. Download the APK artifact and sideload it on the Redmi A5; open the web app in Chrome on the same phone.
4. Run the round trips: G12 (Polar test mode), G14 (Play license tester), G15 (render and service), G16 (sign-in and email), G9, G10, and G7 for each language you intend to ship.
5. Sign in to the web app and the Android app with the same email and confirm one shared balance.
6. Switch Polar from test to live mode and confirm a real $4.99 order credits a wallet; once the balance reaches the minimum, request a payout and record the settlement and transfer times.
7. Upload the AAB to an internal test track to lock the package ID, then start the closed test (12 testers, 14 continuous days) for production access. Switch the cartoon\_me\_enabled flag on after the Play approval.

**Forbidden before this point:** tag-triggered builds; commit-message triggers; editing a workflow to add `push:`; triggering a build mid-way 'to see if it compiles' (use the optional `check.yml` or a local debug build instead).

---

# PART VI. FILE SPECIFICATION (F001 to F320)

## 30. How to read the file tables

Each row gives the path, what the file contains, how it works in the product, and its connections: **D** = depends on, **U** = used by (file numbers). Paths are relative to `app/lib/` unless they start with `app/`, `worker/`, `website/`, `.github/`, `store_submission/` or are at the repo root. Snippets show the shape, not the final text; final text is generated batch by batch under the Termux loop. Where a value must be pinned (versions, model IDs, Kotlin library versions) the file says 'pinned at G3' and nothing floats.

**Shared type vocabulary used by every later table.** `AspectOption {portrait, landscape}`; `StyleId {storybook, comic, flatVector, watercolor, inkNoir, cinematic, photorealStory, realisticScenes}`; `CaptionStyle {bold, clean, outline}`; `AgeBand {child, teen, adult, mid, elder}`; `MotionKind {animate, zoomIn, zoomOut, panLeft, panRight, hold}`; `ShotState {pending, reserved, generating, ready, approved, failedRetriable, failedTerminal}`; `ClipState {queued, running, ready, kept, rejected, failedRetriable, failedTerminal}`; `AnimationZone {green, amber, red}`; `JobKind {structure, assist, picture, portrait, clip, tts, reference}`; `Channel {play, polar}`.

## 31. Phase 0: Pre-build (batches s0, site-a; F001 to F008)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F001 | `.gitignore` | `build/`, `.dart_tool/`, `symbols/`, `*.jks`, `*.keystore`, `key.properties`, `node_modules/`, `.wrangler/`, `.env`, `.dev.vars`, `*.log`, `app/android/local.properties`, `spikes/` | Committed before any dependency resolution so artifacts and secrets are never staged | U: git |
| F002 | `README.md` | Setup, the batch loop, the four manual workflows, the gate list, the Section 3 table pointer, support contact; no secrets | Onboarding for you and the agent | none |
| F003 | `website/index.html` | Head with title, description, `viewport-fit=cover`, `color-scheme`; wordmark; one-sentence promise; buttons 'Open the web app' (the `videomilla-app.pages.dev` address) and a Google Play badge added when the listing exists; sample grid filled by an inline script from `samples/manifest.json`; four how-it-works cards; the language list; the 'Built with Llama' notice; footer links; contact email | Static; colors are CSS variables with a dark-mode block; the grid collapses to nothing when the manifest is missing or empty | D: F007, F008. U: store listings |
| F004 | `website/privacy.html` | Who we are (VideoMilla, contact `stmakarios@gmail.com`); what is processed (scripts, prompts, reference pictures, line audio, purchase data); processors (Cloudflare Workers AI and D1, Google Cloud Text-to-Speech, Segmind and Pruna, Google Gemini as fallback, Polar (which receives the account email to pre-fill checkout), Google Play); what is stored (device credential, wallet, ledger, purchase records, the account email and Google subject, referral records, clips up to 24 hours, reports); what is not (no ads, no tracking, no pictures or scripts stored; the only personal data kept is the email address you sign in with); retention; age 13+; rights (export and delete in the app, Support ID); transfers; changes | The Play Data safety form must match it exactly | D: F007. U: store listings, F217 |
| F005 | `website/terms.html` | Acceptable use; content rules (Section 5.11); AI notice; credits (never expire; what an action costs may change for future spending; all purchases are final); accounts and the shared wallet; Cartoon Me and referral terms; purchases (Google Play on Android, Polar as seller of record on the web); 13+; termination; 60 days' notice if the service is discontinued; disclaimers; contact | English governs | U: F217 |
| F006 | `website/support.html` | Support email; how to find the Support ID; sign-in help; how to report content; a short FAQ | The Support URL for the stores | D: F007 |
| F007 | `website/style.css` | Tokens from Section 20 as CSS variables for light and dark; 16 px base; max width 960 | One stylesheet for every page | U: F003 to F006, F264, F265 |
| F008 | `website/samples/manifest.json` | An array of `{id, title, style, language, aspect, seconds, poster, src, script}`, where `script` is the script the sample was made from (10 to 450 words); empty at first | The home grid reads it; samples are 20 to 30 s, labeled 'AI-generated sample', produced by the finished pipeline | U: F003, F162, F195 |

## 32. Phase 1: Foundation (batch p1a; F009 to F024)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F009 | `app/pubspec.yaml` | `name: videomilla`; `environment` pinned to Dart 3.13.1 and Flutter 3.47.1; dependencies pinned exactly at G3: `flutter_localizations`, `intl`, `http`, `crypto`, `uuid`, `path`, `path_provider`, `sqflite` (Android), `flutter_secure_storage` (Android), `image_picker`, `image` (pure Dart re-encode), `file_picker`, `share_plus`, `url_launcher`, `video_player`, `wakelock_plus`, `package_info_plus`, `archive`, `flutter_tts`, `in_app_purchase`, `web`, `phosphor_flutter`; dev: `flutter_test`, `flutter_lints`, flutter\_launcher\_icons, flutter\_native\_splash; `flutter: generate: true`. No assets or fonts yet | The single source of the toolchain version; CI reads it; p7a adds the asset and font sections | U: every file, F270, F263, F271 |
| F010 | `app/analysis_options.yaml` | `include: package:flutter_lints/flutter.yaml`; strict casts, inference and raw types; `avoid_print`; `prefer_const_constructors` | The analyze gate for every batch | U: all |
| F011 | `app/l10n.yaml` | `arb-dir: lib/l10n`, `template-arb-file: app_en.arb`, `output-localization-file: app_localizations.dart`, `nullable-getter: false` | `flutter gen-l10n` runs before every analysis | U: widgets, screens |
| F012 | `app/lib/l10n/app_en.arb` | `@@locale`; every user-facing string with ICU plurals, for example `creditsCount` as plural; seeded with error and common strings; extended in p4a to p6a | Zero hardcoded strings in widgets; missing keys in other languages fall back to English | U: all UI, F236 to F254 |
| F013 | `core/tokens/colors.dart` | `AppColors` with every Section 20.1 token plus status tokens; `static const light` and `dark` | Widgets read tokens only through the theme | U: F019, widgets, F168, F171, F177, F184 |
| F014 | `core/tokens/typography.dart` | `AppText` ramp bound to Instrument Serif, Inter, JetBrains Mono, with `fontFamilyFallback` lists of the Noto families | Gives each text role one style | U: F019, F177 |
| F015 | `core/tokens/spacing.dart` | `AppSpace { s2, s4, s8, s16, s24, s32, s48, s64 }` | The only gaps widgets may use | U: widgets |
| F016 | `core/tokens/radii.dart` | card 16, hero 20, button 12, input 12, sheet 20 | One value per role | U: widgets |
| F017 | `core/tokens/icon_sizes.dart` | nav 24, rowLeading 22, rowTrailing 16, hero 40 | Fixed sizes tie stroke weight to text weight | U: F167 |
| F018 | `core/tokens/icons.dart` | `AppIcons` semantic aliases (create, approve, retry, regenerate, report, share, download, play, settings, store, credits, wallet, link, language, delete, info, back, close, chevron, check, warning, alert, offline, animate, pan) mapped to Phosphor Bold glyphs | The only file that imports the icon package | U: F167 |
| F019 | `core/theme/app_theme.dart` | `AppTheme` (colors, text, space, radii, brightness) and `AppThemeScope` (an InheritedWidget); `buildTheme(colors, brightness)` | No ThemeData and no Material theme: widgets call `AppTheme.of(context)` | D: F013 to F016. U: F222 |
| F020 | `core/errors/app_error.dart` | `AppError(code, kind, retriable, userCaused, messageKey)` and the typed constructors (`offline`, `busy`, `moderation`, `insufficientCredits`, `invalidOutput`, `clipFailed`, `lipSyncFailed`, `renderFailed`, `storageFull`, `persistence`, `corrupt`, `badCode`, `sessionEnded`, `unsupportedBrowser`) | The one type every service throws and every provider catches | U: F021, services, providers, F023, F113 |
| F021 | `core/errors/error_taxonomy.dart` | `Treatment treatmentFor(AppError)` returning banner, sheet, screen or silent retry per Section 15 | Decides the UI treatment of every error | D: F020. U: F023, F174 |
| F022 | `utils/formatters.dart` | Duration, file size, credits (locale-aware), date | One formatting path for every number shown | U: widgets, screens |
| F023 | `utils/global_error_handler.dart` | Hooks `FlutterError.onError` and `PlatformDispatcher.onError`; sets the error widget to the full-screen fallback with retry and report | No raw grey screen | D: F020, F021. U: F221 |
| F024 | `core/config/app_constants.dart` | `const supportEmail = 'stmakarios@gmail.com'`; privacy, terms, support, child-safety and delete-account URLs under the static site's address; package ID; `apiBase`, siteBase and appBase from String.fromEnvironment (API\_BASE, SITE\_BASE, APP\_BASE`)`; the web app URL; `appName = 'VideoMilla'`; limits (word range 10 to 450, length 5 to 90, shots 15, characters 6, devices 10) | The only place these values live | U: F113, F162, F216, F217 |

```dart
// F020 app_error.dart (shape)
enum ErrorKind { offline, busy, moderation, credits, invalidOutput, clip, lipSync, render, storage, persistence, corrupt, badCode, session, browser }
@immutable
class AppError implements Exception {
  const AppError(this.kind, {required this.messageKey, this.retriable = false, this.userCaused = false, this.detail});
  final ErrorKind kind;
  final String messageKey;
  final bool retriable, userCaused;
  final String? detail;
  const AppError.busy() : this(ErrorKind.busy, messageKey: 'errorBusy', retriable: true);
  const AppError.moderation() : this(ErrorKind.moderation, messageKey: 'errorModeration', userCaused: true);
}

// F019 app_theme.dart (shape)
@immutable
class AppTheme {
  const AppTheme({required this.brightness, required this.colors, required this.text, required this.space, required this.radii});
  final Brightness brightness;
  final AppColors colors;
  final AppText text;
  final AppSpace space;
  final AppRadii radii;
  static AppTheme of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<AppThemeScope>()!.theme;
}

// F024 app_constants.dart (shape)
abstract final class AppConstants {
  static const appName = 'VideoMilla';
  static const supportEmail = 'stmakarios@gmail.com';
  static const siteBase = 'https://videomilla.pages.dev';
  static const privacyUrl = '$siteBase/privacy.html';
  static const termsUrl = '$siteBase/terms.html';
  static const supportUrl = '$siteBase/support.html';
  static const childSafetyUrl = '$siteBase/child-safety.html';
  static const deleteUrl = '$siteBase/delete-account.html';
  static const apiBase = String.fromEnvironment('API_BASE');
  static const maxDevices = 10, maxShots = 15, maxCharacters = 6, minWords = 10, maxWords = 450;
}
```

## 33. Phase 2: Models (batches m1, m2; F025 to F041, all under `core/models/`)

Every model is immutable: `final` fields, `copyWith`, `toJson`, `fromJson`, `==`, `hashCode`, and a `schemaVersion` where persisted. D for every model: F020 only.

| # | File | Fields | Used by |
| --- | --- | --- | --- |
| F025 | `project.dart` | id, title, contentLanguage, aspect, aspectLocked, styleId, captionStyle, targetLengthS, brief, scriptText, sceneIds, characterIds, narratorVoiceId, seriesId, episodeNumber, createdAt, updatedAt, schemaVersion | F047, F150, F151 |
| F026 | `script_input.dart` | kind (idea, script, image), text, importedFrom, imageRef, language, `wordCount`; parsers: `[bracket]` visual directions and `NAME: line` dialogue | F152, F205 |
| F027 | `scene.dart` | id, order, heading, shotIds | F152, F206 |
| F028 | `shot.dart` | id, sceneId, order, durationMs, visual, narration, narrationEn, `lines` (list of SpeakerLine: characterId, text, audioPath, audioMs), motion, characterIds, state, imagePath, narrationAudioPath, clipId, approved | F047, F055, F058, F059, F152, F155, F186, F199 |
| F029 | `character_profile.dart` | id, name, ageBand, build, hair, outfit, signature, expressions, voiceId, templateId, portraitPaths, referencePaths, approved | F059, F153, F187 |
| F030 | `style_preset.dart` | id, name, styleText, palette, grade (hue, saturation, contrast, tint), anchorAsset, allowsMinors, peopleAllowed | F055, F202, F207 |
| F031 | `motion_plan.dart` | n, recommended, heavierMax, selectedShotIds, zone (AnimationZone), warningKeys, credits, animatedSeconds, needsConfirmHigh, needsConfirmAll | F058, F156, F200 |
| F032 | `clip.dart` | id, shotId, key, provider, seconds, talking, state, videoPath, createdAt | F116, F156, F201 |
| F033 | `generation_job.dart` | id, kind (JobKind), shotId, key, status, attempts, createdAt | F060 |
| F034 | `credit_ledger_entry.dart` | delta, kind, ref, createdAt (a local mirror for display) | F159 |
| F035 | `credit_pack.dart` | productId, credits, channel (Channel), tier label; the price comes from the store or Polar, never hardcoded | F160, F191 |
| F036 | `wallet_state.dart` | balance, owed, everPurchased, deviceCount, supportId, loading, error | F159 |
| F037 | `render_spec.dart` | width, height, fps (25), segments, audioEvents, captions, grade, language, captionStyle, totalMs | F055, F127, F130, F132 |
| F038 | `recovery_code.dart` | `RETIRED: there is no recovery code; accounts replace it (Part IX)` | none |
| F039 | `voice_option.dart` | id, kind (device, cloud), provider, language, toneLabel, studio, creditPer9s | F157 |
| F040 | `series.dart` | id, title, language, aspect, styleId, captionStyle, narratorVoiceId, characters (with voices), locations (SeriesLocation: name, description, referencePath), summary (150 words or less), episodeIds, schemaVersion | F164, F219 |
| F041 | `app_config.dart` | flags, creditCosts, packsPlay, packsPolar, languagesEnabled, voiceRoutes, minAppVersion, caps, fairUse | F052, F149 |

```dart
// F028 shot.dart (shape)
@immutable
class SpeakerLine {
  const SpeakerLine({required this.characterId, required this.text, this.audioPath, this.audioMs});
  final String characterId, text;
  final String? audioPath;
  final int? audioMs;
}
@immutable
class Shot {
  const Shot({required this.id, required this.sceneId, required this.order, required this.durationMs,
    required this.visual, this.narration = '', this.narrationEn, this.lines = const [],
    this.motion = MotionKind.zoomIn, this.characterIds = const [], this.state = ShotState.pending,
    this.imagePath, this.narrationAudioPath, this.clipId, this.approved = false});
  // a shot carries narration OR speaker lines, never both when it is animated
  bool get isTalkingCandidate => lines.length == 1 && narration.isEmpty;
}

// F031 motion_plan.dart (shape)
@immutable
class MotionPlan {
  const MotionPlan({required this.n, required this.recommended, required this.heavierMax,
    required this.selectedShotIds, required this.zone, required this.credits, required this.animatedSeconds});
  final int n, recommended, heavierMax, credits, animatedSeconds;
  final List<String> selectedShotIds;
  final AnimationZone zone;
  int get k => selectedShotIds.length;
  bool get needsConfirmHigh => k > heavierMax;
  bool get needsConfirmAll => k == n && n >= 3;
}
```

## 34. Phase 3: Contracts and pure logic (batches c1, c2; F042 to F060)

### 34.1 Contracts (`core/services/`, batch c1)

| # | File | Contract | Implemented by | Used by |
| --- | --- | --- | --- | --- |
| F042 | `structure_service.dart` | `Future<StructureResult> structure({script, language, styleId, targetLengthS, brief, series, projectId, key})`; `needsStyleChange` is part of the result | F114 | F144, F152 |
| F043 | `image_service.dart` | `Future<Uint8List> generate(ImageRequest r)` with prompt, size, up to 4 references, key, projectId; `Future<ReferenceVerdict> checkReference(Uint8List jpeg)` | F115 | F144, F153 to F155 |
| F044 | `voice_service.dart` | `Future<VoiceFile> synthesize({text, voice, language, studio, key})` returning a file path and its duration in ms; `Future<List<VoiceOption>> voices(String language)` | F135, F126 | F144, F153, F156, F157 |
| F045 | `clip_service.dart` | `ClipGenerator`: `Future<List<ClipJob>> submit(List<ClipRequest> r, {confirmHigh, confirmAll, n, k})`, `Future<List<ClipStatus>> status(List<String> keys)`, `Future<File> download(String key)`, `Future<void> ack(String key)` | F116 | F144, F156 |
| F046 | `render_service.dart` | `RenderService.render(RenderSpec, {onProgress, resumeFrom})`; `RenderHost.keepAlive()` and `release()`; `FileService` (app dirs, save to gallery or download, share, free space, delete project); `exportFallback(project)` | F132, F137, F138 (Android); F127, F125 (web) | F144, F150, F158, F302 |
| F047 | `project_store.dart` | create, read, update, delete, list projects, series; migrations | F133, F123 | providers, F144, F147, F150, F151, F164 |
| F048 | `credits_service.dart` | `balance()`, `config()`, `exportData()` | F117 | F144, F152, F159 |
| F049 | `purchase_service.dart` | `products()`, `purchase(productId)`, `restore()`, stream of purchase states; Android only | F136 | F144, F160 |
| F050 | `web_checkout_service.dart` | `Future<Uri> createCheckout(packId)`, `Future<CheckoutResult> confirm(checkoutId)`; web only | F121 | F144, F160 |
| F051 | `report_service.dart` | `submit(kind, ref)` | F119 | F144, F163 |
| F052 | `remote_config_service.dart` | `fetch()`, cached `AppConfig` | F120 | F144, F149 |
| F053 | `identity_service.dart` | `Device ensureDevice()`, `markSignedIn(bool)`, `isSignedIn()`, `clear` | F134, F124 | F113, F144 |
| F054 | `assist_service.dart` | `ideas(Brief)`, `improveScript(...)`, `buildCharacter(sentence)`, `updateSummary(...)` | F118 | F144, F164, F165 |

### 34.2 Pure logic (`core/logic/`, batch c2)

| # | File | Contents and algorithm | Connects |
| --- | --- | --- | --- |
| F055 | `render_plan.dart` | `RenderPlan buildRenderPlan(project, shots, clips, style, voices)`. One segment per shot: a kept clip makes a clip segment whose length is the clip's real length; otherwise a still segment of the shot's duration with its motion. Audio events: narration at the segment start; a talking shot's line audio at the segment start; non-animated speaker lines in order. Caption cues from F056. Still motion at progress t in \[0,1\]: zoomIn scale 1.00 to 1.12; zoomOut 1.12 to 1.00; panLeft and panRight hold scale 1.10 and move x from +4% to -4% of the width (reversed for panRight); hold stays 1.00. Both renderers consume the result | D: F028, F030, F037, F056, F059. U: F127, F130, F132, F158 |
| F056 | `caption_splitter.dart` | `List<Caption> splitCaptions(String text, Duration total, {int maxCharsPerLine})`: split on sentence punctuation for every script (full stops, question and exclamation marks, the CJK, Arabic, Armenian and Devanagari equivalents); time each caption in proportion to its grapheme count; contiguous; the last ends exactly at `total`; two lines at most (16 characters per line for CJK, 32 otherwise); counts graphemes, never code units | U: F055 |
| F057 | `ledger_math.dart` | `previewCost(cost, balance)` returning cost, balance after, shortBy; `clipCredits(seconds) = 2 * seconds`; `talkingClipCredits(audioMs) = max(6, 2 * ceil(audioMs / 1000))`; `projectEstimate(...)`; `smallestCoveringPack(shortBy, packs)`; `regionalPriceOk(price, credits)` (price at least credits times 0.0147) | U: F058, F155, F156, F159, F192 |
| F058 | `animation_planner.dart` | `recommended(n) = max(1, round(n / 3))`; `heavierMax(n) = ceil(n / 2)` (half, rounded up); `zoneFor(n, k)`: green when k is at most the recommended count, amber when above it and at most heavierMax, red above that; `needsConfirmAll` when k equals n and n is 3 or more; `autoSelect(shots)` scores shots (first shot +3, last +1, a shot with one speaker line +2, a shot the structuring step marked as action +2) and takes the top R; `warningKeys(zone)` returns the localized-string keys of Section 5.7; `MotionPlan plan(n, selected, shots)` totals credits and seconds | D: F028, F031, F057. U: F156, F199, F200 |
| F059 | `dialogue_planner.dart` | Decides per shot: `narration`, `talking` (animated, one line of at most 8 s) or `voiceOver` (the same line played over a motion shot because the shot is not animated, the line is longer than 8 s, or lip-sync failed); assigns each character's voice; returns the audio items each shot needs before clip submission | D: F028, F029. U: F156, F055 |
| F060 | `job_queue.dart` | Persistent queue: `enqueue`, `resumePending`, `updates` stream; at most 3 picture jobs and 2 clip jobs at once; idempotency key `<projectId>:<shotId>:<kind>:<attempt>`; persists before running; resumes on launch with the same key; backoff 2 s then 8 s | D: F033. U: F155, F156 |

```dart
// F058 animation_planner.dart (shape)
int recommended(int n) => math.max(1, (n / 3).round());
int heavierMax(int n) => (n + 1) ~/ 2;   // half, rounded up
AnimationZone zoneFor(int n, int k) {
  if (k <= recommended(n)) return AnimationZone.green;
  if (k <= math.max(recommended(n), heavierMax(n))) return AnimationZone.amber;
  return AnimationZone.red;
}
List<String> autoSelect(List<Shot> shots) {
  final scored = [for (final s in shots) (s.id, _score(s, shots))]..sort((a, b) => b.$2.compareTo(a.$2));
  return [for (final e in scored.take(recommended(shots.length))) e.$1];
}

// F057 ledger_math.dart (shape)
int clipCredits(int seconds) => 2 * seconds;
int talkingClipCredits(int audioMs) => math.max(6, 2 * (audioMs / 1000).ceil());
CostPreview previewCost({required int cost, required int balance}) =>
    CostPreview(cost: cost, balance: balance, balanceAfter: balance - cost, shortBy: math.max(0, cost - balance));
```

## 35. Phase 4: Worker core, ledger and safety (batches wa, wb; F061 to F085, all under `worker/`)

### 35.1 Batch wa: core (F061 to F072 except F067, which is built last in wq because it imports every route; plus F076 from the table in 35.2)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F061 | `package.json` | Scripts `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `deploy` (`wrangler deploy`); dev dependencies `typescript`, `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, all pinned at G3; no runtime dependencies (Web Crypto only) | The Worker loop runs `npm install && npm run typecheck && npm test` | U: loop, F262, F271 |
| F062 | `tsconfig.json` | Strict mode, ES2022, Workers types, `noUncheckedIndexedAccess` |  | U: F061 |
| F063 | `wrangler.toml` | Section 23.10, including the R2 bucket `videomilla-clips`, the queue `clip-jobs` as producer and consumer, the daily cron, and `cpu_ms = 60000` | Declares every binding; `main` points to `src/index.ts`, which F067 provides in wq | U: F064, F262 |
| F064 | `vitest.config.ts` | Workers Vitest integration pointed at `wrangler.toml`; reads `migrations/` into a test binding | Tests run inside the Workers runtime with real D1 and R2 bindings; tests in wa to wp import library and route modules directly, not through `index.ts`; if the test pool refuses to start before F067 exists, G6 is run with `main` commented out and restored in wq (recorded at G6) | D: F063, F065 |
| F065 | `migrations/0001_schema.sql` | The schema of Section 23.2 plus seed rows for `config` (credit costs, packs, caps, fair use, languages enabled, models, voice routes, clip routes, flags, minimum version) | Constraints enforce the ledger rules | U: F064, F072, F280 |
| F066 | `src/env.ts` | `interface Env { AI; DB; CLIPS; CLIP_JOBS; GOOGLE_SA_JSON; GEMINI_API_KEY; SEGMIND_API_KEY; PRUNA_API_KEY; POLAR_ACCESS_TOKEN; POLAR_WEBHOOK_SECRET; PEPPER; WEB_ORIGIN }` | Typed bindings | U: all |
| F067 | `src/index.ts` | The router (below), the `queue` handler that calls `runClipJob` (F100), and the `scheduled` handler that calls `runDaily` (F106) | Every request passes CORS, authentication and the minimum-version gate in that order; built last (batch wq), because it imports every route, the queue consumer and the cron | D: F068 to F072 and every route, F100 |
| F068 | `src/lib/http.ts` | `json()`, `HttpError`, `readJson(req, maxBytes)`, `preflight()` and `withCors()` (allowed origins: the web app origin and `http://localhost:*` in dev; allowed headers `Authorization`, `Content-Type`, `X-App-Version`, `X-Idempotency-Key`), request IDs | The web app calls the Worker cross-origin, so CORS is mandatory | U: all |
| F069 | `src/lib/auth.ts` | `authenticate(req, env)` reads `Authorization: Device <id>.<secret>`, looks the device up with its wallet, compares `SHA-256(secret + PEPPER)` in constant time, rejects revoked or deleted, updates `last_seen` at most once an hour; `registerDevice()` | A wallet is resolved from the device, never from a header the client controls | D: F066. U: F067, F070 |
| F070 | `src/routes/session.ts` | `POST /session`: creates a wallet (with an 8-character Support ID) and a device, returns `{deviceId, secret, balance, configVersion}`; `GET /balance` | Rate limited by network address through F076 | D: F069, F076 |
| F071 | `src/routes/config.ts` | `GET /config`: reads D1 `config` rows, cached 60 s in memory | The apps never hardcode prices, packs, models or caps | U: F067, F120 |
| F072 | `test/apply-migrations.ts` | `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` | Runs before every test file | D: F064, F065 |

```ts
// F067 index.ts (shape)
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight(req, env);
    const path = new URL(req.url).pathname;
    try {
      if (path === '/v1/session' && req.method === 'POST') return withCors(req, env, await handleSession(req, env));
      if (path === '/v1/hooks/polar' && req.method === 'POST') return handlePolarWebhook(req, env);
      const auth = await authenticate(req, env);
      if (belowMin(req.headers.get('X-App-Version'), await cfg(env.DB, 'min_app_version'))) return json({ error: 'update_required' }, 426);
      const r = await route(req, env, auth, path);
      return withCors(req, env, r);
    } catch (e) { return withCors(req, env, errorResponse(e)); }
  },
  async queue(batch: MessageBatch<{ key: string }>, env: Env): Promise<void> { for (const m of batch.messages) await runClipJob(env, m.body.key, m); },
  async scheduled(_c: ScheduledController, env: Env): Promise<void> { await runDaily(env); },
};

// F069 auth.ts (shape)
export async function authenticate(req: Request, env: Env): Promise<Auth> {
  const [scheme, cred = ''] = (req.headers.get('Authorization') ?? '').split(' ');
  const [id = '', secret = ''] = cred.split('.');
  if (scheme !== 'Device' || id.length < 22 || secret.length < 43) throw new HttpError(401, 'unauthorized');
  const row = await env.DB.prepare('SELECT d.id AS id, d.wallet_id AS wallet_id, d.platform AS platform, d.secret_hash AS h, d.revoked AS revoked, w.deleted AS deleted FROM devices d JOIN wallets w ON w.id = d.wallet_id WHERE d.id = ?').bind(id).first<DeviceRow>();
  if (!row || row.revoked || row.deleted) throw new HttpError(401, 'unauthorized');
  if (!timingSafeEqual(await sha256Hex(secret + env.PEPPER), row.h)) throw new HttpError(401, 'unauthorized');
  return { deviceId: row.id, walletId: row.wallet_id, platform: row.platform as 'android' | 'web' };
}
```

### 35.2 Batch wb: ledger, caps, tokens, moderation, rules (F073 to F085, except F076, which is built in wa, and F082, which is built in wq)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F073 | `src/lib/ledger.ts` | `reserve`, `reserveMany` (several clip groups in one batch: all or none), `commit`, `refund`, `creditPurchase` (counts a wallet's first purchase, Section 23.11), `voidPurchase`, `linkWallet`, `classify()` mapping D1 errors to `ok`, `duplicate`, `insufficient`, `debt`, `unknown_wallet` | Each operation is one `db.batch` of the statements in Section 23.3 | U: F074, F082, F084, F091 to F094, F100, F104, F106, F110, F111, F281, F289 |
| F074 | `src/lib/idempotency.ts` | Key format check (`^[A-Za-z0-9:_-]{8,96}$` applied with simple character tests), `getRequest`, `resolveRetry` implementing the Section 23.4 protocol (`in_progress`, take-over after 120 s, redo of a committed picture without charge, `delivered`, `refunded`) | A retry never charges twice | D: F073. U: F091 to F094, F100, F109, F286 |
| F075 | `src/lib/spend_cap.ts` | `reserveSpend(db, kind, micro, capMicro)` using an atomic conditional upsert and the changed-row count; `releaseSpend`; `fallbackAllowed`; milestone rows at 50% and 80% | A cap is checked before credits are reserved | U: F091 to F094, F100, F106, F286 |
| F076 | `src/lib/rate_limit.ts` | `hit(db, key, limit, windowSec)` over `counters` | Throttles session, link, code, report, checkout | U: F070, F082, F083, F091, F103, F286 |
| F077 | `src/lib/tokens.ts` | Generates `32-byte link tokens, 6-digit codes and 8-character referral codes (alphabet A to Z and 2 to 9); normalize; hashCode = HMAC-SHA-256(valu``e, PEPPER)` | Only the hash is stored | U: F082, F091, F104, F111, F281, F286 |
| F078 | `src/lib/moderation.ts` | `moderate(env, text)` with Llama Guard 3 8B; `classifySourceLanguage(env, text, lang)` returning a JSON verdict (the text passed as quoted data); `moderateAll`; every failure is `{allowed:false}` | Fail closed | U: F091 to F096 |
| F079 | `src/lib/style_rules.ts` | `styleVerdict` (Section 23.5), `isCartoon`, `maxCharsPerShot` | Enforces the children and no-people rules | U: F081, F085, F091 |
| F080 | `src/lib/prompts.ts` | The structuring system prompt (it keeps frightening scenes at moderate intensity, Section 5.11); assist prompts; `composeImagePrompt(style, characters, shot)` (English, no text in the image, realistic styles add the no-minors rule, Realistic Scenes appends no people); `composeClipPrompt(shot)` (gentle motion, keep face and outfit) | Prompts are assembled only here | U: F091, F092, F094, F100 |
| F081 | `src/lib/schemas.ts` | Validators for the structure output and assist outputs; caps (15 shots, 6 characters, 2 per shot); enums; the rule that an animated talking shot has exactly one line of at most 8 s and no narration | Rejects anything off-schema | U: F085, F091, F094 |
| F082 | `src/routes/account.ts` | `GET /me, GET /me/export, DELETE /me, POST /auth/signout, GET /me/devices, POST /me/devices/remove` | Account management; the shared wallet itself is created at sign-in (F286, F287) | D: F073, F076, F077, F281 |
| F083 | `src/routes/report.ts` | Inserts a report row |  | D: F076 |
| F084 | `test/ledger.test.ts` | Every scenario of Section 23.3; the first-purchase counter counts once | Gate G6 | D: F073 |
| F085 | `test/schemas.test.ts` | Valid and invalid structure outputs; cap enforcement; style rules |  | D: F079, F081 |

```ts
// F073 ledger.ts (shape)
export type Outcome = 'ok' | 'duplicate' | 'insufficient' | 'debt' | 'unknown_wallet';
function classify(e: unknown): Outcome {
  const m = String(e);
  if (m.includes('UNIQUE constraint failed: requests.key')) return 'duplicate';
  if (m.includes('NOT NULL constraint failed: wallets.guard')) return 'debt';
  if (m.includes('NOT NULL constraint failed: requests.status')) return 'unknown_wallet';
  if (m.includes('CHECK constraint failed')) return 'insufficient';
  throw e;
}
export async function reserveMany(db: D1Database, items: ReserveItem[]): Promise<Outcome> {
  const now = Math.floor(Date.now() / 1000);
  const stmts = items.flatMap((p) => [
    db.prepare("INSERT INTO requests(key,wallet_id,device_id,action,status,credits,project_id,provider,est_cost_micro,updated_at) VALUES(?,?,?,?,'reserved',?,?,?,?,?)").bind(p.key, p.walletId, p.deviceId, p.action, p.cost, p.projectId ?? null, p.provider ?? null, p.estMicro ?? 0, now),
    db.prepare("UPDATE requests SET status = CASE WHEN EXISTS(SELECT 1 FROM wallets WHERE id=? AND deleted=0) THEN 'reserved' END WHERE key=?").bind(p.walletId, p.key),
    db.prepare('UPDATE wallets SET balance = balance - ?, guard = CASE WHEN owed = 0 THEN 1 END WHERE id=?').bind(p.cost, p.walletId),
    db.prepare("INSERT INTO ledger(wallet_id,delta,kind,ref) VALUES(?,?,'reserve',?)").bind(p.walletId, -p.cost, p.key),
  ]);
  try { await db.batch(stmts); return 'ok'; } catch (e) { return classify(e); }
}

// F075 spend_cap.ts (shape)
export async function reserveSpend(db: D1Database, kind: SpendKind, micro: number, capMicro: number): Promise<boolean> {
  if (micro > capMicro) return false;
  const day = new Date().toISOString().slice(0, 10);
  const r = await db.prepare('INSERT INTO spend(day,kind,micro_usd) VALUES(?,?,?) ON CONFLICT(day,kind) DO UPDATE SET micro_usd = micro_usd + excluded.micro_usd WHERE micro_usd + excluded.micro_usd <= ?').bind(day, kind, micro, capMicro).run();
  return (r.meta.changes ?? 0) === 1;
}

// F077 tokens.ts (shape)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
}
export function newLoginCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, '0');
}

// F078 moderation.ts (response shape confirmed at G5)
export async function moderate(env: Env, text: string): Promise<{ allowed: boolean }> {
  try {
    const r: any = await env.AI.run('@cf/meta/llama-guard-3-8b', { messages: [{ role: 'user', content: text }] });
    const v = typeof r.response === 'string' ? r.response : JSON.stringify(r.response);
    return { allowed: /safe/i.test(v) && !/unsafe/i.test(v) };
  } catch { return { allowed: false }; }
}
```

The `% 32` in `newReferralCode` introduces no bias because 256 is a multiple of 32. The `% 1_000_000` in `newLoginCode` has a bias below 0.03%, which does not matter for a code that dies after five attempts.

## 36. Phase 4 continued: providers, AI routes, clips, Polar, Play (batches wc, wd, wp; F086 to F112)

### 36.1 Batch wc: providers and AI routes (F086 to F098)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F086 | `src/lib/provider_router.ts` | Reads `clip_routes` and `models` from config; `pickClipProvider(env, est)` skips providers whose cap or the fallback budget is exhausted; `acceptsAudio` per route; returns `{provider, model, costPerSecondMicro}`; `pickImageModel`, `pickTextModel` with the named fallbacks | The only place provider order lives | U: F087 to F089, F091, F092, F094, F100 |
| F087 | `src/lib/provider_segmind.ts` | `segmindClip(env, input)`: `POST https://api.segmind.com/v1/p-video-2` with `x-api-key`, returns the MP4 bytes; `segmindImageEdit` for the picture fallback | Section 23.7 request shape | D: F086. U: F100, F092 |
| F088 | `src/lib/provider_pruna.ts` | `prunaClip(env, input)`: uploads the first frame to `https://api.pruna.ai/v1/files`, then `POST https://api.pruna.ai/v1/predictions` with `Model: p-video-2` and `Try-Sync: true`; `disable_safety_filter: false`; reads the returned video | Fallback 1 for clips | D: F086. U: F100 |
| F089 | `src/lib/provider_gemini.ts` | `veoClip(env, input)`: starts `predictLongRunning`, polls the operation every 10 s, downloads the video URI with the key header; `geminiText(env, prompt)` for the Flash-Lite script fallback | Fallback 2; a Veo route does not accept supplied audio | D: F086. U: F100, F091 |
| F090 | `src/lib/google_tts.ts` | `serviceAccountToken(env, scope)` (RS256 signed with Web Crypto from `GOOGLE_SA_JSON`); `synthesizeGoogle(env, {text, languageCode, voice, studio})` returning MP3 | Also used by F110 for the Play API | D: F066. U: F093, F110 |
| F091 | `src/routes/structure.ts` | Purchase gate (records the first hit per wallet, Section 23.11); free counter; moderation (Section 23.5); model by language; validation with two retries; English translation moderation for Qwen languages; style verdict; `needsStyleChange` result | `POST /structure` | D: F073 to F081, F086, F089 |
| F092 | `src/routes/image.ts` | Parses multipart or JSON; spend cap; moderation of the prompt; reserve; FLUX.2 klein 4B with up to 4 references; commit; returns base64; refund on failure | `POST /image` | D: F073 to F075, F078, F080, F086, F087 |
| F093 | `src/routes/tts.ts` | Purchase gate for studio voices; text-length cap; route by `voice_routes` (Workers AI MeloTTS or Aura-2, or Google Cloud); studio voice reserves credits | `POST /tts` | D: F073 to F075, F078, F090 |
| F094 | `src/routes/assist.ts` | `kind` is `ideas`, `script`, `character` or `summary`; shared free counter; records the purchase-gate hit (Section 23.11); moderation; schema-validated output | `POST /assist` | D: F073 to F075, F078, F080, F081, F086 |
| F095 | `src/routes/reference_check.ts` | Runs a vision model over the image (model pinned in config at G13) and a moderation pass; returns `{face: boolean, ok: boolean}`; fail closed; never stores the image | `POST /reference/check` | D: F078 |
| F096 | `test/moderation.test.ts` | The red-team set; fail-closed behavior | Gate G5 | D: F078 |
| F097 | `test/ai_routes.test.ts` | Structure and assist: purchase gate, free counter (20 concurrent calls grant exactly 3), schema failures, style verdicts, children rule; the purchase-gate counter counts once per wallet |  | D: F091, F094 |
| F098 | `test/image.test.ts` | Reserve, commit, refund, duplicate key, cap, moderation block |  | D: F092 |

```ts
// F087 provider_segmind.ts (shape)
export async function segmindClip(env: Env, i: ClipInput): Promise<Uint8Array> {
  const body: Record<string, unknown> = { prompt: i.prompt, image: i.firstFrameB64, resolution: '720p', fps: 24, draft: false, save_audio: false, prompt_upsampling: false, seed: i.seed };
  if (i.audioB64) body.audio = i.audioB64; else body.duration = i.seconds;
  const res = await fetch('https://api.segmind.com/v1/p-video-2', { method: 'POST', headers: { 'x-api-key': env.SEGMIND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new ProviderError('segmind', res.status);
  return new Uint8Array(await res.arrayBuffer());
}

// F092 image.ts, FLUX.2 klein call (multipart shape from the Workers AI model page; confirmed at G2)
const form = new FormData();
form.append('prompt', prompt);
form.append('width', String(w));
form.append('height', String(h));
refs.slice(0, 4).forEach((b, i) => form.append('input_image_' + i, b));
const fr = new Response(form);
const out: any = await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b', { multipart: { body: fr.body, contentType: fr.headers.get('content-type') } });
```

### 36.2 Batch wd: clips, Polar, cron (F099 to F109, plus F280, F289 and F292 from Section 56.1, because F104, F106 and F111 call F289)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F099 | `migrations/0002_clips.sql` | The `clips` table |  | U: F100 to F102, F280 |
| F100 | `src/routes/clip_submit.ts` | `POST /clip/submit`: validates the body, `zoneCheck`, fair use (150 animated seconds a day, 2 in flight), moderation of motion prompts, caps, `reserveMany`, writes inputs to R2 `in/<key>`, enqueues; also exports `runClipJob(env, key, msg)`, the queue consumer: loads inputs, picks a provider, calls it, writes `out/<key>`, commits, updates the clip row, deletes inputs, retries or refunds, re-queues with a delay when the wallet already has 2 in flight | The heart of animation | D: F073 to F075, F080, F086 to F089, F099. U: F067, F107 |
| F101 | `src/routes/clip_status.ts` | `GET /clip/status?keys=a,b`: state per key | The app polls every 5 s | D: F099 |
| F102 | `src/routes/clip_file.ts` | `GET /clip/file?key=`: streams `out/<key>` from R2 with Range support and `Cache-Control: no-store` | A lost connection resumes with Range | D: F099 |
| F103 | `src/routes/checkout_polar.ts` | `POST /checkout/polar`: validates the pack, rate limits, reads the signed-in account's email from the accounts table, calls `createCheckout` with it as the pre-filled customer email | Web only; sign-in is required to buy | D: F105, F076, F280 |
| F104 | `src/routes/webhook_polar.ts` | `POST /hooks/polar`: verifies the signature, then `order.paid` runs `creditPurchase` once; `order.updated` with a refund runs `voidPurchase`; unknown events return 200 | The wallet ID comes from the checkout metadata | D: F073, F077, F105, F289 |
| F105 | `src/lib/polar.ts` | `createCheckout(env, {productId, walletId, customerEmail, pack, successUrl})`; `verifySignature(env, headers, body)`; product-to-credits map from config | The only file that talks to Polar | U: F103, F104 |
| F106 | `src/lib/cron.ts` | `runDaily`: refund stale reservations; refund stale clip jobs; delete R2 objects older than 24 hours; write cap milestones; write the conversion summary (Section 23.11); write the heartbeat (and call F110's voided-purchase pass) | Capped batches; idempotent | D: F073, F075, F289 |
| F107 | `test/clips.test.ts` | Reserve, commit, refund for clips; duplicate submit; provider failure and fallback; atomic multi-clip reservation; zone check; fair use |  | D: F100 |
| F108 | `test/polar.test.ts` | Signature good and bad; `order.paid` twice; refund voids; wallet from metadata | Gate G12 | D: F104 |
| F109 | `test/protocol.test.ts` | Lost-response retry, lease take-over, cron expiry, a randomized fault run, a slow job racing the cron |  | D: F074 |

```ts
// F100 clip_submit.ts, consumer outline
export async function runClipJob(env: Env, key: string, msg: Message<{ key: string }>): Promise<void> {
  const req = await getRequest(env.DB, key);
  if (!req || req.status !== 'reserved') return msg.ack();
  if (await inFlight(env.DB, req.wallet_id) > 2) return msg.retry({ delaySeconds: 20 });
  const input = await loadInput(env, key);
  const route = await pickClipProvider(env, input);
  if (!route) { await refund(env.DB, key); return msg.ack(); }
  try {
    const mp4 = await callProvider(env, route, input);
    await env.CLIPS.put('out/' + key, mp4, { httpMetadata: { contentType: 'video/mp4' } });
    await commit(env.DB, key, route);
    await env.CLIPS.delete('in/' + key);
    msg.ack();
  } catch (e) { msg.attempts >= 3 ? (await refund(env.DB, key), msg.ack()) : msg.retry({ delaySeconds: 15 }); }
}
```

### 36.3 Batch wp: Play (F110 to F112)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F110 | `src/lib/play_verifier.ts` | Play Developer API calls using `serviceAccountToken` (F090): `products.get`, `consume`, optional `acknowledge`, voided-purchases list; `applyVoids(env)` called from the cron | The only file that talks to Google Play | D: F090, F073 |
| F111 | `src/routes/purchase_play.ts` | `POST /purchase/play`: reads `{product_id, purchase_token}`, verifies, maps the product to credits, `creditPurchase` with the SHA-256 of the token, consumes, requires a signed-in wallet and runs `grantReferral` (F289) on a qualifying first purchase | Android only | D: F073, F077, F110, F289 |
| F112 | `test/play.test.ts` | Valid, replayed and forged tokens; voided purchase; consume failure | Gate G14 (server half) | D: F111 |

## 37. Phase 5: Platform adapters (batches a1, a2, n1, n2; F113 to F146)

### 37.1 Batch a1: shared adapters (F113 to F122, `platform/shared/`)

These use `package:http` and pure Dart, so they compile for Android and the web.

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F113 | `worker_client.dart` | `WorkerClient(baseUrl, identity, version)`: `postJson`, `getJson`, `postMultipart`; adds `Authorization: Device <id>.<secret>`, `X-App-Version`, `X-Idempotency-Key`; per-route timeouts (structure 60 s, picture 90 s, voice 60 s, clip submit 30 s); two retries with backoff; maps 401 to a single silent re-registration only when this device never signed in; when it was signed in, it raises `sessionEnded` and never creates a new wallet, 402 to insufficient credits, 409 `in_progress` to a wait and retry, 422 to moderation blocked, 426 to the update screen, 429 and busy bodies to `busy`, 5xx and timeouts to `offline`; never logs bodies | The single door to the backend | D: F020, F053, F024. U: F114 to F121, F126, F135, F136, F145, F146, F300 to F302 |
| F114 | `structure_adapter.dart` | Implements StructureService (F042); builds the request; parses characters, scenes, shots, `needsStyleChange` | `POST /structure` | D: F042, F113 |
| F115 | `image_adapter.dart` | Implements ImageService (F043): multipart `generate` (prompt, size, up to 4 reference JPEGs) returning bytes; `checkReference` | `POST /image`, `POST /reference/check` | D: F043, F113 |
| F116 | `clip_generator_worker.dart` | Implements ClipGenerator (F045): `submit` sends first-frame JPEG and optional line audio as base64; `status` polls; `download` writes the MP4 to a file with HTTP Range resume; `ack` | `POST /clip/submit`, `GET /clip/status`, `GET /clip/file`, `POST /ack` | D: F032, F045, F113 |
| F117 | `credits_adapter.dart` | Implements CreditsService (F048) | `GET /balance`, `GET /config`, `GET /me/export` | D: F048, F113 |
| F118 | `assist_adapter.dart` | Implements AssistService (F054) | `POST /assist` | D: F054, F113 |
| F119 | `report_adapter.dart` | Implements ReportService (F051) | `POST /report` | D: F051, F113 |
| F120 | `remote_config_adapter.dart` | Implements RemoteConfigService (F052); caches the last good config in the store; falls back to the cache when offline | `GET /config` | D: F052, F071, F113 |
| F121 | `web_checkout_adapter.dart` | Implements WebCheckoutService (F050): `POST /checkout/polar`, opens the returned URL with `url_launcher`, on return polls the balance until the credit appears | Registered on the web only | D: F050, F103, F113 |
| F122 | `image_prep.dart` | `prepareReference(raw, maxSide: 512)`: decode, apply orientation, resize, re-encode JPEG quality 85 (EXIF is dropped by re-encoding); `thumbnail(bytes, 360)`; pure Dart with `package:image` | Used after `image_picker` has already limited the size | U: F145, F146, F153, F154 |

```dart
// F113 worker_client.dart (shape)
class WorkerClient {
  WorkerClient({required this.baseUrl, required this.identity, required this.version});
  final String baseUrl, version;
  final IdentityService identity;
  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body, {Duration timeout = const Duration(seconds: 60), String? key}) async {
    final dev = await identity.ensureDevice();
    final res = await http.post(Uri.parse(baseUrl + path), headers: {
      'Authorization': 'Device ' + dev.id + '.' + dev.secret, 'Content-Type': 'application/json',
      'X-App-Version': version, if (key != null) 'X-Idempotency-Key': key,
    }, body: jsonEncode(body)).timeout(timeout);
    return _decode(res);
  }
  Map<String, dynamic> _decode(http.Response r) {
    switch (r.statusCode) {
      case 200: return jsonDecode(r.body) as Map<String, dynamic>;
      case 402: throw const AppError(ErrorKind.credits, messageKey: 'errorCredits', userCaused: true);
      case 422: throw const AppError.moderation();
      case 429: throw const AppError.busy();
      default: throw AppError(ErrorKind.offline, messageKey: 'errorOffline', retriable: true, detail: r.statusCode.toString());
    }
  }
}
```

### 37.2 Batch a2: web adapters (F123 to F129)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F123 | `platform/web/web_store_adapter.dart` | Implements ProjectStore (F047) on IndexedDB through `package:web` and `dart:js_interop`: object stores `projects`, `shots`, `characters`, `series`, `blobs` (pictures, audio, clips), `checkpoints`; `schemaVersion` per record; requests persistent storage and reads the quota estimate; try-catch with an in-memory fallback and a warning banner flag | Web storage can be evicted, so the app asks for persistence and shows storage use | D: F047. U: F127, F146, F150 |
| F124 | `platform/web/web_identity.dart` | Implements IdentityService (F053): the device credential and the signed-in flag in IndexedDB | Browser storage is weaker than the Android keystore, so nothing secret beyond the device credential is kept | D: F053. U: F146 |
| F125 | `platform/web/web_file_service.dart` | Implements FileService: save by a Blob and an anchor download; share with `navigator.share` when `canShare` accepts files; storage estimate; delete project | No permission prompts | D: F046 |
| F126 | `platform/web/web_voice_service.dart` | Implements VoiceService (F044) with cloud voices only through `/tts`; measures duration with Web Audio `decodeAudioData`; voices come from `voice_routes` in the config | The browser's speech output cannot be captured into a video | D: F044, F113 |
| F127 | `platform/web/web_renderer.dart` | Implements RenderService (F046) and RenderHost: `probe()` checks `VideoEncoder`, `AudioEncoder`, `OffscreenCanvas` and `Worker`; starts `render_worker.js`; sends the render plan and asset blobs; receives progress; saves each finished segment to `checkpoints`; resumes from the first missing one; hands back the final Blob; keep-alive with `wakelock_plus` and a `beforeunload` guard | The web half of Section 13 | D: F037, F046, F055, F123, F128. U: F146, F158 |
| F128 | `app/web/js/render_worker.js` | A module worker: receives `{type:'init', plan, assets}` then `{type:'segment', index}`; draws each frame to an `OffscreenCanvas` (still with its motion, or decoded clip frames at the output size, then captions with `fillText`); mixes audio with `OfflineAudioContext`; encodes with WebCodecs through Mediabunny; posts `{type:'progress'}` and `{type:'done', blob}` | The pinned Mediabunny bundle is vendored by F257 | D: F257 |
| F129 | `app/web/index.html` | The Flutter web host page: `base href`, viewport with `viewport-fit=cover`, theme color, manifest link (F261), bootstrap script, a neutral loading state in the token colors, a `noscript` message | The page the Pages project serves | D: F261 |

```js
// F128 render_worker.js (shape; names confirmed at G1)
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, QUALITY_HIGH } from './mediabunny.js';
let plan, assets;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') { plan = m.plan; assets = m.assets; return; }
  if (m.type === 'segment') {
    const out = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const canvas = new OffscreenCanvas(plan.width, plan.height);
    const ctx = canvas.getContext('2d');
    const video = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH });
    out.addVideoTrack(video);
    await out.start();
    const seg = plan.segments[m.index];
    const frames = Math.round(seg.durationMs / 1000 * plan.fps);
    for (let f = 0; f < frames; f++) {
      drawSegmentFrame(ctx, seg, f / frames, assets);
      drawCaptions(ctx, plan.captions, seg.startMs + f * 1000 / plan.fps);
      await video.add(f / plan.fps, 1 / plan.fps);
      if (f % 5 === 0) self.postMessage({ type: 'progress', index: m.index, frame: f, frames });
    }
    await out.finalize();
    self.postMessage({ type: 'segmentDone', index: m.index, blob: new Blob([out.target.buffer], { type: 'video/mp4' }) });
  }
};
```

### 37.3 Batch n1: Android adapters, first half (F130 to F136)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F130 | `core/logic/native_render_spec.dart` | Pure Dart: `NativeSpec toNativeSpec(RenderPlan plan, {fontPaths, cacheDir})` returning the JSON the Kotlin renderer reads: output size and fps; groups of 3 segments (the checkpoint unit); per segment its type (`still` or `clip`), file path, start and duration, motion curve (start and end scale, start and end x offset), the caption cues local to that segment, the grade as a 4x4 color matrix; the audio items per group with silence files (WAV, generated in Dart) padding each shot's audio to its segment length; `validate()` | Audio never overlaps by design (one voice at a time), so no mixing is needed: a single audio sequence of voice files and silence matches the video timeline | D: F055, F037. U: F132, F145 |
| F131 | `platform/android/render_bridge.dart` | `MethodChannel('videomilla/render')` and `EventChannel('videomilla/render/progress')`: `startRender(specPath)`, `cancel()`, `saveToGallery(path)`, `supportedAbis()`, `freeBytes()`; typed events (`group`, `progress`, `done`, `error`, `timeout`) | The only Dart file that knows the channel names | U: F132, F137, F138, F145 |
| F132 | `platform/android/native_renderer.dart` | Implements RenderService (F046): writes the spec to cache, calls the bridge, maps events to `onProgress`, resumes from the first group whose checkpoint file is missing, returns the final MP4; on failure throws `renderFailed` and the provider offers the image and audio export | The Android half of Section 13 | D: F037, F046, F055, F130, F131 |
| F133 | `platform/android/android_store_adapter.dart` | Implements ProjectStore (F047) on SQLite (`sqflite`): tables `projects`, `shots`, `characters`, `series`, `meta` (`schema_version`); media as files under the app documents directory; migrations on open; try-catch with an in-memory fallback and a warning banner flag | Corrupt state triggers the recovery path | D: F047 |
| F134 | `platform/android/android_identity.dart` | Implements IdentityService (F053) with `flutter_secure_storage` (the Android keystore) for the device credential and the signed-in flag | Nothing else secret is stored | D: F053 |
| F135 | `platform/android/android_voice_service.dart` | Implements VoiceService (F044): lists device voices per locale with `flutter_tts`, synthesizes to a file, measures duration; when the device has no voice for the language (or the user chose a studio voice) it calls `/tts` through the shared client | Device first, cloud second; Hebrew always uses the cloud | D: F044, F113 |
| F136 | `platform/android/billing_adapter.dart` | Implements PurchaseService (F049) with `in_app_purchase`: product details for the five product IDs; `buyConsumable` with auto-consume off; on a purchase update posts `/purchase/play`; after the server confirms, completes (consumes) the purchase; re-queries unfinished purchases at launch; pending and failed states | The only Play Billing code | D: F049, F113 |

### 37.4 Batch n2: Android adapters, second half and the registry (F137 to F146)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F137 | `platform/android/foreground_service.dart` | Implements RenderHost: starts and stops the service through the bridge and handles the `timeout` event | Keeps rendering alive | D: F046, F131 |
| F138 | `platform/android/android_file_service.dart` | Implements FileService: app directories with `path_provider`; `saveToGallery` through the bridge (MediaStore, no storage permission); share with `share_plus`; free space; delete project; image and audio export for the fallback (a zip with `archive`) |  | D: F046, F131 |
| F139 | `app/android/app/src/main/kotlin/com/zdmgold/videomilla/MainActivity.kt` | Registers `RenderPlugin` on the Flutter engine |  | U: F140 |
| F140 | `.../RenderPlugin.kt` | MethodChannel and EventChannel handlers for the channel names in F131; starts and binds `RenderForegroundService`; `saveToGallery` via MediaStore; returns `Build.SUPPORTED_ABIS` and free bytes |  | D: F139, F143 |
| F141 | `.../CompositionBuilder.kt` | Reads the spec JSON and builds a Media3 `Composition` per group: a video `EditedMediaItemSequence` and an audio sequence; for a still: an image `MediaItem` with its duration, frame rate 25, effects `Presentation` (scale to fit with crop to the output size), a `MatrixTransformation` driven by presentation time, the grade, and the caption overlay; for a clip: a video item with `setRemoveAudio(true)` and the same presentation, grade and overlay; the final join builds a sequence of the group MP4s | The API names are confirmed by the first compile at G3 and G15 | D: F142 |
| F142 | `.../CaptionOverlay.kt` | Draws each caption cue to a bitmap with `StaticLayout` and `TextPaint` using the bundled Noto typefaces (the Android text stack shapes complex scripts); a `BitmapOverlay` subclass returns the bitmap for the current presentation time and null between cues | Style variants: Bold, Clean, Outline | U: F141 |
| F143 | `.../RenderForegroundService.kt` | A foreground service with type `mediaProcessing`; owns the `Transformer` on the main looper; per group: export to `grp_<i>.mp4`, report progress, write the checkpoint; then the join; `onTimeout` (Android 15 and later) stops cleanly and records the checkpoint; ongoing notification | Hosts every export | D: F141. U: F140, F268 |
| F144 | `platform/platform_registry.dart` | `abstract class PlatformServices` exposing every contract plus `createPlatformServices(deps)` through a conditional import: the default is the Android file and the `dart.library.js_interop` branch is the web file | Selects the adapter set at compile time, so no web-only import reaches the Android build and the reverse | D: F042 to F054 |
| F145 | `platform/registry_android.dart` | Builds the Android set: F133, F134, F135, F136, F132, F137, F138 and the shared adapters; `WebCheckoutService` is not constructed | Anti-steering by construction | D: F113 to F122, F130 to F138 |
| F146 | `platform/registry_web.dart` | Builds the web set: F123, F124, F125, F126, F127, F121 and the shared adapters; `PurchaseService` is not constructed |  | D: F113 to F129 |

```dart
// F130 native_render_spec.dart (shape)
class NativeSpec {
  NativeSpec({required this.width, required this.height, required this.fps, required this.groups});
  final int width, height, fps;
  final List<NativeGroup> groups;
  Map<String, dynamic> toJson() => {
    'width': width, 'height': height, 'fps': fps,
    'groups': [for (final g in groups) g.toJson()],
  };
}
class NativeSegment {
  // type is still or clip; motion is null for clips
  const NativeSegment({required this.type, required this.path, required this.durationMs, this.motion, this.captions = const []});
  final String type, path;
  final int durationMs;
  final NativeMotion? motion;     // scale0, scale1, x0, x1 as fractions of the width
  final List<NativeCaption> captions;
}

// F144 platform_registry.dart (shape)
import 'registry_android.dart' if (dart.library.js_interop) 'registry_web.dart' as impl;
PlatformServices createPlatformServices(PlatformDeps deps) => impl.build(deps);
```

```kotlin
// F141 CompositionBuilder.kt (shape; Media3 names confirmed at the first compile)
fun stillItem(s: Segment, w: Int, h: Int, fps: Int): EditedMediaItem {
    val zoom = MatrixTransformation { presentationTimeUs ->
        val t = (presentationTimeUs / 1000f / s.durationMs).coerceIn(0f, 1f)
        val scale = s.scale0 + (s.scale1 - s.scale0) * t
        Matrix().apply { postScale(scale, scale); postTranslate((s.x0 + (s.x1 - s.x0) * t) * 2f, 0f) }
    }
    val effects = Effects(
        listOf(),
        listOf(Presentation.createForWidthAndHeight(w, h, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP), zoom, gradeEffect(s.grade), OverlayEffect(listOf(CaptionOverlay(s.captions, w, h)))),
    )
    val item = MediaItem.Builder().setUri(s.path).setImageDurationMs(s.durationMs.toLong()).build()
    return EditedMediaItem.Builder(item).setFrameRate(fps).setEffects(effects).build()
}

// F143 RenderForegroundService.kt (shape)
class RenderForegroundService : Service() {
    override fun onStartCommand(i: Intent?, flags: Int, id: Int): Int {
        startForeground(NOTIF_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING)
        spec = readSpec(i!!.getStringExtra('specPath')!!)
        exportNextGroup()
        return START_NOT_STICKY
    }
    override fun onTimeout(startId: Int, fgsType: Int) { writeCheckpoint(); stopSelf() }   // Android 15 and later
}
```

String literals in the Kotlin and TypeScript snippets of this document are shown with single quotes for portability; the shipped Kotlin files use double quotes.

## 38. Phase 6: Providers (batches p3a, p3b; F147 to F166, `core/providers/` and `app_scope.dart`)

Every provider is one class holding `ValueNotifier<State>`, calling only contracts and logic; screens bind with `ListenableBuilder`.

| # | File | State and methods | Connects |
| --- | --- | --- | --- |
| F147 | `theme_provider.dart` | `ThemeMode`; `set(mode)`; persists | D: F047. U: F166, F216, F222 |
| F148 | `locale_provider.dart` | UI `Locale` (20 supported), content language; `set`; right-to-left for ar, he, ur | U: F166, F203, F216, F222 |
| F149 | `flags_provider.dart` | Flags and config from the remote config; `languagesEnabled`; kill switches | D: F052, F041. U: screens |
| F150 | `projects_provider.dart` | Project list, sort, delete, duplicate; per-project storage sizes | D: F025, F046, F047, F123. U: F166, F204, F218 |
| F151 | `current_project_provider.dart` | The open `Project`, autosave, aspect lock after the first picture | D: F047, F025 |
| F152 | `scene_provider.dart` | Script input, scenes and shots; `analyze` through StructureService; free-counter display; style-change prompt; edit, add, delete, reorder | D: F042, F048, F026 to F028. U: F166, F205, F206 |
| F153 | `character_provider.dart` | Profiles, templates, sheet state; `generateSheet`, approve, regenerate one portrait; voice assignment | D: F029, F043, F044, F122, F260. U: F166, F208, F312 |
| F154 | `reference_provider.dart` | Up to 4 reference images; runs `prepareReference` then `checkReference`; rejected images are discarded | D: F122, F043 |
| F155 | `shot_board_provider.dart` | Shots and states; `generate`, `regenerate`, `approve`, `editNarration`, `editVisual`; cost badges | D: F028, F043, F057, F060. U: F166, F209, F210 |
| F156 | `animate_provider.dart` | The `MotionPlan`, slider changes, selected shots, confirmations, dialogue plan, line-audio synthesis, clip submission, polling, keep and reject | D: F031, F032, F044, F045, F057 to F060. U: F166, F211 |
| F157 | `voice_provider.dart` | Voices per language, narrator and character voice choices, preview | D: F044, F039 |
| F158 | `render_provider.dart` | Render state and progress; `start`, `cancel`, `resume`; image and audio export fallback | D: F046, F055, F127 |
| F159 | `wallet_provider.dart` | `WalletState`; `refresh`, `preview(cost)`, debt flag | D: F034, F036, F048, F057 |
| F160 | `purchase_provider.dart` | Wraps `PurchaseService` on Android or `WebCheckoutService` on the web behind one interface; pack list; pending and failed states | D: F049, F050, F035 |
| F161 | `recovery_provider.dart` | RETIRED: replaced by auth\_provider (F305) | none |
| F162 | `samples_provider.dart` | Sample list from the website manifest, including each sample's script, language, style, aspect and length; empty on failure | D: F024, F008 |
| F163 | `report_provider.dart` | Report submission state | D: F051 |
| F164 | `series_provider.dart` | Series list, create from a project, add an episode, edit locations and summary, update the summary, compile | D: F047, F054, F040 |
| F165 | `assist_provider.dart` | Ideas, script improver, character builder; free-count display | D: F054 |
| F166 | `app_scope.dart` (in `lib/`) | `AppScope` InheritedWidget exposing all 21 providers and the services; `AppScope.create(deps)`, `of(context)`, `start()` | D: F147 to F160, F162 to F165, F305 to F307, F144. U: F221, F222, every widget and screen |

```dart
// F159 wallet_provider.dart (shape)
@immutable
class WalletView { const WalletView({required this.state, this.error}); final WalletState state; final AppError? error; }
class WalletProvider {
  WalletProvider(this._credits);
  final CreditsService _credits;
  final ValueNotifier<WalletView> view = ValueNotifier(const WalletView(state: WalletState.empty()));
  Future<void> refresh() async {
    try { view.value = WalletView(state: await _credits.balance()); }
    on AppError catch (e) { view.value = WalletView(state: view.value.state, error: e); }
  }
  CostPreview preview(int cost) => previewCost(cost: cost, balance: view.value.state.balance);
}
```

## 39. Phase 7: Widgets (batches p4a, p4b, p4c; F167 to F203, all under `widgets/`)

Built before any screen. Every widget reads tokens through `AppTheme.of(context)`, has a semantic label, honors Reduce Motion, mirrors in right-to-left, and has a 48x48 dp minimum target. English strings for each batch are appended to `app_en.arb` in that batch.

### 39.1 Batch p4a: primitives (F167 to F179)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F167 | `app_icon.dart` | `AppIcon(alias, size, color)` | Renders a Phosphor Bold glyph from the alias file; directional glyphs mirror in right-to-left | D: F017, F018 |
| F168 | `app_card.dart` | `AppCard({leading, label, value, onTap, chevron})`: secondary fill, hairline border, radius 16 | Press feedback is opacity to 0.7 over 150 ms; no ripple, no elevation; the one card | D: F013, F016, F167. U: F186, F191, screens, F198, F202, F309 |
| F169 | `app_row.dart` | Transparent tappable row with leading icon, label, trailing chevron | Tint press | D: F167. U: F216, F217 |
| F170 | `app_chip.dart` | Labeled pill | Metadata and status | D: F167. U: F175, F185, F190 |
| F171 | `primary_button.dart` | Filled accent, label, loading state, disabled at reduced opacity | Scale to 0.97 on press; never outlined | D: F013. U: F176, F200 |
| F172 | `section_header.dart` | Small uppercase letter-spaced header | Tertiary color | U: screens |
| F173 | `empty_state.dart` | Icon, title, subtitle, centered |  | U: F204, F209 |
| F174 | `error_state.dart` | Renders an `AppError` by its taxonomy treatment (banner, sheet, screen) with Retry |  | D: F021. U: all screens |
| F175 | `app_nav_bar.dart` | Large title in the chrome face; leading back or action; trailing actions as 40x40 chips; a wordmark slot used only on Home | Mirrors in right-to-left | D: F167, F170. U: every screen |
| F176 | `bottom_action_bar.dart` | A fixed bar with the primary button over a hairline border | Collapses together with its border and gap when the keyboard opens, so the layout does not jump | D: F171. U: F205, F206, F208, F209, F212, F213 |
| F177 | `app_text_field.dart` | Built on `EditableText`: filled tertiary background, radius 12, accent focus border, a multiline variant for the script with a live word count | Right-to-left aware; the platform's selection handles and toolbar are the one exception | D: F013, F014. U: F197, F205, F215, F308 |
| F178 | `app_sheet.dart` | `showAppSheet<T>(context, builder)`: scrim, 20-radius top, drag handle, 400 ms slide | Escape and a scrim tap close it on the web; focus stays inside | U: F179, F192 to F194, F196, F203, F310 to F312 |
| F179 | `app_dialog.dart` | Confirmation dialog in the sheet style | Delete project, delete server data, unlink device | D: F178 |

### 39.2 Batch p4b: controls and cards (F180 to F191)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F180 | `app_switch.dart` | Toggle with a 48 dp target | Captions on and off | U: F212, F216, F215 |
| F181 | `segmented_control.dart` | Two to four segments, filled selection | Aspect ratio, caption style, voice tier, theme | U: F197, F205, F212, F216 |
| F182 | `app_snackbar.dart` | Transient success or failure feedback above the bottom bar | Every save, delete, export and share shows explicit feedback | U: screens |
| F183 | `loading_indicator.dart` | Spinner and linear progress in token colors; static under Reduce Motion |  | U: F186, F188 |
| F184 | `app_slider.dart` | A discrete slider from 0 to n with one step per shot; a marked 'Recommended' tick; the thumb carries the value; the track color follows the zone with an icon, never color alone | Arrow keys and Page keys on the web; semantic value and increment actions | D: F013, F167. U: F211, F310 |
| F185 | `status_chip.dart` | Shot or clip state to token color plus icon plus label | Never color alone | D: F170 |
| F186 | `shot_card.dart` | A 9:16 or 16:9 thumbnail, shot number, status chip, an icon and word for Animated or Pan/Zoom, credit badge; tap opens the shot | Rebuilds through the provider's notifier | D: F028, F168, F183, F185. U: F199, F209 |
| F187 | `character_sheet_grid.dart` | Four portraits with approve and regenerate controls and the voice picker |  | D: F029. U: F208 |
| F188 | `progress_panel.dart` | Shots done over total, current step, cancel |  | D: F183. U: F209, F212 |
| F189 | `video_preview.dart` | `video_player` wrapper with play and scrub, caption preview |  | U: F195, F201, F213 |
| F190 | `balance_chip.dart` | The balance in the navigation bar; tap opens the wallet; a debt marker when `owed` is above 0 |  | D: F159, F170 |
| F191 | `pack_card.dart` | Pack credits and the price string supplied by the store or Polar |  | D: F035, F168 |

```dart
// F168 app_card.dart (shape)
class AppCard extends StatefulWidget {
  const AppCard({super.key, required this.label, this.leading, this.value, this.onTap, this.chevron = false});
  final String label;
  final AppIconAlias? leading;
  final String? value;
  final VoidCallback? onTap;
  final bool chevron;
  @override State<AppCard> createState() => _AppCardState();
}
class _AppCardState extends State<AppCard> {
  bool _down = false;
  @override Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Semantics(button: widget.onTap != null, label: widget.label,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedOpacity(opacity: _down ? 0.7 : 1.0, duration: motionDuration(context, const Duration(milliseconds: 150)),
          child: Container(constraints: const BoxConstraints(minHeight: 48),
            decoration: BoxDecoration(color: t.colors.bgSecondary, borderRadius: BorderRadius.circular(t.radii.card), border: Border.all(color: t.colors.borderSubtle, width: 0.5)),
            padding: EdgeInsetsDirectional.all(t.space.s16), child: _content(t)))));
  }
}
```

### 39.3 Batch p4c: sheets and animation widgets (F192 to F203)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F192 | `cost_confirm_sheet.dart` | `showCostConfirmSheet(context, {label, cost})`: credits to charge and balance after; when short, opens the pack sheet (Android) or the link-and-balance message (web) | Every paid action goes through it | D: F057, F159, F178, F193 |
| F193 | `pack_sheet.dart` | Lists the packs for this platform (five on Android, three on the web), highlights the smallest covering pack, starts the purchase | The web never shows Play packs and Android never shows Polar packs | D: F160, F191, F178 |
| F194 | `report_sheet.dart` | Report categories and submit | Present on every output | D: F163, F178 |
| F195 | `sample_carousel.dart` | Sample videos; 'Make one like this' opens the script screen with that sample's script, language, style, aspect and length filled in (nothing is spent) | Zero height when the manifest is empty or fails | D: F008, F162, F189. U: F204 |
| F196 | `assist_sheet.dart` | Idea brainstorm, script improver, character builder; free count and credit cost | Goes through the cost sheet when it costs credits | D: F165, F178, F192 |
| F197 | `brief_form.dart` | Optional genre, tone, setting and character notes | Blanks are inferred by the AI | D: F177, F181. U: F205 |
| F198 | `series_card.dart` | Series entry on Home: title, episode count, latest summary line |  | D: F168. U: F204, F219 |
| F199 | `animate_strip.dart` | A horizontal strip of shot cards, each toggling Animated or Pan/Zoom, with a talking icon for lines | Selection is limited only by the slider's zone rules | D: F028, F058, F186. U: F211 |
| F200 | `animate_warning_card.dart` | The zone card: green check with 'The video will look complete'; amber warning with the heavier-use text; red alert with the full implication list and the confirm button; a checkbox when all shots are chosen | The text keys come from `warningKeys(zone)` in F058; the button states the exact credits | D: F031, F058, F171. U: F211 |
| F201 | `clip_preview.dart` | Plays a clip with Keep and Reject and the credits already spent |  | D: F189, F032 |
| F202 | `style_picker_tile.dart` | Style name, palette swatches, a 'children allowed' badge, a preview from the anchor image |  | D: F030, F168. U: F207 |
| F203 | `language_sheet.dart` | The enabled content languages, with a 'beta translation' label where unreviewed |  | D: F148, F178 |

```dart
// F200 animate_warning_card.dart (shape)
class AnimateWarningCard extends StatelessWidget {
  const AnimateWarningCard({super.key, required this.plan, required this.onConfirm, required this.allChecked, required this.onAllChanged});
  final MotionPlan plan;
  final VoidCallback onConfirm;
  final bool allChecked;
  final ValueChanged<bool> onAllChanged;
  @override Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    switch (plan.zone) {
      case AnimationZone.green: return _Zone(icon: AppIconAlias.check, tone: ZoneTone.success, title: l10n.zoneGreenTitle);
      case AnimationZone.amber: return _Zone(icon: AppIconAlias.warning, tone: ZoneTone.warning, title: l10n.zoneAmberTitle, bullets: _keys(context, plan));
      case AnimationZone.red:
        return _Zone(icon: AppIconAlias.alert, tone: ZoneTone.error, title: l10n.zoneRedTitle, bullets: _keys(context, plan),
          footer: Column(children: [
            if (plan.needsConfirmAll) _AllCheck(value: allChecked, onChanged: onAllChanged),
            PrimaryButton(label: l10n.zoneRedConfirm(plan.k, plan.credits), onPressed: (!plan.needsConfirmAll || allChecked) ? onConfirm : null),
          ]));
    }
  }
}
```

## 40. Phase 8: Screens (batches p5a, p5b; F204 to F220, all under `screens/`)

Every screen has a navigation bar, primary content, secondary actions as cards or rows, and a fixed bottom bar where a primary action exists.

| # | File | Layout and behavior | Connects |
| --- | --- | --- | --- |
| F204 | `home_screen.dart` | The wordmark (only here), the sample carousel, series cards, the project list, New project; balance chip; empty state for no projects | D: F150, F162, F164, F173, F195, F198 |
| F205 | `script_screen.dart` | Script editor (type, paste, import .txt, or one-line idea, or add a picture), content language, aspect, length presets and custom, caption style, brief form, AI helpers; the live word and length estimate; 'Analyze' opens the pack or link message when the wallet has never purchased; opens pre-filled when the user came from 'Make one like this' | D: F026, F152, F154, F162, F165, F176, F177, F181, F197 |
| F206 | `scene_review_screen.dart` | Scenes and shots list; edit, add, delete, reorder; free-analysis counter; the style-change prompt for children in a non-cartoon style | D: F027, F152, F159, F176 |
| F207 | `style_screen.dart` | Eight styles with previews and the children badge | D: F030, F151, F202, F259 |
| F208 | `character_screen.dart` | Templates, profile editor, voice picker, references, the four-portrait sheet, Generate through the cost sheet | D: F153, F154, F176, F187 |
| F209 | `shot_board_screen.dart` | The grid of shot cards, the sticky summary row, the fixed Render bar; only the grid scrolls | D: F155, F173, F176, F186, F188 |
| F210 | `shot_detail_screen.dart` | One shot: picture, narration and visual edits, regenerate, report | D: F155, F194 |
| F211 | `animate_screen.dart` | The strip, the slider, the zone card, the live total, then the clip previews | D: F156, F184, F199, F200, F201 |
| F212 | `render_screen.dart` | Voice choice, caption options, progress, resume, the keep-the-tab-open notice on the web | D: F157, F158, F176, F180, F181, F188 |
| F213 | `preview_screen.dart` | Plays the MP4; save, share, report; the export-images-and-audio fallback; Next episode | D: F158, F176, F189, F194 |
| F214 | `store_screen.dart` | The packs for this platform, the balance, restore (Android) | D: F160, F191 |
| F215 | `wallet_screen.dart` | Balance, the packs for this platform, Support ID, and a row linking to the Account screen (F313) | D: F159, F177, F180, F305 |
| F216 | `settings_screen.dart` | Theme, UI language, content language, caption default, account row, wallet row, storage row, export and delete my server data, About, 'Report a translation problem' | D: F024, F147, F148, F169, F180, F181, F215 |
| F217 | `about_legal_screen.dart` | Privacy, terms, support, child-safety, delete-account and refunds links, licenses, the 'Built with Llama' notice, app version | D: F004, F005, F024, F169, F258, F320 |
| F218 | `storage_screen.dart` | Project sizes and delete | D: F150 |
| F219 | `series_screen.dart` | The bible (characters with voices, style, locations, summary), the episode list, New episode, Compile | D: F040, F164, F198 |
| F220 | `welcome_screen.dart` | Three cards: how it works, samples are examples, credits never expire; shown once | D: F162 |

```dart
// F211 animate_screen.dart (shape)
class AnimateScreen extends StatelessWidget {
  const AnimateScreen({super.key});
  @override Widget build(BuildContext context) {
    final p = AppScope.of(context).animate;
    return ListenableBuilder(listenable: p.view, builder: (context, _) {
      final v = p.view.value;
      return Scaffold2(
        navBar: AppNavBar(title: AppLocalizations.of(context).animateTitle),
        body: Column(children: [
          AnimateStrip(shots: v.shots, selected: v.plan.selectedShotIds, onToggle: p.toggle),
          AppSlider(max: v.plan.n, value: v.plan.k, recommended: v.plan.recommended, zone: v.plan.zone, onChanged: p.setCount),
          AnimateWarningCard(plan: v.plan, allChecked: v.allChecked, onAllChanged: p.setAllChecked, onConfirm: () => p.confirm(context)),
        ]),
        bottomBar: BottomActionBar(primary: PrimaryButton(label: AppLocalizations.of(context).animateGo(v.plan.credits), onPressed: v.canSubmit ? () => p.submit(context) : null)),
      );
    });
  }
}
```

## 41. Phase 9: Shell, tests, translations (batches p6a to p6d; F221 to F254)

### 41.1 Batch p6a: shell and the first four tests (F221 to F227)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F221 | `main.dart` | Installs the global error handler; creates `PlatformServices` through F144; builds `AppScope`; starts the session, config and `resumePending`; runs `AppShell` inside `runZonedGuarded` | The only place services are constructed | D: F023, F144, F166 |
| F222 | `app_shell.dart` | `WidgetsApp.router` with `AppThemeScope` (light, dark or system), the locale and the 20 supported locales, the router, and the generated localization delegates; the app's direction follows the locale | No MaterialApp and no CupertinoApp | D: F019, F147, F148, F166, F223 |
| F223 | `router.dart` | Route table (welcome, home, script, scenes, style, cast, shots, shot detail, animate, render, preview, store, wallet, settings, about, storage, series); hash routing on the web so a static host needs no rewrite rules; the force-update route; entry points for deep links | A route guard sends first-time users to the welcome screen | D: F204 to F220 |
| F224 | `test/ledger_math_test.dart` | Cost preview, smallest covering pack, talking-clip credits, price floor | Tests F057 |  |
| F225 | `test/native_render_spec_test.dart` | Group sizes of 3, audio padding to segment length, motion curves, caption windows local to each segment | Tests F130 |  |
| F226 | `test/caption_splitter_test.dart` | Sentence splitting in every script, proportional timing, contiguous cues, exact end, grapheme counting | Tests F056 |  |
| F227 | `test/animation_planner_test.dart` | Recommended count, zones for n of 1 to 15 (n = 9: amber 4 to 5, red 6 to 9; n = 15: amber 6 to 8, red 9 to 15), confirm flags, auto-select scoring | Tests F058 |  |

### 41.2 Batch p6b: the other eight tests (F228 to F235)

| # | File | Covers |
| --- | --- | --- |
| F228 | `test/models_test.dart` | Immutability, JSON round trips, equality (F025 to F041) |
| F229 | `test/schema_version_test.dart` | Migration up, downgrade refused, corrupt recovery (F133, F123 through the contract) |
| F230 | `test/error_taxonomy_test.dart` | Every error has a treatment (F021) |
| F231 | `test/job_queue_test.dart` | Transitions, resume with the same key, concurrency limits of 3 and 2 (F060) |
| F232 | `test/render_plan_test.dart` | Segment order, clip length wins over shot length, audio offsets, caption cues (F055) |
| F233 | `test/dialogue_planner_test.dart` | Talking, voice-over and narration decisions; lines over 8 s; voice assignment (F059) |
| F234 | `test/widget_smoke_test.dart` | Core components render in both themes and in right-to-left; **a source scan fails the build on raw color literals, raw font sizes, left or right insets, and Material or Cupertino imports in `widgets/` and `screens/`** |
| F235 | `test/l10n_consistency_test.dart` | Every ARB has the English key set, the same placeholders, and the plural categories its language requires; no hardcoded strings in widgets (source scan) |

### 41.3 Batches p6c and p6d: translations (F236 to F254, `app/lib/l10n/`)

Each file has the same keys as `app_en.arb`, written by machine translation with the fixed glossary (credits, shot, animate, cast, series, wallet, referral code), screen context for every string, the language's plural forms, and a back-translation cross-check against English. Nineteen files; English is F012.

| # | File | Language | Plural categories used | Notes |
| --- | --- | --- | --- | --- |
| F236 | `app_pt_BR.arb` | Portuguese (Brazil) | one, many, other | Brazilian vocabulary |
| F237 | `app_hi.arb` | Hindi | one, other | Devanagari numerals optional; shaping tested at G7 |
| F238 | `app_es.arb` | Spanish (Latin America) | one, many, other | Latin American wording |
| F239 | `app_id.arb` | Indonesian | other |  |
| F240 | `app_ar.arb` | Arabic | zero, one, two, few, many, other | Right-to-left |
| F241 | `app_tr.arb` | Turkish | one, other |  |
| F242 | `app_ru.arb` | Russian | one, few, many, other |  |
| F243 | `app_ja.arb` | Japanese | other |  |
| F244 | `app_ko.arb` | Korean | other |  |
| F245 | `app_de.arb` | German | one, other |  |
| F246 | `app_he.arb` | Hebrew | one, two, other | Right-to-left |
| F247 | `app_fr.arb` | French | one, many, other |  |
| F248 | `app_it.arb` | Italian | one, many, other |  |
| F249 | `app_vi.arb` | Vietnamese | other |  |
| F250 | `app_th.arb` | Thai | other |  |
| F251 | `app_fil.arb` | Filipino | one, other |  |
| F252 | `app_bn.arb` | Bengali | one, other |  |
| F253 | `app_ur.arb` | Urdu | one, other | Right-to-left |
| F254 | `app_zh_Hant.arb` | Chinese (Traditional) | other |  |

Settings labels any language not yet reviewed by a native speaker 'beta translation'; the 'Report a translation problem' link opens an email to `stmakarios@gmail.com`.

## 42. Phase 10: Assets, CI, store (batches p7a, p7b, n3, n4; F255 to F279)

### 42.1 Batch p7a: assets (F255 to F261)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F255 | `app/assets/icon/icon.png` | A 1024 px launcher icon you supply (a monogram on the accent color if you have no art) | Placed by one `cp` from phone storage | U: F009 icon config |
| F256 | `app/assets/splash/splash.png` | The splash mark | Same | U: F009 splash config |
| F257 | `app/tool/fetch_assets.sh` | Downloads the pinned open-license fonts (Inter, Instrument Serif, JetBrains Mono, the Noto families) from their official releases into `app/assets/fonts/`, and the pinned Mediabunny bundle into `app/web/js/mediabunny.js`; verifies SHA-256 sums recorded at G3 | One command; fonts and the bundle are never committed from a CDN at runtime | U: F014, F128 |
| F258 | `app/assets/fonts/OFL_NOTICES.md` | The licenses of the bundled fonts | Shown in About | U: F217 |
| F259 | `app/assets/styles/styles.json` | The eight presets: id, name, style text, palette, grade values, `allowsMinors`, `peopleAllowed`, anchor file name; the eight 448 px anchor PNGs from G2 are copied beside it | Read by F030 | U: F207 |
| F260 | `app/assets/templates/character_templates.json` | Six templates with default fields; the Child template is flagged cartoon-only |  | U: F153 |
| F261 | `app/web/manifest.json` | The web app manifest: name, short name, start URL, standalone display, colors, icon list |  | U: F129 |

p7a also edits `app/pubspec.yaml` to add the asset and font sections and the launcher-icon and splash configuration, and the two dev dependencies `flutter_launcher_icons` and `flutter_native_splash`.

### 42.2 Batch p7b: workflows and legal pages (F262 to F266)

| # | File | Contents | Connects |
| --- | --- | --- | --- |
| F262 | `.github/workflows/deploy_worker.yml` | `workflow_dispatch`; `cloudflare/wrangler-action` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, working directory `worker`; then `d1 migrations apply videomilla-db --remote` | D: F061, F063 |
| F263 | `.github/workflows/deploy_web.yml` | `workflow_dispatch`; Flutter setup from the pinned version; `flutter build web --release` with `--dart-define for API_BASE, SITE_BASE and APP_BASE`; `npx wrangler pages deploy build/web --project-name=videomilla-app` | D: F009, F129 |
| F264 | `website/delete-account.html` | How to delete server data: in the app (Settings), or by email from the account address or with the Support ID; what is kept (anonymized purchase records) | Required by the stores; D: F007 |
| F265 | `website/child-safety.html` | The child-safety standards: no sexual content in any style; children only in cartoon styles; moderation; reporting; the abuse contact `stmakarios@gmail.com` | D: F007 |
| F266 | `website/_headers` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` for the static site | D: F003 |

The web app's content security policy is a meta tag in F129: `script-src` self plus the WebAssembly allowance Flutter needs, `connect-src` the Worker origin, `worker-src` self and blob, `img-src` self, data and blob, `media-src` self and blob, `font-src` self.

```yaml
# F263 deploy_web.yml (shape)
on:
  workflow_dispatch:
jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { channel: stable, flutter-version-file: app/pubspec.yaml }
      - run: bash tool/fetch_assets.sh && flutter pub get && flutter gen-l10n
        working-directory: app
      - run: flutter build web --release --dart-define=API_BASE=${{ vars.API_BASE }}
        working-directory: app
      - run: npx wrangler pages deploy build/web --project-name=videomilla-app
        working-directory: app
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 42.3 Batch n3: Android build configuration (F267 to F274)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F267 | `app/android/app/build.gradle.kts` (the file name follows the template generated at G3) | `applicationId com.zdmgold.videomilla`; minimum SDK from G3; target SDK 36 (confirmed at G3 against Google Play's current requirement); signing from `key.properties`; dependencies `androidx.media3:media3-transformer`, `media3-effect`, `media3-common` pinned at G3 (the docs show 1.11.1); R8 enabled | The only place native dependencies are declared | D: F269, F272, F274 |
| F268 | `app/android/app/src/main/AndroidManifest.xml` | `INTERNET`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROCESSING`, `POST_NOTIFICATIONS` if G15 shows it is needed; the `RenderForegroundService` with `android:foregroundServiceType='mediaProcessing'` and `exported='false'`; `allowBackup='false'` with the data extraction rules | Every permission traces to a feature | D: F143, F273 |
| F269 | `app/tool/write_key_properties.sh` | Decodes the keystore secret and writes `key.properties` in CI, then deletes both after the build |  | U: F267, F270 |
| F270 | `.github/workflows/build_android.yml` | Section 12 | `workflow_dispatch` only | D: F009, F269 |
| F271 | `.github/workflows/check.yml` | `workflow_dispatch` with an input choosing: analyze and test for the app and the Worker, or also a debug APK compile | The optional mid-run compile check | D: F009, F061 |
| F272 | `app/android/app/proguard-rules.pro` | Keep rules only for classes the plugins reach by reflection |  | U: F267 |
| F273 | `app/android/app/src/main/res/xml/data_extraction_rules.xml` | Excludes secure storage and local databases from cloud backup and device transfer | The device credential never leaves the device by backup | U: F268 |
| F274 | `app/android/gradle.properties` | JVM arguments, AndroidX flags |  | U: F267 |

### 42.4 Batch n4: store documents and Android tests (F275 to F279)

| # | File | Contents | Connects |
| --- | --- | --- | --- |
| F275 | `store_submission/ASO_METADATA.md` | Per language (20): title (30 characters at most), short description (80), long description (4,000), 10 keywords from store search suggestions, five reviewed competitor listings, title variants and screenshot captions; category and content-rating answers (frightening themes at moderate intensity, fictional, no graphic gore; answered to match Section 5.11) | U: Play |
| F276 | `store_submission/DATA_BACKING.md` | Data safety answers with the evidence behind each (matches F004) | U: Play |
| F277 | `store_submission/SCREENSHOT_STRATEGY.md` | Screens to capture per language, including right-to-left, on the reference phone; every screenshot shows the real mix of a few animated shots | U: Play |
| F278 | `app/test/android_adapters_test.dart` | A fake channel for the render bridge, store migrations, voice fallback | Tests F131 to F135 |
| F279 | `app/test/billing_adapter_test.dart` | A fake purchase stream: pending, success, failure, replay, restore at launch | Tests F136 |

---

# PART VII. REGISTERS AND CHECKLISTS

## 43. Loophole register (each gap closed, and where)

| Area | Gap closed | Where |
| --- | --- | --- |
| Money | Double charge on retry (idempotency keys and the request protocol); overspend (atomic batch debit, atomic all-or-none clip reservation); stuck reservations (cron refund); refunds and chargebacks (void batch, debt rule); replayed purchase references; credits never expire but action costs live in config and change only for future spending; provider price drift (cost recorded per job, fallback budget, weekly reconciliation); model retirement (pinned IDs with named fallbacks) | 6, 7, 16, 23 |
| Identity | Account takeover (single-use hashed tokens, five attempts per code, limits per address and per network, no account enumeration); lost phone (sign in again, credits live in the account); a signed-in device removed elsewhere (it is sent to sign-in, never to a silent new wallet); two people sharing one email share the wallet; email deliverability (domain authentication and a counter-driven Brevo to Cloudflare chain) | 5.10, 23 |
| AI safety | Prompt injection (schema, caps, quoted-data classifier); real people and licensed characters (blocked in prompts and rules); minors (cartoon styles only, sexual content blocked everywhere); faces in uploads (server check, fail closed); no-people style (validator plus prompt suffix plus G11); provider-side safety filter kept on for Pruna; reporting on every output; fail-closed moderation | 5.11, 18, 23.5 |
| Cost abuse | No free generation; samples are the trial; purchase gate on analysis; per-wallet fair use; global daily caps per provider kind; fallback budget; D1 has no billing cap so every cron batch is capped | 7, 19, 23 |
| Device and browser | Render killed in the background (foreground service on Android; checkpoints on both); low-end phone (one clip at a time, thumbnails at 360 px); storage (free-space check, storage screen); missing fonts (bundled fonts, G1 and G15 look at pixels, not exit codes); missing device voice (cloud fallback); browser without WebCodecs (message and image-and-audio export); web storage eviction (persistence request, warning banner) | 13, 14, 15 |
| Delivery | A lost phone connection costs no second provider call (clips go through R2 for 24 hours); a clip charged but never delivered (re-download free for 24 hours, then the support runbook) | 19, 23.7 |
| Languages | Machine translation labeled beta until reviewed; right-to-left; per-language model, voice and font routing; weaker moderation outside Llama's eight languages (source-language classifier) | 6, 22 |
| Store and legal | Data safety matches real flows; in-app reporting; deletion page; anti-steering enforced by never registering the web checkout on Android; app name and contact in the privacy policy; Polar acceptable use; closed-test requirement planned | 4, 18 |
| Build process | Strict batch order; English strings only until the screens are final; binary assets by command; first Kotlin and JavaScript compile at the final gate, with an optional `check.yml`; no `push:` trigger anywhere except the Cloudflare Git integration for the static site | 25 to 29 |
| Operations | Daily cron with heartbeat; cap milestones; no body logging; weekly cost reconciliation; purchase-gate conversion counters (Section 23.11); support runbook (verify a Play order or a Polar order, adjust a ledger, raise fair use for a Support ID, block an install by adding a large debt) | 19, 23 |

Residual risks, stated plainly: login email depends on the sender domain staying authenticated; real-person detection is imperfect; moderation is weaker outside eight languages; Pruna's quality for lip-sync and face drift is measured at G8 and G10, not assumed; the browser renderer depends on WebCodecs support; Polar's support responsiveness has drawn complaints.

## 44. Feature coverage matrix (every feature has files, tests and a gate)

| Feature | Files | Tests | Gates |
| --- | --- | --- | --- |
| Script, idea and image input | F205, F026, F152, F154, F122, F095 | F227, F228, T-SCR | G13 |
| AI helpers | F196, F165, F054, F094 | F097 | G5 |
| Scene and shot editor | F206, F152, F027, F028 | F228, F231 |  |
| Eight styles | F207, F202, F030, F259 | F234 | G2, G11 |
| Cast, profiles, voices | F208, F153, F187, F157, F029 | F233 | G10 |
| Pictures | F209, F155, F043, F092, F115 | F098, F231 | G2 |
| Animation plan, slider, warnings | F058, F031, F184, F199, F200, F211, F156 | F227 | G8 |
| Clips through the queue | F100 to F102, F116, F086 to F089 | F107 | G8 |
| Talking shots | F059, F156, F087 | F233 | G10 |
| Android render | F130 to F132, F139 to F143 | F225, F278 | G15 |
| Web render | F127, F128, F055 | F232 | G1 |
| Captions | F056, F142, F128 | F226 | G1, G7, G15 |
| Series | F164, F219, F040, F094 | F097 | G9 |
| Wallet and ledger | F073 to F075, F159 | F084, F224 | G6 |
| Play purchases | F136, F110, F111 | F279, F112 | G14 |
| Polar purchases | F103 to F105, F121 | F108 | G12 |
| Accounts and sign-in | F280 to F287, F305, F311 to F314, F082, F077 | F084 | G6, G12 |
| Safety | F078 to F081, F194 | F096, F085 | G5, G11, G13 |
| 20 languages | F236 to F254, F203, F148 | F235 | G7 |
| Settings, legal, support | F216, F217, F004 to F006, F264, F265 |  | G4 |
| Samples | F008, F162, F195 |  |  |
| Caps, fair use, fallback | F075, F100, F106, F086 | F107, F109 | G8 |
| Static site and CI | F003 to F008, F262, F263, F270, F271 |  | G4 |

## 45. Open items, each settled by a gate

None of these is assumed. Each is settled by running something.

| Open item | Gate |
| --- | --- |
| Browser render speed, caption shaping per script, encoder availability on the Redmi A5 | G1 |
| Character and style consistency, color after grading, no person in Realistic Scenes | G2, G11 |
| Exact Flutter, plugin, Media3 and Mediabunny versions; Media3 API names (image items, matrix transformation, overlay effect); licenses of the models and P Video 2 | G3 |
| Pages and Worker deploy commands; queue and R2 bindings | G4 |
| Worker tests before the router exists (batches wa to wp) | G6 |
| Moderation response shape; red-team results in every language; provider-side filter behavior | G5 |
| D1 error strings, `RETURNING`, changed-row counts, wallet link merge | G6 |
| Model IDs for Qwen3, MeloTTS, Aura-2 and the vision model; Hebrew and Traditional Chinese voices; per-language quality | G7, G13 |
| Segmind, Pruna direct and Veo behavior: audio-conditioned lip-sync, latency, billing, Pruna asynchronous shape, Veo Lite model ID and first-frame request shape | G8, G10 |
| Polar webhook signature scheme and metadata flow | G12 |
| Play acknowledge-after-consume behavior | G14 |
| Android ABI of the Redmi A5; foreground service on Android 15 Go; manifest merge names | G15 |
| Series continuity | G9 |

**Defaults chosen for open decisions:** no music; 13+ audience; legal pages in English; samples made by you after the pipeline works (the website and Home collapse the sample area until then).

## 46. Final checklist before code generation

- [ ] Section 3 table filled; package ID and Pages names recorded
- [ ] Google Play payments-profile country confirmed against Google's list for in-app sales; Play account creation date recorded
- [ ] Polar dry run done (products created, payout onboarding finished); domain registered and on Cloudflare; Brevo domain authenticated; G16 passed before purchases are enabled
- [ ] Static site only for marketing; web app is a separate Pages project; `app/`, `worker/`, `website/` never share code
- [ ] `core/` and `platform/` layering present in the real tree; `WebCheckoutService` never registered on Android
- [ ] Every workflow is `workflow_dispatch`; no `push:` anywhere
- [ ] Every permission traces to a feature; foreground service declared
- [ ] Gates G1, G2, G3, G5, G8, G13, G15 passed in Batch 0
- [ ] Children only in cartoon styles; sexual content blocked in every style; no-people style enforced
- [ ] Credit costs, packs, caps and fair use in D1 config exactly as Sections 7 and 23
- [ ] 20 ARB files generated; `app_en.arb` complete before translation
- [ ] Design tokens frozen before any widget; test F234 guards raw values and framework widgets
- [ ] Termux loop confirmed: repo URL supplied, batch plan approved, four-group loop understood
- [ ] Final gate sequence understood: Worker first, then web and Android together; Cartoon Me stays off until the Play approval
- [ ] No TODO, FIXME or throw UnimplementedError anywhere in generated output

## 47. Consistency report

These checks hold for this document as written.

| Check | Result |
| --- | --- |
| Files per batch sum to the total | 2+6+16+9+10+13+10+12+11+13+14+3+12+13+8+8+10+10+12+14+14+14+9+10+7+11+10+9+9+6+8+5 = 318 |
| Batches | 32; sizes follow dependency order with no fixed cap (largest: p1a, 16) |
| Phases | 11 (0 to 10) |
| Gates | 16, each mapped to a batch or the final gate |
| Commands | 18 + 250 + 318 + 6 + 1 + 9 + 1 = 603 |
| Credit examples | 17, 34, 47, 60, 73, 107 credits reconcile with 4 per character, 1 per picture, 10 per 5 s clip |
| Cross references | Every F number named as a dependency exists; no row names a retired file; every depends-on link has a matching used-by link and the reverse (checked by script); every contract has an implementation on each platform where it is registered |
| Superseded earlier statements | The FFmpeg plan is replaced by Media3 and Mediabunny; the free starter is removed; the hard animation cap is replaced by graded zones; the transfer-style recovery is replaced by accounts and sign-in; AI music is replaced by a hosted CC0 sound library; the 14-day user refund proposal is replaced by final sales |

---

# PART VIII. TEST PLAN

## 48. How to use this plan

Run the whole plan once the final batch is pushed and both builds exist, before the Play closed test and before Polar goes live. Re-run the areas a release touches. **A** marks a case covered by an automated test file, **M** a manual case, **G** a gate (Section 26).

**Severity.** S1: loses or corrupts credits, projects, locks a person out of their account, crashes at launch, exposes a secret, or shows a minor in a forbidden style. S2: a feature is broken with no workaround. S3: cosmetic or edge. S4: suggestion. **Exit criteria:** zero open S1 or S2; no more than 10 open S3, each with an owner; the ledger scenarios pass on real D1 (G6); gates G1 to G16 pass; the closed test finishes with no S1.

**Environments.** E1 Redmi A5 (Android 15 Go, 4 GB, memory extension off): the Android app and Chrome. E2 a mid-range Android phone. E3 Android 10. E4 Android 14. E5 desktop Chrome at 1440 px. E6 desktop Firefox. E7 an iPhone's Safari (iOS 26 or later should render; an older iPhone should show the unsupported-export message). E8 a tablet or foldable. Run language checks in English, Portuguese (Brazil), Arabic, Hebrew, Hindi, Japanese, Korean, Thai, Russian, Vietnamese, Turkish, Indonesian, Urdu, Bengali and Chinese (Traditional), in light and dark themes, at system font scales 100%, 200% and the maximum.

**States and data.** A Play license tester; a Polar test-mode account; a wallet with no purchase; a wallet with credits; a wallet with debt; a second device; scripts of 9, 10, 450 and 451 words; scripts with brackets, dialogue lines, emoji and mixed right-to-left text in each language; the red-team sets (harmful, sexual, minors, real person, celebrity, licensed character, injection) in English and each language; reference images (drawing, JPEG, PNG, a 40-megapixel photo, one with GPS metadata, a 64 px image, a face photo, a non-image renamed .jpg); network profiles (offline, slow, 5% packet loss, DNS failure); storage states (full, under 200 MB free); a staging flag that forces each provider to fail.

## 49. Test cases

### 49.1 Install and launch (T-INS)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-INS-01 M | Fresh install online on E1; first load of the web app | Android interactive in under 2 s, web first content under 3 s; a device and wallet registered; balance 0; no permission prompt |
| T-INS-02 M | First launch offline | Home loads; samples collapse to zero height; offline banner; Analyze explains it needs a connection |
| T-INS-03 M | Kill during first registration, three times | One usable device; orphan wallets are harmless |
| T-INS-04 M | Clear app data or browser storage | New device and wallet; the account's balance returns after signing in |
| T-INS-05 A+M | Update from a previous schema with projects, series and clips | Migration on open; nothing lost |
| T-INS-06 A+M | Truncate the local database | Recovery path; no crash |
| T-INS-07 M | Set `min_app_version` above the installed version | Force-update screen on Android; reload prompt on the web |
| T-INS-08 M | Theme and language follow the system; change both; restart | Choices persist; Reduce Motion gives instant transitions |
| T-INS-09 M | Under 100 MB free | No crash; a warning only when a storage-heavy step starts |
| T-INS-10 M | Process death or a discarded tab, then reopen | Returns to the last screen with state intact |
| T-INS-11 M | E7 Safari | App loads; creating and previewing work; on iOS 26 or later the MP4 renders; on older iOS the MP4 export explains it needs a newer browser and image-and-audio export works |
| T-INS-12 M | Private browsing on the web | Storage warning banner and in-memory mode; no crash |

### 49.2 Script input (T-SCR)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-SCR-01 A+M | 9 words, then 10 | Analyze disabled at 9 with a message; enabled at 10 |
| T-SCR-02 A+M | 450 words, then 451 | 450 accepted; 451 blocked; a live length estimate; a warning above 90 s |
| T-SCR-03 M | Paste 10,000 words | Refused or truncated with a message; no freeze |
| T-SCR-04 M | Import .txt: UTF-8, UTF-16 with a BOM, empty, a 5 MB binary renamed .txt, a non-text file | Valid ones load; others give a clear error |
| T-SCR-05 A+M | `[brackets]`; an unmatched `[`; nested brackets; only brackets; `NAME:` lines; a colon inside narration; an unknown speaker | Brackets become visual directions and are not narrated; malformed input handled; unknown speaker treated as narration with a note |
| T-SCR-06 M | Emoji, combining marks, a 5,000-character word, mixed right-to-left and left-to-right | No crash; counts correct; captions render |
| T-SCR-07 M | Idea mode with 4 words, then 5 | Blocked at 4; at 5 the AI drafts a script for review before anything else is spent |
| T-SCR-08 A+M | Length 4, 5, 90, 91, letters, empty; presets | 5 to 90 accepted; others rejected with a message |
| T-SCR-09 M | Kill mid-typing | Draft restored |
| T-SCR-10 M | Brief fields filled and blank | Blanks inferred and shown on the scene review screen |
| T-SCR-11 M | Image mode: a drawing; a photo with a face; a non-image renamed; a 40-megapixel photo; GPS metadata; a fifth reference | Drawing accepted; face refused and discarded; non-image error; resized to 512 px or less with metadata removed; fifth refused |
| T-SCR-12 M | Content language different from the UI language | The content language governs the script and voices |
| T-SCR-13 M | Tap 'Make one like this' on a sample | The script screen opens with that sample's script, language, style, aspect and length filled in and editable; no credits are spent; a sample without a script hides the button |

### 49.3 Analyze, helpers, styles and children (T-ANL, T-AST, T-STY)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-ANL-01 M | Analyze with no purchase on the wallet | The pack sheet (Android) or the buy-and-link message (web); nothing is sent or charged |
| T-ANL-02 A+M | After a purchase, analyze 4 times in a project | First 3 free; the fourth costs 1 credit through the cost sheet |
| T-ANL-03 A | 20 concurrent analyses on one project | Exactly 3 free (atomic counter) |
| T-ANL-04 M | Balance 0 on the fourth | Pack sheet or message |
| T-ANL-05 A | Model returns invalid JSON | Two retries, then 'edit the script'; no charge |
| T-ANL-06 A | 20 shots, or 3 characters in one shot | Trimmed or rejected by the validator |
| T-ANL-07 A+M | 30 s target | Shots of 3 to 10 s totaling within 10%; never above 90 s |
| T-ANL-08 G | Red-team set in English | All blocked or sanitized; no charge |
| T-ANL-09 G | 'Ignore previous instructions' inside a script | Treated as data; output stays schema-valid |
| T-ANL-10 G | Harmful scripts in each Qwen-routed language | Blocked by the source-language classifier or the English narration check |
| T-ANL-11 G | Five scripts in each of the 20 languages | Valid schema within two tries |
| T-ANL-12 M | Workers AI 429 or 5xx | 'Busy', fallback model, no charge |
| T-ANL-13 A | Moderation outage | Fails closed; no charge |
| T-ANL-14 A | An animated talking shot with narration and a line, or two lines | Validator rejects: exactly one line and no narration |
| T-ANL-15 A+M | Realistic Scenes with characters in the script | Validator rejects shots that list characters; the app asks to remove them |
| T-ANL-16 G | A ghost story with a moderate scary scene; a script with graphic gore | The ghost story is analyzed normally; the gore script is blocked or sanitized with no charge |
| T-AST-01 M | A helper before any purchase | Pack sheet or message |
| T-AST-02 A | Mix analyses and helper calls | One shared counter: 3 free, then 1 credit each |
| T-AST-03 A | Idea brainstorm | Exactly 5 ideas with a title and one line |
| T-AST-04 M | Script improver: expand, fit length, change tone, simplify | Respects target length and language |
| T-AST-05 M | Character builder from one sentence | A full valid profile |
| T-AST-06 G | Harmful helper input | Blocked, no charge |
| T-AST-07 M | Helper timeout | Refund; the free counter is not consumed |
| T-STY-01 M | A script with a child in Photoreal Story, Cinematic, Ink Noir | The app offers 'switch to a cartoon style' (default) or 'keep the style, children not shown'; both work |
| T-STY-02 M | A teen character in a non-cartoon style | Same offer (under 18 counts as a minor) |
| T-STY-03 G | Sexual or romantic content with any minor-appearing character in each of the 8 styles | Blocked in every style |
| T-STY-04 M | Child template in a non-cartoon style | Not offered |
| T-STY-05 A | `styleVerdict` for every style and age band | Matches Section 23.5 |
| T-STY-06 G | 100 Realistic Scenes prompts including adversarial ones | No person in any picture (G11) |
| T-STY-07 M | Change the style after pictures exist | Offers a project copy; costs shown |

### 49.4 Cast, pictures and voices (T-CHR, T-SHT, T-VOI)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-CHR-01 M | Each of 6 templates; edit every field; free text | Saved; skin-tone and hair pickers always explicit |
| T-CHR-02 A+M | References: JPEG, PNG, 40 MP, 64 px, non-image, fifth | Resized to 512 px or less; fifth refused; non-image error |
| T-CHR-03 G | A face photo, a celebrity photo as references | Rejected (G13); an outage of the check fails closed |
| T-CHR-04 M | Sheet for 1 character, then 2 | 4 credits, then 8 |
| T-CHR-05 M | Insufficient credits | Pack sheet or message; nothing reserved |
| T-CHR-06 M | Regenerate one portrait | 1 credit |
| T-CHR-07 M | Keyframes before the sheet is approved | Blocked with a message |
| T-CHR-08 M | 3 portraits succeed, 1 fails | 1 credit refunded; the failed one retried alone |
| T-CHR-09 M | Kill mid-sheet and reopen | Resumes with the same keys; no double charge |
| T-CHR-10 G | Celebrity or licensed-character names in character text | Blocked |
| T-CHR-11 M | Assign a voice to each character and the narrator | Each voice persists across shots |
| T-CHR-12 M | Swap a template after approval | Resets that character's approval and sheet (D-5) |
| T-SHT-01 M | 12 keyframes with 1 character | Cost sheet shows 12; total with the sheet 16 |
| T-SHT-02 M | Regenerate one picture | 1 credit; old picture replaced only on success |
| T-SHT-03 A+M | A generation fails | Refunded; failed-retriable; Retry works |
| T-SHT-04 G | Moderation blocks a prompt | No charge; clear message |
| T-SHT-05 A | Start 12 at once | At most 3 run at a time |
| T-SHT-06 M | Kill mid-generation | Resumes with the same key; no double charge or lost picture |
| T-SHT-07 M | Airplane mode mid-job, then restore | Retries and completes or refunds |
| T-SHT-08 M | Edit narration after the picture exists | No regeneration; audio re-made free |
| T-SHT-09 M | Edit the visual prompt | Offers regeneration at 1 credit |
| T-SHT-10 M | Approve, unapprove, approve all | States and the summary row update |
| T-SHT-11 M | Report a picture | Report stored; confirmation |
| T-SHT-12 M | 15 shots on E1 | Smooth; only the grid scrolls; the Render bar stays fixed |
| T-SHT-13 M | Status chips | Each state has an icon and a label |
| T-SHT-14 M | Reorder, delete and add a shot | Follows D-6 |
| T-SHT-15 M | Web at 1440 px | Four columns, summary pinned, Tab and Enter work |
| T-VOI-01 M | Standard voice in each language on Android | A device or cloud voice works; never a silent video; Hebrew uses the cloud |
| T-VOI-02 M | Standard voice in each language on the web | Cloud voice works |
| T-VOI-03 M | Remove the device voice for a language | Falls back to the cloud |
| T-VOI-04 A+M | Studio voice on 15 s, 30 s, 90 s | 2, 4, 10 credits; cost sheet first |
| T-VOI-05 M | Preview a voice | Plays free |
| T-VOI-06 G | Captions in every script | Visible and correctly shaped in a rendered frame |
| T-VOI-07 A | Caption splitting: long sentences, no punctuation, a 40-character word, languages without spaces | Contiguous cues; no line over the limit; the last ends at the audio end |
| T-VOI-08 M | Fonts missing (simulated) | The app detects blank captions and errors instead of exporting |
| T-VOI-09 M | Captions off | No captions in the video |
| T-VOI-10 M | Narration longer than the planned shot | The shot extends within the cap or warns |
| T-VOI-11 M | Right-to-left captions with numbers and Latin names | Correct visual order |
| T-VOI-12 M | Per-character voices across shots and episodes | The same voice for the same character |

### 49.5 Animation and clips (T-ANI)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-ANI-01 A | Zones for n of 1 to 15 and every k | Matches Section 5.7 |
| T-ANI-02 M | Open Animate | The AI's pick is selected and labeled Recommended; swapping a shot works |
| T-ANI-03 M | Slider into amber | Warning card; no confirmation needed |
| T-ANI-04 A+M | Slider into red | Confirm button states exact credits; the server rejects without `confirm_high` |
| T-ANI-05 A+M | Choose all shots (3 or more) | A checkbox is required; the server rejects without `confirm_all` |
| T-ANI-06 M | Zero animated shots | A motion-only video; no clip charge |
| T-ANI-07 G | First frame equals the keyframe; face and outfit stable | At least 80% recognizable without regeneration (G8) |
| T-ANI-08 A | Insufficient credits for one of several clips | None reserved (all or none) |
| T-ANI-09 A+M | Provider failure or timeout | That clip refunded alone; others continue |
| T-ANI-10 A | Primary down, then Pruna direct down | Veo Lite used until the $3 fallback budget; then busy with no charge |
| T-ANI-11 M | Kill mid-clip; interrupt a download | Resumes; Range download continues; no second provider call |
| T-ANI-12 M | A clip older than 24 hours | Explained; support runbook (D-8) |
| T-ANI-13 M | Reject a clip, then regenerate | Charged again; kept clips join the render |
| T-ANI-14 A | 150 animated seconds a day, 2 in flight | Limit message; credits safe; the third clip waits |
| T-ANI-15 A+M | A talking shot | Clip seconds follow the audio; credits are the larger of 6 and 2 times the rounded-up seconds |
| T-ANI-16 M | Lip-sync failure | Voice-over on a motion shot; refund |
| T-ANI-17 A | Global video cap reached | Busy before any reservation |
| T-ANI-18 M | Animate more shots after a finished video | Unchanged shots reused; re-render free |
| T-ANI-19 G | Talking shots across 10 dialogue scenes | Lip-sync acceptable in at least 80% (G10) |
| T-ANI-20 A | A provider returns a wrong-size or corrupt file | Rejected and refunded |

### 49.6 Rendering, preview, export (T-RND, T-WRD, T-PRV)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-RND-01 G | Media3 render of the 6 s sample on E1 | Captions correct in every script; at most 6 times real time (G15) |
| T-RND-02 M | 90 s video on E1 | Completes; plays in the gallery and other apps |
| T-RND-03 M | Press Home during a render on E4 and the reference phone | Foreground notification; render continues |
| T-RND-04 M | Swipe the app away mid-render | Resumes at the first missing group on reopen |
| T-RND-05 M | Screen off, an incoming call, battery saver | Survives or pauses cleanly and resumes |
| T-RND-06 M | Fill storage mid-render | The pre-render check blocks; a mid-render failure cleans intermediates and opens the storage screen |
| T-RND-07 M | Cancel mid-render | Intermediates deleted; shots and credits untouched |
| T-RND-08 M | 15 shots at 1280x720 on E1 | One clip at a time; no out-of-memory |
| T-RND-09 M | A device without a usable hardware encoder | 'This device cannot render videos'; image-and-audio export (D-7) |
| T-RND-10 M | 9:16 and 16:9 outputs | Correct dimensions; captions inside safe areas |
| T-RND-11 M | Stills mixed with animated clips | Same size, frame rate and codec; audio sync within about 100 ms |
| T-RND-12 M | Re-render after editing one shot | Unchanged groups reused; no credit charge |
| T-RND-13 M | Foreground service timeout on Android 15 and later | Stops cleanly; resumes on reopen |
| T-RND-14 M | Thermal throttling during a long render | Slower but completes, or pauses with a message |
| T-RND-15 G | Read `Build.SUPPORTED_ABIS` on the Redmi A5 | Recorded; the render works on that ABI |
| T-WRD-01 G | Chrome on E1: the 6 s sample | Shaped captions in every script; at most 8 times real time (G1) |
| T-WRD-02 M | 90 s video on desktop Chrome | Completes |
| T-WRD-03 M | The tab goes to the background mid-render | Continues or checkpoints; the page warns before leaving |
| T-WRD-04 M | Reload mid-render | Resumes from the last checkpoint |
| T-WRD-05 M | IndexedDB quota exceeded | Warning with an 'export now' option |
| T-WRD-06 M | Firefox 130 or later | Renders, or shows the unsupported message |
| T-WRD-07 M | `VideoEncoder` absent | Message and image-and-audio export |
| T-WRD-08 M | Clips decoded at output size on E1 | No slow-path jank |
| T-WRD-09 M | A 15-shot project on E1 Chrome | The tab does not crash |
| T-WRD-10 M | Save and share on the web | Web Share with files when supported, otherwise a download |
| T-WRD-11 M | Wake lock | Held during render, released after |
| T-PRV-01 M | Play, pause, scrub | Smooth; audio in sync |
| T-PRV-02 M | Save to the gallery or download; share through three paths | The file arrives intact with audio and captions |
| T-PRV-03 M | Export with storage nearly full | Clear error; nothing partial left |
| T-PRV-04 M | Image-and-audio export after a simulated failure | Approved images and audio exported |
| T-PRV-05 M | Report a finished video | Report stored; confirmation |
| T-PRV-06 M | Delete a project and a series | Files removed; storage screen updates |

### 49.7 Purchases and wallet (T-STO, T-WEB, T-WAL)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-STO-01 G | License-tester purchase of each of the five packs | 25, 90, 160, 350, 750 credits, once; localized price strings (G14) |
| T-STO-02 M | Cancel at the payment sheet | No credits; no error loop |
| T-STO-03 M | A slow payment method (pending) | 'Pending' chip; credits only on completion |
| T-STO-04 M | Kill after payment but before verification | The next launch re-queries, verifies and credits once |
| T-STO-05 M | Buy while offline | Clear message; no half-state |
| T-STO-06 A+G | The same token 60 times at once | Credited once |
| T-STO-07 A+M | Refund a purchase through Google | The cron voids it; balance falls or debt appears; spending blocked while owed is above 0; the next purchase pays debt first |
| T-STO-08 M | Two packs in quick succession | Both credited once each |
| T-STO-09 M | No Play services | 'Purchases unavailable'; the rest of the app works |
| T-STO-10 M | Regional prices | Every local price above credits times $0.0147 |
| T-STO-11 G | Consume and acknowledge | Buyable again; no refund after 3 days |
| T-STO-12 M | First purchase | The purchase credits the signed-in wallet; there is no recovery code |
| T-STO-13 M | Scan every Android string and screen | No web-purchase link, wording or checkout code path |
| T-WEB-01 G | Polar test mode: each of the three packs | `order.paid` credits once (G12) |
| T-WEB-02 A | The webhook replayed 10 times | Credited once |
| T-WEB-03 A | Missing or bad signature | Rejected |
| T-WEB-04 M | Cancel at checkout | No credits; return handled |
| T-WEB-05 M | Return before the webhook arrives | 'Processing' then credits; no duplicate |
| T-WEB-06 A | A Polar refund | Voided; debt rule |
| T-WEB-07 M | Buy on the web, sign in on the Android app with the same email, spend there | One shared balance |
| T-WEB-08 M | Web checkout while signed out | The sign-in sheet opens first; after sign-in the purchase proceeds |
| T-WEB-09 M | Inspect Worker data and the Polar metadata | Only the account email and the wallet ID are sent to Polar; the Worker keeps the email only in the accounts table |
| T-WEB-10 M | Polar outage or slow response | Message; no half-state |
| T-WEB-11 M | Web pack list | Only $4.99, $9.99, $19.99; never Play packs |
| T-WEB-12 M | Request a Polar payout after the first live order | Accepted at the $10 minimum; the settlement delay and transfer time are recorded; any account-review hold is noted |
| T-WAL-01 M | Sign in on a second device with the same account | The same balance appears; no code or secret is shown |
| T-WAL-02 A+M | Two devices spend at once | Balance conserved |
| T-WAL-03 A | Six wrong login codes in a row | The code dies after the fifth; a new one must be requested |
| T-WAL-04 A | Two devices sign in to one account at once | Balance conserved |
| T-WAL-05 A | Sign in on a device whose anonymous wallet holds credits | Balances merge; total conserved; open requests move |
| T-WAL-06 A+M | An eleventh signed-in device | Refused; removing a device on the Account screen frees a slot |
| T-WAL-07 M | Sign out on one device | That device gets a fresh anonymous wallet; the account and its other devices are unaffected |
| T-WAL-08 M | Lose the phone, then sign in on a new one | The credits are there; projects on the lost phone are gone unless exported |
| T-WAL-09 M | Support ID | Eight characters; not secret; not a login credential |
| T-WAL-10 M | Export my server data | JSON of ledger and purchases; never a hash |
| T-WAL-11 M | Delete my account | Account and wallet removed; devices revoked; purchase records anonymized |
| T-WAL-12 M | Sign out on the web and reload | Only the device credential remains in browser storage; no account data |

### 49.8 Series, languages, accessibility, performance (T-SER, T-L10N, T-A11Y, T-PRF)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-SER-01 G | Make a series from a finished project | The bible captures characters, voices, style and locations |
| T-SER-02 M | New episode | Inherits the bible; the script screen shows the summary and the previous last frame option |
| T-SER-03 M | Reuse an approved character; add a new one | 0 credits; 4 credits |
| T-SER-04 M | Finish an episode | The summary updates (150 words or less) free and is editable |
| T-SER-05 G | 3 episodes, 2 characters, 2 locations | At least 80% recognizable; names and facts stay correct (G9) |
| T-SER-06 M | Compile 3 episodes | One MP4; matching audio and resolution; no credits |
| T-SER-07 M | Delete an episode; delete a series | Files removed; others intact |
| T-SER-08 M | Reinstall or change device | Series and projects are gone, as the screen warned; credits survive through the wallet |
| T-SER-09 M | A new episode in a different language or aspect than the bible | Follows the bible; mismatch warned |
| T-L10N-01 M | All 20 UI languages at 200% font scale | No truncation or overlap |
| T-L10N-02 G | Arabic, Hebrew, Urdu | Layout mirrors; chevrons flip; grid order flips; the code, numbers and credits stay left-to-right |
| T-L10N-03 A | Credit plurals in each language | Correct forms for 0, 1, 2, 5, 11, 21, 100 |
| T-L10N-04 M | Dates, numbers, durations | Locale-aware |
| T-L10N-05 M | An unreviewed language | 'Beta translation' label |
| T-L10N-06 A | Every ARB against English | No missing or extra keys; same placeholders; no hardcoded strings |
| T-L10N-07 M | Change language during a render or job | The UI switches; the job continues |
| T-L10N-08 G | Each language that ships | Passes G7 and has a store listing and screenshots |
| T-A11Y-01 M | TalkBack and a web screen reader through every screen | Labels present; logical order |
| T-A11Y-02 M | Maximum font scale | Text scales; no broken layouts |
| T-A11Y-03 M | Reduce Motion | Every animation becomes an instant opacity change |
| T-A11Y-04 M | Targets | All at least 48x48 dp |
| T-A11Y-05 A | Contrast of every text pair in both themes | At least 4.5:1 |
| T-A11Y-06 M | Status, zones and errors | Always an icon and a label |
| T-A11Y-07 A | Source scan of `widgets/` and `screens/` | No raw colors or sizes, no left or right insets, no Material or Cupertino imports |
| T-A11Y-08 M | Keyboard opens on the script screen | The bottom bar collapses with its border and gap; no jump when it closes |
| T-A11Y-09 M | Web keyboard only | Every control reachable; visible focus ring; Escape closes sheets |
| T-A11Y-10 M | Screenshot of each screen against a reference-tier app | Weight, spacing and clarity match (value V9) |
| T-PRF-01 M | Cold start on E1 | Under 2 s on Android; under 3 s on the web |
| T-PRF-02 M | Shot board and a 100-project list | 60 fps, no dropped frames |
| T-PRF-03 M | Local reads | Under 50 ms |
| T-PRF-04 M | Memory and battery during a 90 s render and 12 picture jobs | No out-of-memory; battery use reported |
| T-PRF-05 M | Project footprint | Listed on the storage screen |
| T-PRF-06 M | Install size and web payload | Recorded against the budget set at G3 |

### 49.9 Security, network, operations, store, upgrade (T-SEC, T-NET, T-OPS, T-STR, T-UPG)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-SEC-01 A | Forged or missing device credential | Rejected; nothing revealed |
| T-SEC-02 A | Fake purchase token or Polar payload | Rejected; reference not burned |
| T-SEC-03 A | Replay of any paid request key | Charged once |
| T-SEC-04 A | Login-code brute force | Five attempts, then the code dies; rate-limited |
| T-SEC-05 A | Oversized or malformed bodies | Rejected cheaply |
| T-SEC-06 A | SQL injection and unicode tricks in every text field | Parameterized queries; no effect |
| T-SEC-07 M | Decompile the release APK and read the web bundle | No provider, Google, Gemini, Polar or Cloudflare secret; only the API base URL |
| T-SEC-08 M | Worker logs | No bodies, scripts, pictures or codes |
| T-SEC-09 M | Gemini key restrictions | Works only for the Generative Language API |
| T-SEC-10 A | Session endpoint flood | Rate-limited |
| T-SEC-11 M | Rotate every secret (Cloudflare token, service account, Gemini, Segmind, Pruna, Polar, pepper) | The apps keep working after redeploy; rotating the pepper invalidates pending login tokens, documented |
| T-SEC-12 M | Web CSP | The page loads only from allowed origins; a blocked inline script is reported |
| T-SEC-13 M | CORS from a foreign origin | Rejected |
| T-NET-01 M | Airplane mode during analyze, picture, voice, clip, purchase | Clear message; no lost charges; resume on reconnect |
| T-NET-02 M | Render fully offline | Works (render is local) |
| T-NET-03 M | A slow network and 5% packet loss | Timeouts respected; no duplicate charges |
| T-NET-04 M | DNS failure, captive portal, IPv6-only | Offline banner; no crash |
| T-NET-05 M | The Worker returns 500 for an hour | Refunds; no stuck reservations after the cron |
| T-NET-06 M | A wrong device clock | Server time governs leases and expiry |
| T-NET-07 A | Randomized faults at every protocol step | No job charged without delivery; no stuck reservation; ledger conserved |
| T-NET-08 A | A slow clip job racing the cron | Never both refunded and charged |
| T-OPS-01 M | Global video cap reached | Busy before reserving; resumes next day |
| T-OPS-02 M | Fallback budget reached | Busy; no charge |
| T-OPS-03 M | Change a credit cost, a pack list or a language flag in config | Takes effect without a release |
| T-OPS-04 M | Swap a model ID for its named fallback | The affected G5, G7 and G8 checks pass |
| T-OPS-05 M | Daily cron | Heartbeat written; stale reservations and clip jobs refunded; R2 objects older than 24 hours deleted; milestones written |
| T-OPS-06 M | The cron fails once | The next run catches up; the heartbeat gap is visible |
| T-OPS-07 M | Weekly cost reconciliation | Expected cost per job matches provider balances within tolerance |
| T-OPS-08 M | Roll back a Worker deploy | The previous version serves; migrations stay compatible |
| T-OPS-09 M | Provider prepaid balance low | Operator warned; users see 'busy' |
| T-OPS-10 M | Support runbook | Verify an order, adjust a ledger, raise fair use for a Support ID, block an install by a large debt, read the conversion summary |
| T-OPS-11 A | Purchase-gate counters | A wallet hitting the gate five times counts once; its first purchase counts once; a refund does not decrement; the summary is written daily and flags 500 gate wallets |
| T-STR-01 M | Data safety answers against the real flows | They match F004 exactly, including clips held for 24 hours |
| T-STR-02 M | Privacy, terms, support, child-safety, delete-account pages | Live, reachable, consistent with the app, naming VideoMilla and the contact |
| T-STR-03 M | AI-content policy checklist | In-app reporting; moderation tested; no restricted content |
| T-STR-04 M | 'Built with Llama' in About and on the site | Present |
| T-STR-05 M | Target API level, foreground-service declaration, permissions | Pass |
| T-STR-06 M | Closed test | 12 testers for 14 continuous days; no S1 |
| T-STR-07 M | Listing and samples | Show the real mix of a few animated shots; labeled AI-generated |
| T-UPG-01 A | Local schema migration up; a downgrade attempt | Up works; downgrade refused safely |
| T-UPG-02 M | An old app against a newer Worker | The versioned API works or triggers the update screen |
| T-UPG-03 M | A new config key unknown to an old app | Ignored safely |
| T-UPG-04 M | A string key missing in a translation | Falls back to English, never blank |
| T-UPG-05 M | Staged Play rollout | Monitor crashes and purchase errors before widening |

## 50. Behaviors the plan had to define, the regression suite, release checklist

| # | Question | Decision (binding unless you change it) |
| --- | --- | --- |
| D-1 | Changing the aspect ratio after pictures exist | Locked after the first picture; duplicate the project to change it |
| D-2 | Script language versus the selected content language | The selection governs; no auto-detection |
| D-3 | Editing the script after analysis | Text edits do not re-analyze; a 'Re-analyze' button warns that generated pictures will be discarded and counts as an analysis |
| D-4 | Characters | At most 6 per project and 2 per shot |
| D-5 | Swapping a template after the sheet is approved | Allowed; resets that character's approval and sheet (4 credits to regenerate); shots keep their pictures until regenerated |
| D-6 | Shot management | Reorder, delete and add shots on the scene review and shot board; deleting a generated shot does not refund; a new shot costs 1 credit when its picture is generated |
| D-7 | No hardware encoder or no WebCodecs | A clear message and the image-and-audio export |
| D-8 | A picture or clip charged but not delivered | A picture can be re-requested under the same key at no charge for 7 days; a clip is downloadable for 24 hours; after that it is a support-runbook case |
| D-9 | Devices per account | 10 signed-in devices |
| D-10 | Signing out on a device | Gives that device a fresh anonymous wallet; the account and its other devices are unaffected |
| D-11 | Email sign-in on Android | The 6-digit code is typed into the app; the magic link is for the web |
| D-12 | The sample area before samples exist | Collapses to zero height on Home and the website |

**Regression suite (every release).** All automated files (the 12 Dart tests, the two Android adapter tests, the Worker's ledger, protocol, schema, moderation, AI-route, image, clip, Polar and Play suites); the smoke cases T-INS-01, T-ANL-02, T-SHT-01, T-ANI-04, T-RND-02, T-WRD-02, T-STO-01, T-WEB-01, T-WAL-02, T-NET-07, T-OPS-05; the language checks for any language whose strings changed; the performance cases on E1.

**Release checklist.** \[ \] Ledger scenarios pass on real D1 (G6) · \[ \] G1 to G16 pass · \[ \] Sections 49.1 to 49.9 run on E1 to E8 with zero open S1 or S2 · \[ \] D-1 to D-12 implemented and tested · \[ \] Data safety form matches the flows · \[ \] Secrets rotation drill passed · \[ \] Polar switched to live and a real order credited · \[ \] Closed test finished without S1 · \[ \] Staged rollout plan ready.

---

*End of the VideoMilla Master Blueprint. 318 files, 11 phases, 32 batches, 16 gates, 603 commands.*

---

# PART IX. ACCOUNTS, EMAIL, REFERRALS, SOUNDS, CARTOON ME (release additions)

This part completes the release scope. It adds 41 files (F280 to F320), retires two (F038 and F161), renames two (F077 and F082), lists every existing file it changes, and sets the final counts: **318 files, 11 phases, 32 batches, 16 gates, 603 commands.** Where this part and an earlier part differ, this part governs; the earlier parts were also corrected in place wherever a sentence conflicted.

## 51. Final scope decisions

| Item | Decision |
| --- | --- |
| Accounts and sign-in | Email (a magic link plus a 6-digit code in the same message) and Sign in with Google. Anonymous until the first purchase; **sign-in is required to buy**. The wallet recovery code and the 5-device limit are removed |
| Wallet | One wallet per account, shared by the Android app and the web app. Projects and finished videos stay on the device or browser that made them; credits are shared |
| Background sound | Optional. A small library of CC0 tracks hosted on the website (downloaded on first use and cached on the device) plus the user's own audio file. Chosen at the Render step, mixed at render time, 0 credits, nothing uploaded |
| AI music | Not offered. No music provider account |
| Cartoon Me | The user's own face as a character in the four cartoon styles only. Needs sign-in, an 18+ attestation, exactly one face, no apparent minor, and moderation; the photo is not stored; 4 credits; at most 3 a month per account. **Switched off on every platform until the Play approval, then switched on** |
| Real people other than the user, celebrities, licensed characters | Blocked |
| Photoreal children | Not allowed, on any platform or channel |
| Photoreal self-likeness | Not in this release |
| Referral program | 10% for the referred user and 10% for the referrer, rules in Section 53 |
| Purchases | Final. A refund or chargeback forced by a platform removes the credits of that purchase; the debt rule covers the rest |
| Domain | One custom domain on Cloudflare; the extension is yours to choose (a .com is recommended). Until it is attached, the pages.dev and workers.dev addresses are used |
| iOS | A native app is not generated. iPhones on iOS 26 or later use the web app |

## 52. Domain, addresses, accounts and sign-in

### 52.1 Addresses

| Purpose | Address | Hosted on |
| --- | --- | --- |
| Static site and legal pages | `https://<DOMAIN>` | Pages project `videomilla` |
| Sounds | `https://<DOMAIN>/sounds/` | Same project (`website/sounds/`) |
| Web app | `https://app.<DOMAIN>` | Pages project `videomilla-app` |
| API | `https://api.<DOMAIN>` | The Worker as a custom domain |
| Login emails | from `login@<DOMAIN>`, reply-to `stmakarios@gmail.com` | Brevo and Cloudflare Email Service |
| Support | `stmakarios@gmail.com` | Gmail |

The apps read three build defines: `SITE_BASE`, `APP_BASE`, `API_BASE`. Until the domain is attached they default to the `pages.dev` and `workers.dev` addresses, so no code changes when the domain arrives: set the three defines in the workflows (F263, F270) and redeploy. The domain's DNS must be on Cloudflare. The records for Brevo's domain authentication are added there (Brevo shows the exact records); Cloudflare Email Service configures its own SPF, DKIM and DMARC when the domain is on Cloudflare.

### 52.2 Account model

An **account** is a verified email address, or a Google identity, tied to exactly one **wallet**. Devices (the Android app, a browser) hold a device credential as before; signing in points that device at the account's wallet. A device that has not signed in has its own anonymous, empty-by-default wallet.

```sql
-- worker/migrations/0003_accounts.sql (F280)
CREATE TABLE accounts(
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL UNIQUE REFERENCES wallets(id),
  email TEXT UNIQUE,
  email_verified_at INTEGER,
  google_sub TEXT UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  adult_attested_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE auth_tokens(
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  referral_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX idx_auth_tokens_email ON auth_tokens(email, created_at);
CREATE TABLE email_quota(provider TEXT NOT NULL, window TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(provider, window));
CREATE TABLE referrals(
  id TEXT PRIMARY KEY,
  referrer_account TEXT NOT NULL,
  referred_account TEXT NOT NULL UNIQUE,
  purchase_ref TEXT,
  pack_credits INTEGER,
  referred_bonus INTEGER NOT NULL DEFAULT 0,
  referrer_bonus INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  settles_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_account, state);
```

`0001_schema.sql` no longer creates `wallets.recovery_hash` or the `codes` table.

### 52.3 Email sign-in, step by step

1. The user enters an email address. The app calls `POST /auth/email/request` with the address and the UI language (and a referral code, if one was typed).
2. The Worker lower-cases and trims the address, checks the limits in Section 52.5, makes a 32-byte token and a 6-digit code, stores only their keyed hashes with a 15-minute expiry, and sends one email through the router (52.8). The reply is always 'sent', whether or not the address has an account, so the endpoint cannot be used to discover who has one.
3. The email holds a button and the code. **Web:** the button opens `https://app.<DOMAIN>/#/auth?token=...`; the token sits in the URL fragment, so it never reaches a server log; the page posts it to `POST /auth/email/verify` and then removes it from the address bar. **Android:** the user types the code into the app (no deep-link domain verification is needed); a link opened on another device simply fails and the code is used instead.
4. On success the Worker finds or creates the account for that email, resolves its wallet, **merges this device's anonymous wallet into it** with the `linkWallet` batch (balance, debt, open requests and purchases move; ledger rows `merge_out` and `merge_in` are written), marks the token used, applies a pending referral code if the account is new and has no purchase, and returns the account summary and balance.

### 52.4 Sign in with Google

The app obtains a Google ID token through the platform adapter (F303 on the web, F304 on Android) and posts it to `POST /auth/google`. The Worker verifies the signature against Google's published certificates with Web Crypto, checks that the audience is one of the configured client IDs, that the issuer and expiry are valid, and that the email is verified; then it finds or creates the account (matching an existing account by verified email, so Google and email reach the same wallet) and merges the device's wallet exactly as in 52.3. It costs nothing and sends no email.

### 52.5 Limits (D1 config `auth`, adjustable)

| Limit | Value |
| --- | --- |
| Code and token lifetime | 15 minutes |
| Wrong code attempts | 5, then that code dies and a new one must be requested |
| Login emails per address | 5 per hour and 20 per day |
| Login email requests per network address | 20 per hour |
| Verify attempts per network address | 10 per 15 minutes |
| Signed-in devices per account | 10; the Account screen lists and removes them |

### 52.6 Security rules

- Tokens and codes are stored as HMAC-SHA-256 with the pepper, compared in constant time, single use; a used or expired token behaves like a wrong one.
- Responses take similar time whether or not an account exists.
- The landing page sends `Referrer-Policy: no-referrer`; the app calls `history.replaceState` to clear the token.
- The Worker stores the lower-cased email (it must, to send mail), the account and wallet IDs, and the Google subject; nothing else about the person. The privacy page, terms and Data safety form say so (F004, F005, F276).
- Polar receives the account's email at checkout, so the checkout page opens pre-filled; the Worker also passes the wallet ID as the external customer ID.

### 52.7 Sign out and delete

- **Sign out:** the device is given a fresh anonymous wallet; the account wallet is not reachable from it; the Account screen on another device can also remove it.
- **Delete account:** `DELETE /me` removes the account row (email and Google subject), deletes the wallet, revokes every device, and keeps anonymized purchase records. Referral rows are anonymized.

### 52.8 The email router (counter-driven)

```ts
// F282 email_router.ts (shape)
const BREVO_DAILY_LIMIT = 290;   // Brevo's free plan allows 300 a day; it resets at 00:00 UTC
export async function sendLoginEmail(env: Env, msg: LoginEmail): Promise<'brevo' | 'cloudflare'> {
  const day = new Date().toISOString().slice(0, 10);
  if (await takeQuota(env.DB, 'brevo', day, BREVO_DAILY_LIMIT)) {
    try { await sendBrevo(env, msg); return 'brevo'; } catch { await releaseQuota(env.DB, 'brevo', day); }
  }
  const month = day.slice(0, 7);
  await takeQuota(env.DB, 'cloudflare', month, Number.MAX_SAFE_INTEGER);   // counted for the 3,000 included
  try { await sendCloudflare(env, msg); return 'cloudflare'; }
  catch { throw new AppEmailError('email_unavailable'); }
}
```

The switch is decided by the counter **before** sending, not by an error, because Brevo does not reject over-limit mail: it holds up to 1,000 extra transactional emails in a retry queue and delivers nothing beyond that, so a late login email would sit in a queue while the user waits. Cloudflare Email Service includes 3,000 outbound emails a month on Workers Paid and charges $0.35 per 1,000 after that; it has been in public beta since April 2026, which is why Brevo is first and Cloudflare is the overflow. If both fail the app says 'We could not send the email. Try Google sign-in or try again in a few minutes.' The cron writes a heartbeat row when the Cloudflare monthly count passes 3,000.

### 52.9 Cost of sign-in

With a Brevo allowance of about 9,000 emails a month and 3,000 included on Cloudflare, **10,000 logins a month cost about $0**. The only new fixed cost is the domain: $10.46 a year for a .com at Cloudflare Registrar, rising to about $11.17 after November 1, 2026 (the registry's increase). Long-lived device sessions and Google sign-in keep the email count low.

## 53. Referrals and purchase reversals

### 53.1 Referral rules (D1 config `referral`, adjustable)

| Rule | Value |
| --- | --- |
| Code | Every account has an 8-character code (A to Z and 2 to 9, no look-alike letters) |
| How a code is used | Typed at sign-up ('Have a referral code?') or opened from a share link on the web; applied only to a new account that has made no purchase |
| Trigger | The referred account's **first successful purchase of a pack with at least 90 credits**, on any channel |
| Referred user's reward | 10% of the pack's credits (rounded down: 9, 16, 35 or 75), added **immediately** as real credits in the main wallet |
| Referrer's reward | The same amount, **pending for 14 days**, then added as real credits |
| Caps per referrer | 20 qualifying referrals and 500 bonus credits in any rolling 30 days; beyond that the share is not paid |
| Reversal | A refund or chargeback of the qualifying purchase **inside the 14 days** voids both bonuses (the referred bonus is removed; the referrer's pending share is cancelled). After the 14 days the referrer keeps the bonus and only the buyer's own credits are removed |
| Anti-abuse | No self-referral (the referrer account, wallet and device credential must differ from the referred ones); new accounts only; one referral per referred account; a referrer in debt is not paid until the debt is repaid |
| Credits | Bonus credits are ordinary credits: they never expire and are spent like any others |
| Android share | The app shares a neutral link to the website home and the code to be typed at sign-up; it never links to a purchase page |

Worst case on a $4.99 pack: 16 + 16 = 32 bonus credits, about $0.30 of provider cost, and only if they are spent.

### 53.2 Mechanics

- **At the qualifying purchase** the same Worker request that runs `creditPurchase` (F073) calls `grantReferral` (F289) as a second batch: it inserts a `referrals` row in state `pending` with `settles_at` 14 days out, and adds the referred bonus to the referred wallet with ledger kind `referral_bonus`.
- **Daily cron** (F106 calls F289): for every `pending` row past `settles_at` whose purchase is not voided and whose referrer is within the caps, it adds the referrer's share with ledger kind `referral_settle` and marks the row `settled`; rows over the caps become `capped`.
- **On a reversal** (53.3) `voidReferral` marks a pending row `void`, removes the referred bonus with the void pattern of Section 23.3 (kind `referral_void`, becoming debt if spent), and cancels the referrer's share.

```sql
-- grantReferral, second batch (shape)
INSERT INTO referrals(id,referrer_account,referred_account,purchase_ref,pack_credits,referred_bonus,referrer_bonus,state,settles_at)
  VALUES(:id,:referrer,:referred,:h,:pack,:bonus,:bonus,'pending',:settles);
INSERT INTO ledger(wallet_id,delta,kind,ref) VALUES(:referredWallet,:bonus,'referral_bonus',:id);
UPDATE wallets SET balance = balance + :bonus WHERE id = :referredWallet;
```

### 53.3 Purchase reversals, in plain terms

A **refund** is the buyer asking Google, Polar or you, and the money going back. A **chargeback** is the buyer telling their bank they did not authorize the charge; the bank takes the money back first. Both end the same way inside VideoMilla: the purchase is voided, the credits it brought are removed from the wallet, credits already spent stay spent, and any shortfall becomes a **debt** that blocks spending until a new purchase repays it. This is the safety net for the rare platform-forced case; it is not a refund policy.

- **Android:** the daily cron reads the Voided Purchases list (it covers user refunds, cancellations, chargebacks and developer refunds, but only the last 30 days, so the cron must run every day) and applies `voidPurchase`. Google is the seller of record and handles disputes; you see the outcome. If a refund leaves your Google balance negative for 48 hours, Google collects the shortfall from your payout bank account.
- **Web:** Polar is the seller of record. It may refund within 60 days at its own discretion even when your policy says no refunds, does not return its fee (about $0.60 on a $4.99 pack), and charges $15 for each dispute. `order.updated` with a refund runs `voidPurchase` (F104).
- **Typical scale:** chargeback rates for digital goods run roughly 0.6% to 2% depending on the source; Visa's monitoring thresholds are 0.9% and 1.5%. Consumable in-app purchases are generally not refundable.

### 53.4 The policy and where it appears

**All purchases are final.** Credits already used are never refunded. If a platform or payment provider refunds or reverses a purchase, the credits that purchase brought are removed from the wallet; if the balance cannot cover it, the shortfall is a debt that must be repaid by a new purchase before further spending; referral bonuses tied to that purchase are removed if it happens inside the 14 days. A technical failure (credits paid for but not delivered) is fixed by re-crediting, never by a refund. The text appears in `website/refunds.html` (F320), in the terms (F005), as one line under every pack ('All purchases are final'), and in the store listing (F275).

### 53.5 Support runbook additions

Look up a purchase by Support ID and order; re-credit a failed delivery; reverse a referral by hand; raise a referral cap for one account; clear a debt after a documented goodwill decision.

## 54. Background sound

### 54.1 The library and where it lives

- About 16 tracks: 10 short music loops and 6 ambient loops (rain, wind, crowd, forest, city, room), 30 to 90 seconds each, MP3 at 128 kbps (a few MB each).
- **Only CC0 files.** Sources: Freesound (filter by CC0), Kenney and OpenGameArt (CC0 items only). CC0 needs no attribution and may be bundled and redistributed.
- They live in the repo at `website/sounds/` and are served by the static site (F318 `manifest.json`, F319 `LICENSES.md`). The Play app does not bundle them: it downloads a track the first time the user previews or picks it and keeps it on the phone; the web app fetches the same files and caches them in IndexedDB. Hosting costs nothing and the Play app stays small.
- `LICENSES.md` records for every file its source address, author, license and the date it was checked; the G3 license check reads it. A file without a recorded CC0 license is not committed.

```
// website/sounds/manifest.json entry (keys shown as in the file)
{ id: 'rain-soft', title: 'Soft rain', kind: 'ambient', seconds: 60, file: 'rain-soft.mp3',
  author: '<author>', source: '<source address>', license: 'CC0', checked: '2026-11-01' }
```

### 54.2 What the user sees

On the Render screen a **Background sound** row offers: **None**, **Library** (a list with preview and download progress), and **My audio file** (a file picker). After a choice there is a volume slider (default 20%, under the narration) and a fade-out at the end. Longer audio is trimmed with the fade; shorter audio loops. The user's file is read on the device, never uploaded. A notice under 'My audio file' says: 'Only use audio you have the right to use.' The choice costs 0 credits and changing it means a free re-render. It is chosen at **render time, not at input**, and applied together with the narration when the video is rendered.

### 54.3 How it is mixed

The render plan (F055) carries one optional `sound` entry: source path, volume, fade, loop. Android adds a second audio sequence of the track to each render group (F141) with a gain, looped to the group's length; the web mixes it with the narration in the offline audio graph before encoding (F128). Both are tested at G1 and G15 with a library track and a user file.

## 55. Cartoon Me

**Flag:** `cartoon_me_enabled` in D1 config, **off on every platform until the Play approval, then on**.

### 55.1 What the user does

1. Signs in (required, so the consent is recorded).
2. In the Cast step taps **Cartoon Me**; a card says 'This is my own face and I am 18 or older' with a Confirm button. Confirming stores a timestamp on the account (`adult_attested_at`), never the photo.
3. Takes or picks one photo.
4. The app prepares it (512 px, no metadata) and calls `POST /reference/check` in `self` mode. The Worker's vision check must report exactly one face and no apparent minor, and the photo passes moderation. Otherwise the photo is refused with a plain message and discarded.
5. The app calls `POST /image` with `self_mode` and the cartoon style anchor; the Worker allows a face reference only in the four cartoon styles, only with the flag on and the attestation present, and composes a stylized-cartoon prompt that forbids a photographic result. Four 448x448 portraits come back (4 credits).
6. The user approves; the character 'Me' joins the cast with a stock voice. The selfie is deleted from the device after generation. The Worker never stores it.

### 55.2 Limits and rules

- At most 3 Cartoon Me sheets per account in any rolling 30 days (D1 config).
- No voice cloning, no photoreal output, no use in Photoreal Story, Cinematic, Ink Noir or Realistic Scenes.
- Normal reference uploads still reject any face; only `self` mode accepts one.
- Moderation runs on the prompt and the portraits as for any image; sexual content and anything involving a minor is blocked as everywhere.
- The privacy page and Data safety form list the photo as processed transiently by Cloudflare Workers AI and not stored.

### 55.3 Store risk, stated plainly

The app cannot tell whose face a photo shows, so a reviewer could test it with a celebrity's photo. Stores target non-consensual synthetic imagery of real people. The flag stays off until the Play approval so the first review sees an app without it; the attestation, the one-face and apparent-minor checks, moderation, the monthly limit and the report control are the controls that remain once it is on.

## 56. The 41 added files (F280 to F320)

File numbers are identifiers, not build order. The original F001 to F279 keep their numbers; the added files continue from F280; F038 and F161 are retired and never reused. Build order is the batch table in Section 25. D means depends on, U means used by.

### 56.1 Worker (batches wd and wq: F280 to F292, all under `worker/`; F280, F289 and F292 are built in wd, F281 to F288, F290 and F291 in wq, F082 from Section 35.2 and F067 from Section 35.1 are built in wq)

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F280 | `migrations/0003_accounts.sql` | `accounts`, `auth_tokens`, `email_quota`, `referrals` (Section 52.2); seeds the `auth` and `referral` config rows | Applied after 0001 and 0002 | D: F065, F099. U: F103, F281 to F289 |
| F281 | `src/lib/accounts.ts` | `findOrCreateByEmail`, `findOrCreateByGoogle`, `mergeIntoAccount` (uses `linkWallet` of F073), `signOut` (fresh anonymous wallet), `deleteAccount`, `newReferralCode` | The only place accounts are created or merged | D: F073, F077, F280. U: F286, F287, F082 |
| F282 | `src/lib/email_router.ts` | The counter-driven router of Section 52.8: Brevo while its UTC-day count is under 290, otherwise Cloudflare; a failure of the chosen sender falls through to the other once; both failing raises `email_unavailable` | Quota rows live in `email_quota` | D: F280, F283, F284. U: F286, F291 |
| F283 | `src/lib/email_brevo.ts` | `sendBrevo(env, msg)`: one transactional email through Brevo's API with the `BREVO_API_KEY`; sender `login@<DOMAIN>`; text and HTML parts | Request shape confirmed at G16 | D: F066, F280 |
| F284 | `src/lib/email_cloudflare.ts` | `sendCloudflare(env, msg)`: one email through the Cloudflare Email Service `send_email` binding | Needs Workers Paid and the domain on Cloudflare DNS; shape confirmed at G16 | D: F066, F280 |
| F285 | `src/lib/email_templates.ts` | Subject and body for each of the 20 languages (a short sentence, the button, the code, a 15-minute notice), HTML and text; `dir=rtl` for Arabic, Hebrew and Urdu | The email language follows the app language sent in the request | U: F286 |
| F286 | `src/routes/auth_email.ts` | `POST /auth/email/request` (limits, tokens, router, always answers 'sent') and `POST /auth/email/verify` (token or email plus code; five attempts; merge; referral apply) | Section 52.3 | D: F074 to F077, F280 to F282, F285 |
| F287 | `src/routes/auth_google.ts` | `POST /auth/google`: verifies the Google ID token with Web Crypto against Google's certificates (cached for an hour), checks audience, issuer, expiry and verified email; then the same find-or-create and merge | Section 52.4 | D: F280, F281 |
| F288 | `src/routes/referral.ts` | `GET /referral` (code, counts, pending and settled credits) and `POST /referral/apply` (new account without a purchase only) |  | D: F280, F289 |
| F289 | `src/lib/referrals.ts` | `grantReferral`, `settleReferrals` (cron), `voidReferral`, cap checks | Section 53.2 | D: F073, F280. U: F104, F106, F111, F288, F292 |
| F290 | `test/auth.test.ts` | Token expiry, five attempts, single use, enumeration-safe answers, limits per address and per network, merge conservation, Google token cases, sign-out, delete | Gate G16 | D: F286, F287 |
| F291 | `test/email_router.test.ts` | Under 290 uses Brevo, at 290 uses Cloudflare, one sender failing falls through, both failing raises the error, the UTC rollover | Gate G16 | D: F282 |
| F292 | `test/referral.test.ts` | Trigger rules, rounding, the 14-day hold, caps, void inside and outside the hold, debt, self-referral blocked | Gate G6 | D: F289 |

### 56.2 Models, contracts, logic (batches m2 and c2)

| # | File | Contents | Connects |
| --- | --- | --- | --- |
| F293 | `core/models/account_state.dart` | signedIn, email, method (email or google), deviceCount, referralCode, cartoonMeAttested | U: F305 |
| F294 | `core/models/referral_state.dart` | code, referredCount, pendingCredits, settledCredits, appliedCode | U: F306 |
| F295 | `core/models/sound_choice.dart` | `SoundChoice` (none, library, user; trackId; userPath; volume 0 to 100 default 20; fadeMs) and `SoundTrack` (a manifest entry) | U: F298, F307, F037 |
| F296 | `core/services/auth_service.dart` | `requestEmail`, `verifyCode`, `verifyToken`, `signInWithGoogle`, `signOut`, `deleteAccount`, `account()`, `devices()`, `removeDevice(id)`; and `abstract class GoogleIdTokenSource { Future<String?> idToken(); }` | Implemented by F300; U: F300, F303 to F305 |
| F297 | `core/services/referral_service.dart` | `summary()`, `apply(code)`, `shareText()` | Implemented by F301 |
| F298 | `core/services/sound_service.dart` | `library()`, `fetchTrack(id, {onProgress})`, `cachedPath(id)`, `pickUserFile()` | Implemented by F302 |
| F299 | `core/logic/referral_math.dart` | `referralBonus(packCredits) = floor(packCredits / 10)`; `isQualifyingPack(credits) = credits >= 90`; `withinCaps`; `settlesAt` | U: F306, F316 |

### 56.3 Adapters, providers, widgets, screens

| # | File | Contents | How it works | Connects |
| --- | --- | --- | --- | --- |
| F300 | `platform/shared/auth_adapter.dart` | Implements AuthService over the Worker client and a `GoogleIdTokenSource` | One door for sign-in on both platforms | D: F113, F296 |
| F301 | `platform/shared/referral_adapter.dart` | Implements ReferralService |  | D: F113 |
| F302 | `platform/shared/sound_adapter.dart` | Implements SoundService: fetches `SITE_BASE/sounds/manifest.json` (cached; the cache is used offline), downloads a track on first use into app storage (Android) or IndexedDB (web), opens the user's file with `file_picker` |  | D: F046, F113, F318 |
| F303 | `platform/web/google_sign_in_web.dart` | `GoogleIdTokenSource` on the web with Google Identity Services | Registered only in the web set | D: F296 |
| F304 | `platform/android/google_sign_in_android.dart` | `GoogleIdTokenSource` on Android with the `google_sign_in` plugin | Registered only in the Android set | D: F296 |
| F305 | `core/providers/auth_provider.dart` | `AccountState`; request and verify; Google sign-in; sign-out; delete; `requireSignIn(context)` guard used before any purchase and before Cartoon Me; sets the signed-in flag on sign-in and clears it on sign-out; on `sessionEnded` it clears the flag and opens the sign-in sheet (F311) with the 'You were signed out' message |  | D: F296, F293 |
| F306 | `core/providers/referral_provider.dart` | Summary, apply, share text |  | D: F294, F297, F299 |
| F307 | `core/providers/sound_provider.dart` | `SoundChoice`, library list, download state, preview |  | D: F298, F295 |
| F308 | `widgets/code_field.dart` | Six boxes with paste, auto-advance and backspace; digits stay left-to-right in right-to-left layouts |  | D: F177 |
| F309 | `widgets/referral_card.dart` | The code, a Share button with neutral text, counts of pending and settled credits |  | D: F168 |
| F310 | `widgets/sound_picker.dart` | The Background sound row, the library sheet with preview and download progress, the user-file option with the rights notice, the volume slider |  | D: F178, F184, F307 |
| F311 | `widgets/auth_sheet.dart` | Email entry, send, code entry with resend after 30 seconds, the Google button, referral code field, clear errors for each limit |  | D: F178, F305, F308 |
| F312 | `widgets/cartoon_me_sheet.dart` | The consent card, photo pick and prepare, progress, the four portraits for approval; hidden when the flag is off |  | D: F178, F153, F305 |
| F313 | `screens/account_screen.dart` | Identity (email or Google), devices list with remove, referral card, sign out, delete account, link to the refunds page |  | D: F305, F306, F309 |
| F314 | `screens/login_screen.dart` | Full-page sign-in; handles the `#/auth?token=` landing ('Signing you in', verify, return to the previous route) |  | D: F305, F311 |

### 56.4 Tests and website (batches p6b, p7a, p7b)

| # | File | Contents | Connects |
| --- | --- | --- | --- |
| F315 | `test/auth_provider_test.dart` | Request, verify, wrong code, resend, sign-out, the guard before purchase | Tests F305 |
| F316 | `test/referral_math_test.dart` | Bonus rounding for 90, 160, 350, 750, qualifying packs, caps, hold date | Tests F299 |
| F317 | `test/sound_mix_spec_test.dart` | The `sound` entry in the render plan and the native spec: loop, trim, fade, volume | Tests F055, F130 |
| F318 | `website/sounds/manifest.json` | The 16 tracks (Section 54.1) | U: F302 |
| F319 | `website/sounds/LICENSES.md` | Source address, author, license (CC0) and check date for every file | U: G3 |
| F320 | `website/refunds.html` | The Section 53.4 text, in plain English | U: F217, F005 |

### 56.5 Retired and renamed

| File | Change |
| --- | --- |
| F038 `recovery_code.dart` | **Retired.** There is no recovery code |
| F161 `recovery_provider.dart` | **Retired.** Replaced by F305 |
| F077 `src/lib/recovery_code.ts` | **Renamed** `src/lib/tokens.ts`: 32-byte link tokens, 6-digit codes, 8-character referral codes, keyed hashes |
| F082 `src/routes/wallet_link.ts` | **Renamed** `src/routes/account.ts`: `GET /me`, `GET /me/export`, `DELETE /me`, `POST /auth/signout`, `GET /me/devices`, `POST /me/devices/remove` |

## 57. Existing files this part changes

| File | Change |
| --- | --- |
| F009 `pubspec.yaml` | Adds `google_sign_in` |
| F012 and F236 to F254 | New strings for sign-in, account, referral, background sound, Cartoon Me, refunds; English first (batches p4a to p6a), then the 19 translations |
| F024 `app_constants.dart` | `siteBase`, `appBase`, `apiBase` read from build defines; referral code length; sounds path |
| F036 `wallet_state.dart` | Drops anything about devices and codes |
| F037 `render_spec.dart` | Adds the optional `sound` entry |
| F041 `app_config.dart` | Adds `referral`, `auth`, flags `cartoon_me_enabled` and `google_signin_enabled` |
| F048 `credits_service.dart` | Removes `createCode`, `link`, `unlink` |
| F053 `identity_service.dart` | Removes recovery-code storage; keeps the device credential |
| F055 `render_plan.dart` and F130 `native_render_spec.dart` | Carry the `sound` entry |
| F063 `wrangler.toml` | Adds the `send_email` binding, `EMAIL_FROM`, `APP_ORIGIN`, `SITE_ORIGIN` |
| F065 `0001_schema.sql` | Drops `wallets.recovery_hash` and the `codes` table |
| F066 `env.ts` | Adds `BREVO_API_KEY`, `EMAIL_FROM`, `GOOGLE_OAUTH_CLIENT_IDS`, `SEND_EMAIL`, `APP_ORIGIN`, `SITE_ORIGIN` |
| F067 `index.ts` and F068 `http.ts` | New routes; CORS allows the app and site origins from config |
| F073 `ledger.ts` | Ledger kinds `referral_bonus`, `referral_settle`, `referral_void`; `linkWallet` is also used by sign-in |
| F079 `style_rules.ts` and F080 `prompts.ts` | Cartoon Me rule (face reference only in the four cartoon styles) and its cartoon-only prompt |
| F092 `image.ts` and F095 `reference_check.ts` | `self_mode`; `self` check mode (exactly one face, no apparent minor) |
| F103, F104 `checkout_polar.ts`, `webhook_polar.ts` | The account's email is passed to Polar to pre-fill checkout; the wallet ID is the external customer ID; `grantReferral` and `voidReferral` run on `order.paid` and refunds |
| F106 `cron.ts` | Settles referrals; clears expired tokens; rotates email-quota windows |
| F111 `purchase_play.ts` | Requires a signed-in wallet; runs `grantReferral` |
| F117 `credits_adapter.dart` | Drops the code and link calls |
| F123, F124, F134 | No recovery-code storage |
| F127, F128, F141 | Mix the background sound |
| F144 to F146 | Register the new adapters |
| F152, F153, F158, F159, F160 | Cartoon Me, sound choice, signed-in guard before purchase |
| F166 `app_scope.dart` | Builds the new providers |
| F192 `cost_confirm_sheet.dart` | Opens the auth sheet when a purchase is needed and the user is not signed in |
| F208 `character_screen.dart`, F212 `render_screen.dart`, F214 `store_screen.dart`, F215 `wallet_screen.dart`, F216 `settings_screen.dart`, F217 `about_legal_screen.dart` | Cartoon Me button; Background sound row; sign-in gate and 'All purchases are final'; balance only (no recovery code); Account row; refunds link |
| F004, F005, F006 | Privacy (email stored, Cartoon Me, sounds), terms (final sales, referrals, accounts), support |
| F262, F263, F270 | Secrets and the three build defines |
| F267 `build.gradle.kts` | Google sign-in configuration |
| F275, F276, F277 | Listing, Data safety (email address collected) and screenshots |

## 58. Updated build facts

### 58.1 Files per phase (318 in total)

| Phase | Files |
| --- | --- |
| 0 Pre-build | 8 |
| 1 Foundation | 16 |
| 2 Models | 19 |
| 3 Contracts and logic | 23 |
| 4 Worker | 65 |
| 5 Platform adapters | 39 |
| 6 Providers | 22 |
| 7 Widgets | 42 |
| 8 Screens | 19 |
| 9 Shell, tests, translations | 37 |
| 10 Assets, CI, store | 28 |

The 32 batches, in order, with their files, are in the Section 25 table.

### 58.2 The sixteenth gate and the extended checks

| Gate | When | What is proven | Pass | If it fails |
| --- | --- | --- | --- | --- |
| **G16 Sign-in and email** | After wq | The domain is on Cloudflare; Brevo's domain authentication and Cloudflare Email Service both send from `login@<DOMAIN>`; a login email reaches the inbox (not spam) in Gmail, Outlook and Yahoo with a working link and code; the router uses Brevo under 290 a day and Cloudflare at or above it; token expiry, five attempts, single use and every limit in Section 52.5; Google sign-in on the web and on Android; sign-out; delete; wallet merge | All pass; no enumeration difference between known and unknown addresses | Fix DNS records or the router; until it passes the sign-in button is hidden and no purchase can be made |

Extended checks inside existing gates: **G1 and G15** add a library track and a user file mixed under the narration; **G3** reads `LICENSES.md` and confirms every sound is CC0; **G5** adds Cartoon Me prompts and the apparent-minor check; **G6** adds the referral scenarios (trigger, hold, settle, void, caps, debt; run after wd) and the sign-in merge and conversion counters (run after wq); **G12** adds the customer email and external ID carried to Polar and the referral grant on `order.paid`; **G13** adds the `self` mode (exactly one face, apparent minor refused).

### 58.3 Command accounting (exact)

| Category | Count |
| --- | --- |
| One-time setup | 18 |
| Per-batch fixed: s0 6, site-a 4, 30 batches at 8 | 250 |
| File placements, one per file | 318 |
| English string appends (p4a, p4b, p4c, p5a, p5b, p6a) | 6 |
| pubspec asset, font and plugin sections (p7a) | 1 |
| Assets script run (1) and style-anchor copies (8) | 9 |
| Sound files copied with one command | 1 |
| **Total** | **603** |

### 58.4 Accounts (9) and cash

| # | Account | What you do | What you extract | Cost |
| --- | --- | --- | --- | --- |
| 1 | GitHub | Create the repo | Repo URL, SSH key | $0 |
| 2 | Cloudflare | Workers Paid, D1, R2, Queues, Workers AI, two Pages projects, Email Service (beta); register the domain at Cloudflare Registrar | Account ID, API token, D1 ID | $5 a month plus the domain (a .com is $10.46 a year) |
| 3 | Polar (existing) | Create 3 products | Access token, webhook secret, 3 product IDs | $0 |
| 4 | Segmind | Prepaid credits | API key | $30 float |
| 5 | Google Cloud | Enable Text-to-Speech and the Play Developer API; service account; OAuth client IDs for Google sign-in (web and Android) | Service-account JSON, client IDs | $0 inside free allowances |
| 6 | Google AI Studio | Gemini key, for fallback only | API key | about $10, only when fallback is enabled |
| 7 | Pruna direct | Fallback key | API key | $0 until used |
| 8 | Brevo | Create the account, authenticate the domain with the DNS records Brevo shows, create an API key | API key | $0 |
| 9 | Google Play Console | Developer account, app, 5 consumables, license testers | n/a | $25 once |

To launch the web you need accounts 1 to 5 and 8. Cash at web launch is about $45 (Cloudflare $5, domain $10.46, Segmind $30). Accounts 6, 7 and 9 come later. There is no music account.

## 59. Test cases for the added features

### 59.1 Sign-in and email (T-AUTH, T-EML)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-AUTH-01 M | A new web visitor taps Analyze, buys, signs in by email link, pays on Polar | Signed in; credits appear; the project continues |
| T-AUTH-02 M | The same person on Android signs in with the same email and types the code | The same balance; projects are not shared |
| T-AUTH-03 M | Google sign-in on the web and on Android with matching emails | One account and one wallet |
| T-AUTH-04 A | Five wrong codes | That code dies; a new one must be requested |
| T-AUTH-05 A | A code or token after 15 minutes, or reused | Rejected like a wrong one |
| T-AUTH-06 A | A sixth email for one address in an hour, a 21st in a day, 21 requests from one network in an hour | Limited with a clear message |
| T-AUTH-07 A | Request for a known address and an unknown one | Identical answer and similar timing |
| T-AUTH-08 M | Open the magic link on a different device | It fails; the code works |
| T-AUTH-09 M | After a link sign-in | The token is removed from the address bar; the page sends no referrer |
| T-AUTH-10 A+M | Sign in with an anonymous wallet that holds credits, debt and an open request | Everything merges; the total is conserved |
| T-AUTH-11 M | Sign out | The device gets an empty anonymous wallet; the account wallet is unreachable there; other devices are unaffected |
| T-AUTH-12 M | Delete the account | Email and Google ID removed; devices revoked; purchase records anonymized; a fresh sign-up works |
| T-AUTH-13 M | An eleventh device | Refused; removing one from the Account screen frees a slot |
| T-AUTH-14 M | Tap a pack while signed out | The sign-in sheet opens first; the pack follows |
| T-AUTH-15 M | Remove a signed-in device from another device's Account screen, or delete the account elsewhere, then open the removed device | The sign-in sheet opens with a short message; no empty wallet is created silently; after signing in the balance is back |
| T-EML-01 G | Send a login email to Gmail, Outlook and Yahoo | Inbox, not spam; link and code work |
| T-EML-02 A | Brevo count under 290 | Sent through Brevo |
| T-EML-03 A | Brevo count at 290 | Sent through Cloudflare with no Brevo call |
| T-EML-04 A | Brevo returns an error | Falls through to Cloudflare once |
| T-EML-05 A | Both senders fail | The message offers Google sign-in or retry |
| T-EML-06 A | UTC midnight | The Brevo count resets |
| T-EML-07 M | Emails in all 20 languages, including Arabic, Hebrew, Urdu | Templates exist; right-to-left renders correctly |
| T-EML-08 M | Cloudflare's monthly count passes 3,000 | A heartbeat note is written |

### 59.2 Referrals and reversals (T-REF, T-REV)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-REF-01 A | A qualifying first purchase of 90, 160, 350 and 750 credits | Referred bonus 9, 16, 35, 75 immediately; the referrer's share pending |
| T-REF-02 A | A purchase of fewer than 90 credits | No referral |
| T-REF-03 A | Day 13 and day 14 | Pending, then settled once by the cron |
| T-REF-04 A | Refund or chargeback inside the hold | Both bonuses void; debt if the referred bonus was spent |
| T-REF-05 A | Refund after the hold | The buyer's credits are removed; the referrer keeps the bonus |
| T-REF-06 A | The 21st referral in 30 days; the 501st bonus credit | Not paid |
| T-REF-07 A | Self-referral by account, wallet or device | Refused |
| T-REF-08 A | A code applied after a purchase; a second code | Refused |
| T-REF-09 M | Android share | Neutral text, no purchase link |
| T-REF-10 A | A referrer in debt | Settlement waits until the debt is repaid |
| T-REV-01 A | An Android refund appears in the voided list | The cron voids it within a day; credits removed |
| T-REV-02 A | A Polar refund webhook, replayed | Voided once; debt rule applies |
| T-REV-03 A | A chargeback | Treated as a refund |
| T-REV-04 M | Spending with a debt | Blocked with a clear message; a new purchase repays it first |
| T-REV-05 M | Pack sheet, store screen and `refunds.html` | 'All purchases are final' is visible |
| T-REV-06 M | Support runbook | Re-credit a failed delivery; no refund |

### 59.3 Sounds and Cartoon Me (T-SND, T-CME)

| ID | Steps and edge variants | Expected |
| --- | --- | --- |
| T-SND-01 M | Open the library online, then offline | The list loads; offline uses the cache; an empty state if it never loaded |
| T-SND-02 M | Use a track for the first time | A download with progress; later uses work offline |
| T-SND-03 M | Pick a user file at Render | The video contains it under the narration |
| T-SND-04 M | Volume and fade | 20% default; changes apply; fade-out at the end |
| T-SND-05 M | A shorter and a longer file | Shorter loops; longer is trimmed |
| T-SND-06 M | Change the sound after rendering | A free re-render; 0 credits |
| T-SND-07 M | Inspect network traffic | The user's file is never uploaded |
| T-SND-08 M | A corrupt or unsupported file | A clear error; the video renders without it |
| T-SND-09 G | Mixed output on the Android reference phone and the web | Narration stays clear; audio and video in sync |
| T-SND-10 M | App size and web cache | No sounds bundled in the Play app; the web caches fetched tracks |
| T-CME-01 M | Flag off | The button is hidden everywhere |
| T-CME-02 M | Flag on, signed out | The app asks to sign in |
| T-CME-03 M | Confirm the consent card | A timestamp is stored; the photo is not stored on the server |
| T-CME-04 A | A photo with no face, and one with two faces | Refused |
| T-CME-05 G | A photo of an apparent minor | Refused |
| T-CME-06 G | A celebrity photo test | The result is recorded as the known risk; the report path works |
| T-CME-07 M | Choose a style | Only the four cartoon styles are offered; never photoreal |
| T-CME-08 A | A fourth sheet in 30 days | Refused |
| T-CME-09 M | After generation | The selfie is deleted from the device or cleared from browser memory |
| T-CME-10 M | A normal reference upload with a face | Still refused |

The earlier cases T-WAL-01 to T-WAL-12, T-STO-12 and T-WEB-08 described the recovery code; they are rewritten above for accounts, and the T-AUTH cases add sign-in coverage.
