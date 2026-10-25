// Settings that come from the environment the site is built in (README: "Turning on accounts", "Counting visits").

/** Where the site lives, with a trailing slash: canonical links, link previews, the feed and the sitemap */
export const SITE = (process.env.SITE_URL || "https://the-bookshelf.pages.dev").replace(/\/?$/, "/");

export interface AccountsConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
  /** "localhost" or "127.0.0.1": sign in to Firebase's local emulators instead */
  emulator?: string;
}

// Accounts, if they are turned on: the web app's Firebase configuration as JSON, set as FIREBASE_CONFIG. These values
// are not secrets: every Firebase web app sends them to the browser, and firebase/firestore.rules decides what each
// signed-in reader may do. Without it there are no accounts and the site says nothing about them.
function accountsConfig(): AccountsConfig | null {
  const raw = (process.env.FIREBASE_CONFIG || "").trim();
  if (!raw) return null;
  let given: Record<string, unknown>;
  try {
    given = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("FIREBASE_CONFIG is not JSON: copy the firebaseConfig object from the Firebase console, keys in quotes");
  }
  const keep = Object.fromEntries(
    (["apiKey", "authDomain", "projectId", "appId", "emulator"] as const).filter((k) => given[k]).map((k) => [k, String(given[k])]),
  ) as Partial<AccountsConfig>;
  const missing = (["apiKey", "authDomain", "projectId"] as const).filter((k) => !keep[k]);
  if (missing.length) throw new Error(`FIREBASE_CONFIG is missing ${missing.join(", ")}`);
  return keep as AccountsConfig;
}

export const ACCOUNTS = accountsConfig();

// Counting visits, if it is turned on: a GoatCounter site code (the "bookshelf" in bookshelf.goatcounter.com). No code,
// nothing is counted. GoatCounter uses no cookies and keeps no personal data.
const goatcounter = (process.env.GOATCOUNTER || "").trim();
export const GOATCOUNTER = /^[a-z0-9-]+$/.test(goatcounter) ? goatcounter : "";
