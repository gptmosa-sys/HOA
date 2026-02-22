import { put } from '@vercel/blob';
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
  console.log('[storage/save]', ...args);
}

async function saveToFile(data) {
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  return { url: FILE_PATH, mode: 'file' };
}

async function saveToBlob(data) {
  console.log('save.js: Attempting Blob put for key=' + BLOB_KEY);
  console.log('save.js: VERCEL=' + process.env.VERCEL);
  console.log('save.js: PERSIST_MODE=' + process.env.PERSIST_MODE);
  console.log('save.js: BLOB_READ_WRITE_TOKEN exists? ' + !!process.env.BLOB_READ_WRITE_TOKEN);
  console.log('save.js: Token length: ' + (process.env.BLOB_READ_WRITE_TOKEN ? process.env.BLOB_READ_WRITE_TOKEN.length : 'missing'));
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
    logDebug('attempt', preferBlob ? 'blob' : 'file', {
      isVercel,
      hasBlobToken,
      filePath: FILE_PATH,
      blobKey: BLOB_KEY
    });
    const result = preferBlob ? await saveToBlob(data) : await saveToFile(data);
    res.setHeader('X-Persist-Mode', result.mode);
    logDebug('success', result.mode, { url: result.url });
    return res.status(200).json({ success: true, url: result.url, mode: result.mode });
  } catch (error) {
    console.error('Primary save failed', error);
    // Fallback to file; works locally and in Vercel (/tmp).
    if (preferBlob) {
      try {
        const result = await saveToFile(data);
        res.setHeader('X-Persist-Mode', 'file');
        logDebug('fallback-file-success', { url: result.url });
        return res.status(200).json({ success: true, url: result.url, mode: 'file', fallback: true });
      } catch (fallbackErr) {
        console.error('File fallback failed', fallbackErr);
      }
    }
    return res.status(500).json({
      error: 'Failed to save state',
      detail: error?.message || 'unknown',
      tried: preferBlob ? 'blob' : 'file',
      filePath: FILE_PATH,
      blobKey: BLOB_KEY
    });
  }
}
