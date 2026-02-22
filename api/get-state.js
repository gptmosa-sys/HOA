import { get, list } from "@vercel/blob";

export const config = { runtime: "nodejs" };

const BLOB_PATH = "hoa-state.json";

const emptyState = {
  users: [],
  dues: [],
  projects: [],
  documents: [],
  meetings: [],
  minutes: [],
  ideas: [],
  votes: [],
  financials: [],
  residentDocuments: [],
  duesAmounts: [],
  balanceOverrides: [],
  actionLog: [],
  timestamp: null
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const existing = blobs.find(b => b.pathname === BLOB_PATH);

    if (!existing) {
      res
        .status(200)
        .setHeader("content-type", "application/json")
        .setHeader("cache-control", "no-store")
        .setHeader("x-persist-mode", "blob")
        .setHeader("x-blob-version", "")
        .send(JSON.stringify(emptyState));
      return;
    }

    const { body, contentType } = await get(existing.url);
    const text = await new Response(body).text();

    res
      .status(200)
      .setHeader("content-type", contentType || "application/json")
      .setHeader("cache-control", "no-store")
      .setHeader("x-persist-mode", "blob")
      .setHeader("x-blob-version", existing.etag || "")
      .send(text);
  } catch (err) {
    console.error("get-state error", err);
    res.status(err?.status || 500).send("Failed to load state");
  }
}
