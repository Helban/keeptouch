// Auth module — wraps chrome.identity.getAuthToken (MV3 OAuth2 flow)
// Token is cached by Chrome automatically; we never store it in chrome.storage.

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "openid",
  "email",
];

/**
 * Get a valid OAuth2 access token.
 * - interactive=true  → shows Google consent screen if needed (call from user gesture)
 * - interactive=false → silent refresh; throws if no cached token
 */
export async function getToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: SCOPES }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Force sign-out: revoke the token from Google and remove it from Chrome cache.
 * Call this when the user clicks "Sign out" in the popup.
 */
export async function signOut() {
  const token = await getToken(false).catch(() => null);
  if (!token) return;

  // Revoke on Google's server so the token can't be used anymore
  await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);

  // Remove from Chrome's local cache
  await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
}

/**
 * Check if the user is currently signed in (has a cached token).
 */
export async function isSignedIn() {
  try {
    await getToken(false);
    return true;
  } catch {
    return false;
  }
}
