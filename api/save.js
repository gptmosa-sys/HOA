import { put } from "@vercel/blob";

export const config = { runtime: "nodejs20.x" };

const BLOB_PATH = "hoa-state.json";

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(text || "{}");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { data } = await readJson(req);
    if (!data || typeof data !== "object") {
      res.status(400).send("Invalid payload");
      return;
    }

    const ifMatch = req.headers["if-match"] || undefined;
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

    res
      .status(200)
      .setHeader("content-type", "application/json")
      .setHeader("cache-control", "no-store")
      .setHeader("x-persist-mode", "blob")
      .setHeader("x-blob-version", upload.etag || "")
      .send(JSON.stringify({ ok: true }));
  } catch (err) {
    const status = err?.status || 500;
    console.error("save error", err);
    res.status(status).send("Save failed");
  }
}
