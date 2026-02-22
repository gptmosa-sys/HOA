import { get } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

const isVercel = process.env.VERCEL === '1';
const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
const preferBlob = process.env.PERSIST_MODE === 'blob' || (isVercel && hasBlobToken);
const FILE_PATH = isVercel
  ? path.join(process.env.TMPDIR || '/tmp', 'data.json')
  : path.join(process.cwd(), 'data.json');
const BLOB_KEY = 'hoa-state.json';

function logDebug(...args) {
  console.log('[storage/get]', ...args);
}

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
    logDebug('attempt', preferBlob ? 'blob' : 'file', {
      isVercel,
      hasBlobToken,
      filePath: FILE_PATH,
      blobKey: BLOB_KEY
    });
    const data = preferBlob ? await readFromBlob() : await readFromFile();
    res.setHeader('X-Persist-Mode', preferBlob ? 'blob' : 'file');
    logDebug('success', preferBlob ? 'blob' : 'file');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Primary load failed', error);
    // Fallback to file; works locally and in Vercel (/tmp).
    if (preferBlob) {
      try {
        const data = await readFromFile();
        res.setHeader('X-Persist-Mode', 'file');
        logDebug('fallback-file-success');
        return res.status(200).json(data);
      } catch (fallbackErr) {
        console.error('File fallback failed', fallbackErr);
      }
    }
    return res.status(404).json({
      error: 'No state found',
      detail: error?.message || 'unknown',
      tried: preferBlob ? 'blob' : 'file',
      filePath: FILE_PATH,
      blobKey: BLOB_KEY
    });
  }
}
