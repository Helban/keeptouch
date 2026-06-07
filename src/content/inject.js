(function () {
  "use strict";

  // Prevent double-injection (Gmail is a SPA, script may run multiple times)
  if (document.getElementById("keeptouch-root")) return;

  const toggleBtn = document.createElement("div");
  toggleBtn.id = "keeptouch-toggle";
  toggleBtn.title = "Keeptouch";
  toggleBtn.textContent = "KT";

  const frame = document.createElement("iframe");
  frame.id = "keeptouch-frame";
  frame.src = chrome.runtime.getURL("src/sidebar/sidebar.html");
  frame.setAttribute("frameborder", "0");

  const container = document.createElement("div");
  container.id = "keeptouch-root";
  container.append(toggleBtn, frame);
  document.body.appendChild(container);

  let open = false;
  toggleBtn.addEventListener("click", () => {
    open = !open;
    container.classList.toggle("keeptouch-open", open);
  });

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

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CONTACTS_UPDATED") {
      frame.contentWindow?.postMessage({ type: "CONTACTS_UPDATED" }, EXTENSION_ORIGIN);
    }
  });
})();
