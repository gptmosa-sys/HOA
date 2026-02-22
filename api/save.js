import { put } from "@vercel/blob";

export const config = { runtime: "edge" };

const BLOB_PATH = "hoa-state.json";

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { data } = await req.json();
    if (!data || typeof data !== "object") {
      return new Response("Invalid payload", { status: 400 });
    }

    const ifMatch = req.headers.get("if-match") || undefined;
    const token =
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_BLOB_RW_TOKEN ||
      process.env.BLOB_WRITE_TOKEN ||
      undefined;

    const upload = await put(BLOB_PATH, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      ifMatch,
      token
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-persist-mode": "blob",
        "x-blob-version": upload.etag || ""
      }
    });
  } catch (err) {
    const status = err?.status || 500;
    console.error("save error", err);
    return new Response("Save failed", { status });
  }
}
