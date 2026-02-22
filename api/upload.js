import { put } from "@vercel/blob";

export const config = { runtime: "nodejs20.x" };

const sanitize = value =>
  (value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
    const folder = sanitize(searchParams.get("folder") || "uploads");
    const filename = sanitize(searchParams.get("filename") || "file");
    const contentType = req.headers["content-type"] || "application/octet-stream";
    const buffer = await readBuffer(req);
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

    const token =
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_BLOB_RW_TOKEN ||
      process.env.BLOB_WRITE_TOKEN ||
      undefined;

    const blob = await put(key, buffer, {
      access: "public",
      contentType,
      token
    });

    res
      .status(200)
      .setHeader("content-type", "application/json")
      .setHeader("cache-control", "no-store")
      .setHeader("x-blob-version", blob.etag || "")
      .send(
        JSON.stringify({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          contentType: blob.contentType,
          etag: blob.etag
        })
      );
  } catch (err) {
    console.error("upload error", err);
    res.status(err?.status || 500).send("Upload failed");
  }
}
