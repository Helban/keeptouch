// Sidebar UI — runs inside the iframe, communicates via postMessage.
// No direct chrome.* access here (cross-origin iframe restriction).

const DAYS_THRESHOLD = 30; // show contacts not contacted for ≥ this many days

// ── DOM refs ────────────────────────────────────────────────────────────────

const views = {
  auth: document.getElementById("view-auth"),
  loading: document.getElementById("view-loading"),
  empty: document.getElementById("view-empty"),
  list: document.getElementById("view-list"),
};

const contactList = document.getElementById("contact-list");
const btnSignin = document.getElementById("btn-signin");
const btnRefresh = document.getElementById("btn-refresh");

// ── Message helpers (postMessage to parent content script) ──────────────────

// Responses come from the content script on mail.google.com
const GMAIL_ORIGIN = "https://mail.google.com";

function sendToParent(type, payload) {
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.origin !== GMAIL_ORIGIN) return;
      if (event.data?.type === `${type}_RESPONSE`) {
        window.removeEventListener("message", handler);
        resolve(event.data.payload);
      }
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type, payload }, GMAIL_ORIGIN);
  });
}

// ── Views ───────────────────────────────────────────────────────────────────

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name]?.classList.remove("hidden");
}

// ── Init ────────────────────────────────────────────────────────────────────

async function init() {
  showView("loading");

  const { signedIn } = await sendToParent("CHECK_AUTH");
  if (!signedIn) {
    showView("auth");
    return;
  }

  await loadContacts();
}

async function loadContacts() {
  showView("loading");
  const { contacts } = await sendToParent("GET_CONTACTS");
  renderContacts(contacts ?? []);
}

// ── Render ──────────────────────────────────────────────────────────────────

function renderContacts(contacts) {
  const now = Date.now();
  const cutoff = DAYS_THRESHOLD * 24 * 60 * 60 * 1000;

  const stale = contacts
    .filter((c) => {
      if (!c.lastContacted) return true;
      return now - new Date(c.lastContacted).getTime() >= cutoff;
    })
    .sort((a, b) => {
      // Sort oldest-first so "most neglected" is at top
      const aTime = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
      const bTime = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
      return aTime - bTime;
    });

  if (stale.length === 0) {
    showView("empty");
    return;
  }

  contactList.innerHTML = stale
    .map((c) => {
      const days = c.lastContacted
        ? Math.floor((now - new Date(c.lastContacted).getTime()) / 86400000)
        : null;
      const label = days !== null ? `${days}d ago` : "never";
      const display = c.name || c.email;
      const composeUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(c.email)}`;
      return `
        <li class="contact-item">
          <div class="contact-avatar">${initials(display)}</div>
          <div class="contact-info">
            <span class="contact-name">${escHtml(display)}</span>
            <span class="contact-email">${escHtml(c.email)}</span>
          </div>
          <a class="contact-compose" href="${composeUrl}" target="_blank" title="Compose">✉</a>
          <span class="contact-age">${label}</span>
        </li>`;
    })
    .join("");

  showView("list");
}

// ── Event listeners ──────────────────────────────────────────────────────────

btnSignin.addEventListener("click", async () => {
  showView("loading");
  await sendToParent("SIGN_IN"); // triggers getToken(true) in service worker
  await loadContacts();
});

btnRefresh.addEventListener("click", loadContacts);

// Service worker pushed an update
window.addEventListener("message", (event) => {
  if (event.data?.type === "CONTACTS_UPDATED") loadContacts();
});

// ── Utilities ────────────────────────────────────────────────────────────────

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Start ────────────────────────────────────────────────────────────────────

init();
