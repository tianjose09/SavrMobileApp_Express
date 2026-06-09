process.env.TZ = 'UTC';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tell ngrok to skip its browser interstitial page for all responses
app.use((_req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.use('/storage', express.static(path.join(__dirname, '../public')));

app.use('/api', apiRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler — catches any unhandled async throws so Express always returns JSON
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err.message);
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

const PORT = process.env.APP_PORT || process.env.PORT || 8000;
const HOST = process.env.APP_HOST || '::';
app.listen(PORT, HOST, () => {
  console.log(`SAVR API running on http://localhost:${PORT}`);
});

module.exports = app;
