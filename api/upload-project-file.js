import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_FILE_UPLOAD || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Blob token not configured' });
  }

  const fileNameHeader = req.headers['x-file-name'];
  const safeName = fileNameHeader ? decodeURIComponent(fileNameHeader) : 'upload.bin';
  const contentType = req.headers['content-type'] || 'application/octet-stream';

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // 15 MB per category limit is enforced client-side; server-side hard cap to be safe (20MB)
    const HARD_CAP = 20 * 1024 * 1024;
    if (buffer.length > HARD_CAP) {
      return res.status(413).json({ error: 'File too large' });
    }

    const key = `projects/${Date.now()}-${safeName}`;
    const { url, pathname } = await put(key, buffer, {
      access: 'public',
      token,
      contentType
    });

    return res.status(200).json({ url, pathname, size: buffer.length, contentType });
  } catch (error) {
    console.error('Upload failed', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
