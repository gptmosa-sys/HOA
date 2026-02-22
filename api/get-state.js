import { get, list } from "@vercel/blob";

export const config = { runtime: "edge" };

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

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const existing = blobs.find(b => b.pathname === BLOB_PATH);

    if (!existing) {
      return new Response(JSON.stringify(emptyState), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-persist-mode": "blob",
          "x-blob-version": ""
        }
      });
    }

    const { body, contentType } = await get(existing.url);
    const text = await new Response(body).text();

    return new Response(text, {
      status: 200,
      headers: {
        "content-type": contentType || "application/json",
        "cache-control": "no-store",
        "x-persist-mode": "blob",
        "x-blob-version": existing.etag || ""
      }
    });
  } catch (err) {
    console.error("get-state error", err);
    return new Response("Failed to load state", { status: 500 });
  }
}
