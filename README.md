# Keeptouch

> Gmail sidebar showing people you haven't emailed in a while.

![Keeptouch demo](assets/demo.gif)

## Features

- Sidebar slides in from the right inside Gmail
- Scans your Sent folder and shows contacts silent for 30+ days
- One-click compose to any contact
- Hourly background refresh via Chrome Alarms API
- OAuth2 via `chrome.identity`, no backend needed

## Quick start (demo mode)

To see the UI without connecting your Gmail account:

1. Clone the repo
2. Open `src/sidebar/sidebar.js` and set `DEMO_MODE = true`
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the `keeptouch/` folder
4. Open Gmail and click the **KT** button on the right edge

You'll see a list of fake contacts. No Google account or API key needed.

## Full setup (real Gmail data)

> You'll need a Google account and about 30 minutes if this is your first time creating a Google Cloud project.

### Step 1: Clone and load the extension

```bash
git clone https://github.com/Helban/keeptouch.git
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the `keeptouch/` folder. Note the Extension ID shown below the extension name (32-character string).

### Step 2: Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project
2. Enable **Gmail API** under APIs & Services
3. Configure the OAuth consent screen:
   - User type: **External**
   - Add your Gmail address as a **Test user**
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
4. Create credentials (Credentials, Create, OAuth 2.0 Client ID):
   - Application type: **Chrome Extension**
   - Item ID: paste your Extension ID from Step 1
   - Copy the generated **Client ID**

### Step 3: Add your Client ID

Open `src/auth/auth.js` and replace the `CLIENT_ID` constant:

```js
const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
```

Reload the extension in `chrome://extensions` (click the refresh icon), open Gmail, and sign in via the extension popup.

> The first time Google shows an "unverified app" warning. Click Advanced, then Proceed. This appears because the app is not published to the Chrome Web Store.

## Configuration

| Constant | File | Default | Effect |
|---|---|---|---|
| `DAYS_THRESHOLD` | `sidebar.js` | 30 | Days of silence before showing a contact |
| `REFRESH_INTERVAL_MINUTES` | `service_worker.js` | 60 | How often to re-scan Sent |
| `limit` | `gmail.js` getSentContacts | 200 | How many sent messages to scan |

## Architecture

```
Chrome Identity API (OAuth2)
        │
        ▼
service_worker.js  ──alarm──►  gmail.js  ──►  chrome.storage.local
        │
   chrome.runtime.sendMessage
        │
        ▼
inject.js (content script on mail.google.com)
        │
   postMessage (cross-origin iframe)
        │
        ▼
sidebar.html / sidebar.js  (rendered in extension origin)
```

## Security

The extension only reads email addresses and send dates from your Sent folder. It calls the Gmail API with `format=metadata` and never fetches message bodies, subjects, or attachments.

OAuth2 tokens stay inside `chrome.identity` and are never written to `chrome.storage`. Chrome handles caching and silent refresh.

The sidebar runs in a `chrome-extension://` iframe inside Gmail. Every `postMessage` call checks the sender origin explicitly: `chrome.runtime.getURL("")` on the extension side, `https://mail.google.com` on the Gmail side. The Gmail page cannot inject or intercept messages.

No data leaves the machine. The extension stores contacts in `chrome.storage.local`, isolated to this extension's origin.

## Permissions

| Permission | Reason |
|---|---|
| `identity` | OAuth2 token via `chrome.identity` |
| `storage` | Cache contacts locally |
| `alarms` | Hourly background refresh |
| `https://mail.google.com/*` | Inject sidebar into Gmail |
| `https://www.googleapis.com/*` | Call Gmail REST API |
| `gmail.readonly` | Read sent messages (no write) |
| `contacts.readonly` | Optional: enrich names from Google Contacts |
