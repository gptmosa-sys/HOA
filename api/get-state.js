import { get } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

// Default to local file reads unless explicitly forced to blob
const useFile = process.env.PERSIST_MODE !== 'blob';
const FILE_PATH = path.join(process.cwd(), 'data.json');
const BLOB_KEY = 'hoa-state.json';

async function readFromFile() {
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function readFromBlob() {
  const { url } = await get(BLOB_KEY, {
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  const blobRes = await fetch(url);
  if (!blobRes.ok) throw new Error('Blob fetch failed');
  return await blobRes.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = useFile ? await readFromFile() : await readFromBlob();
    res.setHeader('X-Persist-Mode', useFile ? 'file' : 'blob');
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    // Fallback: if blob fails, attempt local file
    if (!useFile) {
      try {
        const data = await readFromFile();
        res.setHeader('X-Persist-Mode', 'file');
        return res.status(200).json(data);
      } catch (fallbackErr) {
        console.error('File fallback failed', fallbackErr);
      }
    }
    return res.status(404).json({ error: 'No state found' });
  }
}
