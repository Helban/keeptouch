// Gmail API wrapper — thin layer over fetch, always attaches Bearer token.
// We only use gmail.readonly scope, so no write operations here.

import { getToken } from "../auth/auth.js";

const BASE = "https://www.googleapis.com/gmail/v1/users/me";

async function apiFetch(path, params = {}) {
  const token = await getToken(false);
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Gmail API ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * List message IDs matching a query (same syntax as Gmail search box).
 * Returns up to `maxResults` IDs (default 100).
 */
export async function listMessages(query, maxResults = 100) {
  const data = await apiFetch("/messages", { q: query, maxResults });
  return data.messages ?? [];
}

/**
 * Fetch a single message with only the headers we need (cheap "metadata" format).
 * Returns { id, from, to, date, subject }.
 */
export async function getMessage(id) {
  const token = await getToken(false);
  const url = new URL(`${BASE}/messages/${id}`);
  url.searchParams.set("format", "metadata");
  // Gmail API requires metadataHeaders as repeated params, not comma-separated
  ["From", "To", "Date", "Subject"].forEach((h) =>
    url.searchParams.append("metadataHeaders", h)
  );

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API /messages/${id} → ${res.status}`);
  const data = await res.json();

  const headers = {};
  for (const h of data.payload?.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  return {
    id: data.id,
    from: headers.from ?? "",
    to: headers.to ?? "",
    date: headers.date ? new Date(headers.date) : null,
    subject: headers.subject ?? "",
  };
}

/**
 * Return all unique email addresses the authenticated user has SENT TO,
 * looking back at up to `limit` sent messages.
 *
 * Result: Map<email, { name, lastContacted: Date }>
 */
export async function getSentContacts(limit = 200) {
  const ids = await listMessages("in:sent", limit);
  const contacts = new Map();

  // Fetch messages in parallel batches of 20 to avoid rate-limit bursts
  const BATCH = 20;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const messages = await Promise.all(batch.map((m) => getMessage(m.id)));

    for (const msg of messages) {
      // "To" can be "Name <email>, Name2 <email2>" — split on comma
      const recipients = parseAddresses(msg.to);
      for (const { email, name } of recipients) {
        const existing = contacts.get(email);
        if (!existing || msg.date > existing.lastContacted) {
          contacts.set(email, { name, lastContacted: msg.date });
        }
      }
    }
  }

  return contacts;
}

// Parse "Name <email>, bare@email.com" → [{ name, email }]
function parseAddresses(header) {
  if (!header) return [];
  return header.split(",").flatMap((part) => {
    part = part.trim();
    const match = part.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) return [{ name: match[1].trim(), email: match[2].trim().toLowerCase() }];
    if (part.includes("@")) return [{ name: "", email: part.toLowerCase() }];
    return [];
  });
}
