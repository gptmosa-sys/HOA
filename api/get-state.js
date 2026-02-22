import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
    }

  const key = 'hoa-state.json';

  try {
    const { blobs } = await list({ prefix: key, token: process.env.BLOB_READ_WRITE_TOKEN });
    const blob = blobs.find(b => b.pathname === key);
    if (!blob) throw new Error('Blob not found');

    // Force bypass of any CDN caching so newest blob data is always returned.
    const blobRes = await fetch(blob.url + `?nocache=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!blobRes.ok) throw new Error('Blob fetch failed');

    const data = await blobRes.json();

    // Prevent downstream caching of the API response as well.
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(404).json({ error: 'No state found in Blob' });
  }
}
