// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { nanoid } = require('nanoid');
const log = require('../logging-middleware/logger');

const app = express();
app.use(bodyParser.json());

const store = {};

// Create Short URL
app.post('/shorturls', async (req, res) => {
  const { url, validity = 30, shortcode } = req.body;
  try {
    if (!url || typeof url !== 'string') {
      await log('backend', 'error', 'handler', 'Invalid URL input');
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const code = shortcode || nanoid(6);
    if (store[code]) {
      await log('backend', 'error', 'handler', 'Shortcode already exists');
      return res.status(409).json({ error: 'Shortcode already in use' });
    }

    const expiry = new Date(Date.now() + validity * 60000);
    store[code] = {
      originalUrl: url,
      expiry,
      createdAt: new Date(),
      clicks: [],
    };

    await log('backend', 'info', 'controller', `Created short URL: ${code}`);
    res.status(201).json({
      shortLink: `http://localhost:3000/${code}`,
      expiry: expiry.toISOString(),
    });
  } catch (err) {
    await log('backend', 'fatal', 'controller', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Short URL Stats
app.get('/shorturls/:code', async (req, res) => {
  const { code } = req.params;
  const data = store[code];

  if (!data) {
    await log('backend', 'warn', 'repository', `Shortcode not found: ${code}`);
    return res.status(404).json({ error: 'Shortcode not found' });
  }

  if (new Date() > data.expiry) {
    await log('backend', 'warn', 'handler', `Link expired: ${code}`);
    return res.status(410).json({ error: 'Link expired' });
  }

  data.clicks.push({
    timestamp: new Date().toISOString(),
    source: req.headers['referer'] || 'unknown',
    location: 'unknown', // Placeholder
  });

  await log('backend', 'info', 'service', `Shortcode accessed: ${code}`);

  res.json({
    originalUrl: data.originalUrl,
    createdAt: data.createdAt.toISOString(),
    expiry: data.expiry.toISOString(),
    totalClicks: data.clicks.length,
    clickDetails: data.clicks,
  });
});

// Start Server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
