# Chrome Web Store submission — Asgard Bridge

5-minute fill-in. You're already signed in as paddy@luckdragon.io and have paid the $5 dev fee.

## Step 1 — Add new item

Open <https://chrome.google.com/u/3/webstore/devconsole>. Top-right: **Add new item** (or "+ New item").

## Step 2 — Upload the ZIP

Browse to and select: **`H:\asgard\asgard-bridge-extension.zip`**. Click Upload. The form auto-fills name + description from manifest.

## Step 3 — Fill the form (paste from below)

### Store listing tab

**Detailed description** (paste):

> Asgard Bridge connects your Chrome browser to your private Asgard AI infrastructure, letting it navigate, click, type, take screenshots, and extract content from any tab — using your real logged-in sessions on any site you're already signed into. The extension polls a single endpoint on your own Asgard worker (PIN-gated) and executes commands locally in your active tab. Zero telemetry, zero analytics, no third parties. Source: github.com/PaddyGallivan/asgard-source.

**Category**: Productivity

**Language**: English

**Store icon (128x128)**: already in the package. If asked, upload from `H:\asgard\extension\icon128.png`.

**Screenshots** (at least 1, 1280x800): upload `H:\asgard\store-screenshot-1280x800.png`

**Small promo tile** (440x280, optional): upload `H:\asgard\store-tile-440x280.png`

### Privacy practices tab

**Single purpose**:

> Browser automation bridge for the user's own private Asgard AI infrastructure. Polls a user-specified endpoint and executes navigate/click/type/screenshot commands locally in the active tab.

**Permission justifications** (paste each):

- `scripting` / `tabs` / `activeTab`:
  > Required to navigate, take screenshots, click, type, and extract content from the active tab in response to commands from the user's own Asgard worker.
- `storage`:
  > Stores the user's PIN locally in chrome.storage so the extension can authenticate to the user's Asgard worker.
- `alarms`:
  > Schedules the periodic polling loop that checks for pending commands.
- `host_permissions <all_urls>`:
  > Required because the user may instruct Asgard to drive any site they're signed into.

**Remote code use**: No

**Data usage** — extension does NOT collect any user data. Tick "I do not collect/transmit any of these" for all items.

**Privacy policy URL**:
> https://asgard.pgallivan.workers.dev/privacy

### Distribution tab

**Visibility**: **Unlisted** (only people with the direct URL can install — recommended for personal tools)

**Geographic regions**: All countries

### Step 4 — Submit for review

Click **Submit for review** (top-right of the form). Review takes 1–2 business days for unlisted extensions; can be hours.

After approval, you get a chromewebstore.google.com URL like `https://chromewebstore.google.com/detail/asgard-bridge/<extensionID>`. Click "Add to Chrome" on any device — zero local files. The local `H:\asgard\extension\` install becomes obsolete.

## Update PIN flow after store install

Once installed from the store, the PIN UX is identical: click extension icon → paste `6d069732989ef453` → click outside the field. Stored in chrome.storage per browser.

## If something fails review

Common reasons + fix:
- Privacy policy URL doesn't render as readable HTML → push docs/PRIVACY.md to GitHub Pages or use the dashboard /privacy route once it exists
- Permissions justifications too short → expand each to 2 sentences explaining the user benefit
- Single purpose violation flagged → emphasize "user's own private infrastructure"

If review denies, paste the rejection reason into a new Asgard chat and I'll patch it.
