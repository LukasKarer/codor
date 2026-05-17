import { Router } from 'express';

const router = Router();
const TEAVM_BASE = 'https://teavm.org/playground/3';

router.use(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const filePath = req.url.replace(/^\//, '');
  if (!filePath) {
    res.status(400).json({ error: 'Missing file path' });
    return;
  }

  const url = `${TEAVM_BASE}/${filePath}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: any) {
    console.error(`Proxy error for ${url}:`, error);
    res.status(500).json({ error: 'Proxy request failed', message: error.message });
  }
});

export default router;
