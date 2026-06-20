require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhook');

const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  ws.on('error', console.error);
  
  ws.on('message', (data) => {
    // Optionally handle ping/pong or client messages
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

app.use(cors());
app.use(express.json());

// Inject wss into requests
app.use((req, res, next) => {
  req.wss = wss;
  next();
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Routes
const signalsRoutes = require('./routes/signals');
const devicesRoutes = require('./routes/devices');
const statsRoutes = require('./routes/stats');
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/stats', statsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`AzSignal Pro API & WebSocket Backend running on port ${PORT}`);
});
