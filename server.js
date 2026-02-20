require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { Redis } = require('@upstash/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Storage Adapter Strategy (Only for stats now)
let redis;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(redisUrl && redisToken);

if (USE_REDIS) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

// Local stats fallback
let localStats = { success: 0, fail: 0, events: [] };

// Maintenance State (Manual)
let isMaintenance = false;
const MAINTENANCE_CODE = process.env.MAINTENANCE_CODE || "thientandepzai";

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Health Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mode: USE_REDIS ? 'redis' : 'local',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API: Record Stats Event (Frontend reports after verification finishes)
app.post('/api/stats/record', async (req, res) => {
  const { success } = req.body;
  const status = success ? 1 : 0;
  const timestamp = Date.now();

  if (USE_REDIS) {
    try {
      await redis.hincrby('stats_summary', success ? 'success' : 'fail', 1);
      await redis.zadd('stats_events', { score: timestamp, member: `${timestamp}:${status}` });
      // Keep only last 100 events to save memory/space
      await redis.zremrangebyrank('stats_events', 0, -101);
    } catch (e) {
      console.error('Redis Record Error:', e);
    }
  } else {
    localStats[success ? 'success' : 'fail']++;
    localStats.events.push(status);
    if (localStats.events.length > 100) localStats.events.shift();
  }
  res.json({ success: true });
});

// API: Maintenance Status
app.get('/api/maintenance/status', (req, res) => {
  res.json({ isMaintenance });
});

// API: Toggle Maintenance (Manual Control)
app.post('/api/maintenance/toggle', (req, res) => {
  const { code, status } = req.body;
  if (code === MAINTENANCE_CODE) {
    isMaintenance = status;
    console.log(`[Maintenance] Manual override: ${isMaintenance ? 'ON' : 'OFF'}`);
    return res.json({ success: true, isMaintenance });
  }
  res.status(403).json({ success: false, message: 'Invalid Admin Code' });
});

// API: Get Recent Stats
app.get('/api/stats/recent', async (req, res) => {
  if (USE_REDIS) {
    try {
      const summary = await redis.hgetall('stats_summary') || { success: 0, fail: 0 };
      const rawEvents = await redis.zrange('stats_events', 0, -1, { byScore: false });
      const events = rawEvents.map(m => parseInt(m.split(':')[1]));

      res.json({
        success: parseInt(summary.success || 0),
        fail: parseInt(summary.fail || 0),
        events: events
      });
    } catch (e) {
      console.error('Redis Fetch Stats Error:', e);
      res.json({ success: 0, fail: 0, events: [] });
    }
  } else {
    res.json(localStats);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Storage: ${USE_REDIS ? 'Redis (Upstash)' : 'Local Memory'}`);
});
