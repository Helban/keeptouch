# Keeptouch — Chrome Extension

Gmail sidebar that shows contacts you haven't emailed recently.

## Architecture

```
manifest.json              MV3 manifest (OAuth2 scopes, CSP)
src/
  auth/auth.js             chrome.identity wrapper (getToken / signOut / isSignedIn)
  api/gmail.js             Gmail REST API calls (listMessages, getMessage, getSentContacts)
  background/service_worker.js  Alarm-based refresh; bridges content↔API
  content/inject.js        Injected into mail.google.com; inserts iframe sidebar
  content/sidebar.css      Host-page styles for the toggle button + iframe shell
  sidebar/sidebar.{html,js,css}  Iframe UI rendered inside Chrome extension origin
  popup/popup.{html,js,css}     Toolbar popup (sign in / sign out)
icons/                     16/48/128 PNG icons
```

## Auth flow

1. User clicks "Sign in" in popup (or sidebar)
2. `getToken(interactive=true)` → Chrome shows Google consent screen
3. Token cached by Chrome — subsequent calls use `getToken(false)` (silent)
4. Token is never written to `chrome.storage`; Chrome manages the cache
5. Sign-out: token revoked on Google + removed from Chrome cache

## Message bus (content ↔ service worker ↔ sidebar iframe)

```
sidebar iframe  --postMessage-->  inject.js  --chrome.runtime.sendMessage-->  service_worker
service_worker  --chrome.runtime.sendMessage-->  inject.js  --postMessage-->  sidebar iframe
```

Message types: `GET_CONTACTS`, `REFRESH_CONTACTS`, `CHECK_AUTH`, `SIGN_IN`, `CONTACTS_UPDATED`

## Setup (first time)

1. Create a Google Cloud project at console.cloud.google.com
2. Enable "Gmail API" and "People API"
3. Create OAuth 2.0 credentials → Chrome Extension → copy Client ID
4. Paste Client ID into `manifest.json` → `oauth2.client_id`
5. Add your extension ID to the authorized origins in the OAuth consent screen
6. Load unpacked from `chrome://extensions` (Developer mode on)

## Key constants

- `DAYS_THRESHOLD` in `sidebar.js` — days after which a contact appears (default 30)
- `REFRESH_INTERVAL_MINUTES` in `service_worker.js` — how often the alarm fires (default 60)
- `limit` param in `getSentContacts()` — how many sent messages to scan (default 200)
