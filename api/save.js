import { put } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

const isVercel = process.env.VERCEL === '1';
const preferBlob = process.env.PERSIST_MODE === 'blob' || isVercel;
const FILE_PATH = isVercel
  ? path.join(process.env.TMPDIR || '/tmp', 'data.json')
  : path.join(process.cwd(), 'data.json');
const BLOB_KEY = 'hoa-state.json';

async function saveToFile(data) {
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  return { url: FILE_PATH, mode: 'file' };
}

async function saveToBlob(data) {
  const { url } = await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return { url, mode: 'blob' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data } = req.body || {};
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    const result = preferBlob ? await saveToBlob(data) : await saveToFile(data);
    res.setHeader('X-Persist-Mode', result.mode);
    return res.status(200).json({ success: true, url: result.url, mode: result.mode });
  } catch (error) {
    console.error('Primary save failed', error);
    // Fallback to file when blob fails, but only where the FS is writable.
    if (preferBlob && !isVercel) {
      try {
        const result = await saveToFile(data);
        res.setHeader('X-Persist-Mode', 'file');
        return res.status(200).json({ success: true, url: result.url, mode: 'file', fallback: true });
      } catch (fallbackErr) {
        console.error('File fallback failed', fallbackErr);
      }
    }
    return res.status(500).json({ error: 'Failed to save state' });
  }
}
