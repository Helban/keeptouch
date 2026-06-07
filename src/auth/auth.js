// Auth module — uses launchWebAuthFlow (works for unpacked/dev extensions).
// Implicit flow: Google redirects back with access_token in the URL hash.
// Token is stored in chrome.storage.session (cleared on browser close).

const CLIENT_ID = "991760563034-8rk8bsida6jppv4156u7drurng0q7u4u.apps.googleusercontent.com";
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "openid",
  "email",
].join(" ");

function buildAuthUrl() {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export async function getToken(interactive = false) {
  const cached = await chrome.storage.session.get(["token", "tokenExpiry"]);
  if (cached.token && cached.tokenExpiry > Date.now() + 60_000) {
    return cached.token;
  }

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: buildAuthUrl(), interactive },
      async (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseUrl) {
          reject(new Error("No response URL"));
          return;
        }

        // Token is in the hash fragment: #access_token=...&expires_in=3600
        const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
        const token = params.get("access_token");
        const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10);

        if (!token) {
          reject(new Error("No access token in response"));
          return;
        }

        await chrome.storage.session.set({
          token,
          tokenExpiry: Date.now() + expiresIn * 1000,
        });

        resolve(token);
      }
    );
  });
}

export async function signOut() {
  const { token } = await chrome.storage.session.get("token");
  if (token) {
    // POST required by Google's revoke endpoint (GET is silently ignored)
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(token)}`,
    }).catch(() => {}); // best-effort; clear local cache regardless
    await chrome.storage.session.remove(["token", "tokenExpiry"]);
  }
}

export async function isSignedIn() {
  try {
    await getToken(false);
    return true;
  } catch {
    return false;
  }
}
