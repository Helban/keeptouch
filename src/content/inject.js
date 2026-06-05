// Content script — runs on mail.google.com.
// Injects the sidebar iframe into Gmail's DOM and wires up communication.

(function () {
  "use strict";

  // Prevent double-injection (Gmail is a SPA, script may run multiple times)
  if (document.getElementById("keeptouch-root")) return;

  // ── Sidebar container ──────────────────────────────────────────────────

  const container = document.createElement("div");
  container.id = "keeptouch-root";
  container.innerHTML = `
    <div id="keeptouch-toggle" title="Keeptouch">KT</div>
    <iframe
      id="keeptouch-frame"
      src="${chrome.runtime.getURL("src/sidebar/sidebar.html")}"
      frameborder="0"
    ></iframe>
  `;
  document.body.appendChild(container);

  // ── Toggle open/close ──────────────────────────────────────────────────

  const toggle = document.getElementById("keeptouch-toggle");
  const frame = document.getElementById("keeptouch-frame");
  let open = false;

  toggle.addEventListener("click", () => {
    open = !open;
    container.classList.toggle("keeptouch-open", open);
  });

  // ── Relay messages from iframe to service worker ───────────────────────

  const EXTENSION_ORIGIN = chrome.runtime.getURL("").slice(0, -1); // "chrome-extension://<id>"

  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.origin !== EXTENSION_ORIGIN) return;

    const { type, payload } = event.data ?? {};
    if (!type) return;

    chrome.runtime.sendMessage({ type, payload }, (response) => {
      frame.contentWindow.postMessage({ type: `${type}_RESPONSE`, payload: response }, EXTENSION_ORIGIN);
    });
  });

  // ── Push updates from service worker into the iframe ──────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CONTACTS_UPDATED") {
      frame.contentWindow?.postMessage({ type: "CONTACTS_UPDATED" }, EXTENSION_ORIGIN);
    }
  });
})();
