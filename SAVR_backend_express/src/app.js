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

const PORT = process.env.APP_PORT || 8000;
// '::' creates a dual-stack socket — accepts both IPv4 and IPv6.
// Required on Windows because ngrok dials localhost as [::1] (IPv6).
const HOST = process.env.APP_HOST || '::';
app.listen(PORT, HOST, () => {
  console.log(`SAVR API running on http://localhost:${PORT}`);
});

module.exports = app;
