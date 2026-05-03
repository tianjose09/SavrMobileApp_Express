require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/storage', express.static(path.join(__dirname, '../public')));

app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

const PORT = process.env.APP_PORT || 8000;
app.listen(PORT, () => {
  console.log(`SAVR API running on http://localhost:${PORT}`);
});

module.exports = app;
