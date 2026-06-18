require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhook');

const app = express();

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AzSignal Pro API Backend running on port ${PORT}`);
});
