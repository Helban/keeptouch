// Service worker (MV3) — handles alarms and message routing.
// Lives in background; cannot access the DOM.

import { isSignedIn, getToken } from "../auth/auth.js";
import { getSentContacts } from "../api/gmail.js";

const ALARM_NAME = "refresh-contacts";
const REFRESH_INTERVAL_MINUTES = 60;

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshContacts();
});

chrome.runtime.onInstalled.addListener(scheduleAlarm);
chrome.runtime.onStartup.addListener(scheduleAlarm);

async function scheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_INTERVAL_MINUTES });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "GET_CONTACTS":
      handleGetContacts(sendResponse);
      return true; // keep channel open for async response

    case "REFRESH_CONTACTS":
      (async () => {
        await refreshContacts();
        sendResponse({ ok: true });
      })();
      return true;

    case "CHECK_AUTH":
      (async () => {
        const signedIn = await isSignedIn();
        sendResponse({ signedIn });
      })();
      return true;

    case "SIGN_IN":
      (async () => {
        try {
          await getToken(true);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
  }
});

async function refreshContacts() {
  if (!(await isSignedIn())) return;
  try {
    await _fetchAndStoreContacts();
  } catch (err) {
    console.error("[Keeptouch] refreshContacts failed:", err);
  }
}

async function _fetchAndStoreContacts() {
  const contacts = await getSentContacts(200);
  const serializable = Array.from(contacts.entries()).map(([email, contact]) => ({
    email,
    name: contact.name,
    lastContacted: contact.lastContacted?.toISOString() ?? null,
  }));
  await chrome.storage.local.set({ contacts: serializable, lastRefresh: Date.now() });
  chrome.runtime.sendMessage({ type: "CONTACTS_UPDATED" }).catch(() => {
    // Content script might not be open; ignore.
  });
  return serializable;
}

async function handleGetContacts(sendResponse) {
  try {
    const { contacts, lastRefresh } = await chrome.storage.local.get(["contacts", "lastRefresh"]);
    const stale = !lastRefresh || Date.now() - lastRefresh > REFRESH_INTERVAL_MINUTES * 60 * 1000 || !contacts?.length;
    const signedIn = await isSignedIn();

    if (stale && signedIn) {
      const fresh = await _fetchAndStoreContacts();
      sendResponse({ contacts: fresh });
    } else {
      sendResponse({ contacts: contacts ?? [] });
    }
  } catch (err) {
    console.error("[Keeptouch] handleGetContacts failed:", err);
    sendResponse({ contacts: [] });
  }
}
