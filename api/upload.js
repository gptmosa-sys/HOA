import { put } from "@vercel/blob";

export const config = { runtime: "edge" };

const sanitize = value =>
  (value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const folder = sanitize(searchParams.get("folder") || "uploads");
    const filename = sanitize(searchParams.get("filename") || "file");
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const buffer = await req.arrayBuffer();
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

    return new Response(
      JSON.stringify({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        contentType: blob.contentType,
        etag: blob.etag
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-blob-version": blob.etag || ""
        }
      }
    );
  } catch (err) {
    console.error("upload error", err);
    return new Response("Upload failed", { status: err?.status || 500 });
  }
}
