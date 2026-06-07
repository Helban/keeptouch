// No direct chrome.* access here (cross-origin iframe restriction).

const DAYS_THRESHOLD = 30;
const DEMO_MODE = false; // set to true to show fake contacts for portfolio demos

const DEMO_CONTACTS = [
  { email: "sarah.johnson@example.com",  name: "Sarah Johnson",  lastContacted: daysAgo(312) },
  { email: "mike.chen@example.com",      name: "Mike Chen",      lastContacted: daysAgo(287) },
  { email: "anna.kowalski@example.com",  name: "Anna Kowalski",  lastContacted: daysAgo(254) },
  { email: "david.miller@example.com",   name: "David Miller",   lastContacted: daysAgo(198) },
  { email: "lisa.wang@example.com",      name: "Lisa Wang",      lastContacted: daysAgo(167) },
  { email: "tomasz.nowak@example.com",   name: "Tomasz Nowak",   lastContacted: daysAgo(143) },
  { email: "emma.brown@example.com",     name: "Emma Brown",     lastContacted: daysAgo(121) },
  { email: "carlos.garcia@example.com",  name: "Carlos Garcia",  lastContacted: daysAgo(98)  },
  { email: "julia.schmidt@example.com",  name: "Julia Schmidt",  lastContacted: daysAgo(76)  },
  { email: "james.wilson@example.com",   name: "James Wilson",   lastContacted: daysAgo(54)  },
];

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const views = {
  auth: document.getElementById("view-auth"),
  loading: document.getElementById("view-loading"),
  empty: document.getElementById("view-empty"),
  list: document.getElementById("view-list"),
};

const contactList = document.getElementById("contact-list");
const btnSignin = document.getElementById("btn-signin");
const btnRefresh = document.getElementById("btn-refresh");

const GMAIL_ORIGIN = "https://mail.google.com";

function sendToParent(type, payload, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error(`Timeout waiting for ${type}_RESPONSE`));
    }, timeoutMs);

    const handler = (event) => {
      if (event.origin !== GMAIL_ORIGIN) return;
      if (event.data?.type === `${type}_RESPONSE`) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(event.data.payload);
      }
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type, payload }, GMAIL_ORIGIN);
  });
}

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name]?.classList.remove("hidden");
}

async function init() {
  if (DEMO_MODE) {
    renderContacts(DEMO_CONTACTS);
    return;
  }

  showView("loading");
  const { signedIn } = await sendToParent("CHECK_AUTH");
  if (!signedIn) {
    showView("auth");
    return;
  }

  await loadContacts();
}

async function loadContacts() {
  if (DEMO_MODE) {
    renderContacts(DEMO_CONTACTS);
    return;
  }

  showView("loading");
  const { contacts } = await sendToParent("GET_CONTACTS");
  renderContacts(contacts ?? []);
}

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

  contactList.replaceChildren(
    ...stale.map((c) => {
      const days = c.lastContacted
        ? Math.floor((now - new Date(c.lastContacted).getTime()) / 86400000)
        : null;
      const contactLabel = c.name || c.email;

      const avatar = document.createElement("div");
      avatar.className = "contact-avatar";
      avatar.textContent = initials(contactLabel);

      const nameSpan = document.createElement("span");
      nameSpan.className = "contact-name";
      nameSpan.textContent = contactLabel;

      const emailSpan = document.createElement("span");
      emailSpan.className = "contact-email";
      emailSpan.textContent = c.email;

      const info = document.createElement("div");
      info.className = "contact-info";
      info.append(nameSpan, emailSpan);

      const compose = document.createElement("a");
      compose.className = "contact-compose";
      compose.href = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(c.email)}`;
      compose.target = "_blank";
      compose.title = "Compose";
      compose.textContent = "✉";

      const age = document.createElement("span");
      age.className = "contact-age";
      age.textContent = days !== null ? `${days}d ago` : "never";

      const li = document.createElement("li");
      li.className = "contact-item";
      li.append(avatar, info, compose, age);
      return li;
    })
  );

  showView("list");
}

btnSignin.addEventListener("click", async () => {
  showView("loading");
  await sendToParent("SIGN_IN");
  await loadContacts();
});

btnRefresh.addEventListener("click", loadContacts);

window.addEventListener("message", (event) => {
  if (event.origin !== GMAIL_ORIGIN) return;
  if (event.data?.type === "CONTACTS_UPDATED") loadContacts();
});

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

init();
