import { getToken, signOut, isSignedIn } from "../auth/auth.js";

const statusEl = document.getElementById("status");
const btnAction = document.getElementById("btn-action");

async function render() {
  const ok = await isSignedIn();
  if (ok) {
    statusEl.textContent = "Signed in";
    btnAction.textContent = "Sign out";
    btnAction.onclick = async () => {
      await signOut();
      render();
    };
  } else {
    statusEl.textContent = "Not signed in";
    btnAction.textContent = "Sign in";
    btnAction.onclick = async () => {
      try {
        await getToken(true); // interactive = shows consent screen
        render();
      } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
      }
    };
  }
}

render();
