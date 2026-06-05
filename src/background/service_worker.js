// Service worker (MV3) — handles alarms and message routing.
// Lives in background; cannot access the DOM.

import { isSignedIn, getToken } from "../auth/auth.js";
import { getSentContacts } from "../api/gmail.js";

const ALARM_NAME = "refresh-contacts";
const REFRESH_INTERVAL_MINUTES = 60;

// ── Alarm: periodic refresh ────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshContacts();
});

// Register the alarm once on install / browser start
chrome.runtime.onInstalled.addListener(scheduleAlarm);
chrome.runtime.onStartup.addListener(scheduleAlarm);

async function scheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_INTERVAL_MINUTES });
}

// ── Message routing (content script ↔ service worker) ─────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "GET_CONTACTS":
      handleGetContacts(sendResponse);
      return true; // keep channel open for async response

    case "REFRESH_CONTACTS":
      refreshContacts().then(() => sendResponse({ ok: true }));
      return true;

    case "CHECK_AUTH":
      isSignedIn().then((ok) => sendResponse({ signedIn: ok }));
      return true;

    case "SIGN_IN":
      getToken(true)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
  }
});

// ── Business logic ─────────────────────────────────────────────────────────

async function refreshContacts(alreadyVerified = false) {
  if (!alreadyVerified && !(await isSignedIn())) return;

  try {
    const contacts = await getSentContacts(200);
    const serializable = Array.from(contacts.entries()).map(([email, data]) => ({
      email,
      name: data.name,
      lastContacted: data.lastContacted?.toISOString() ?? null,
    }));
    await chrome.storage.local.set({ contacts: serializable, lastRefresh: Date.now() });
    chrome.runtime.sendMessage({ type: "CONTACTS_UPDATED" }).catch(() => {
      // Content script might not be open; ignore.
    });
  } catch (err) {
    console.error("[Keeptouch] refreshContacts failed:", err);
  }
}

async function handleGetContacts(sendResponse) {
  try {
    const { contacts, lastRefresh } = await chrome.storage.local.get(["contacts", "lastRefresh"]);
    const stale = !lastRefresh || Date.now() - lastRefresh > REFRESH_INTERVAL_MINUTES * 60 * 1000 || !contacts?.length;
    const signedIn = await isSignedIn();

    if (stale && signedIn) {
      await refreshContacts(/* already verified signed in */ true);
      const updated = await chrome.storage.local.get("contacts");
      sendResponse({ contacts: updated.contacts ?? [] });
    } else {
      sendResponse({ contacts: contacts ?? [] });
    }
  } catch (err) {
    console.error("[Keeptouch] handleGetContacts failed:", err);
    sendResponse({ contacts: [] });
  }
}
