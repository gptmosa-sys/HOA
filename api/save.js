import { put } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

// Default to local file writes unless explicitly forced to blob
const useFile = process.env.PERSIST_MODE !== 'blob';
const FILE_PATH = path.join(process.cwd(), 'data.json');
const BLOB_KEY = 'hoa-state.json';

async function saveToFile(data) {
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  return { url: FILE_PATH };
}

async function saveToBlob(data) {
  const { url } = await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return { url };
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
    const result = useFile ? await saveToFile(data) : await saveToBlob(data);
    res.setHeader('X-Persist-Mode', useFile ? 'file' : 'blob');
    return res.status(200).json({ success: true, url: result.url, mode: useFile ? 'file' : 'blob' });
  } catch (error) {
    console.error(error);
    // If blob save fails, fall back to local file
    if (!useFile) {
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
