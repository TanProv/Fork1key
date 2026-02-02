require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { Mutex } = require('async-mutex');
const { Redis } = require('@upstash/redis');

const keysMutex = new Mutex(); // Global lock for keys operations

const app = express();
const PORT = process.env.PORT || 3000;
const KEYS_FILE = path.join(__dirname, 'keys.json');
const MASTER_KEY = process.env.MASTER_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

// Storage Adapter Strategy
let storage;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!redisUrl && !!redisToken;

if (USE_REDIS) {
  console.log('☁️ Storage Mode: Redis (Upstash)');
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  storage = {
    load: async () => {
      try {
        const data = await redis.get('keys');
        return data || {};
      } catch (e) {
        console.error('Redis Load Error:', e);
        return {};
      }
    },
    save: async (keys) => {
      try {
        await redis.set('keys', keys);
      } catch (e) {
        console.error('Redis Save Error:', e);
      }
    }
  };
} else {
  console.log('📂 Storage Mode: Local File (keys.json)');
  // Ensure file exists (only works in writable environments)
  try {
    if (!fs.existsSync(KEYS_FILE)) {
      fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: {} }, null, 2));
    }
  } catch (e) {
    console.warn('⚠️ Cannot write keys.json (read-only filesystem). Redis is required for Vercel.');
  }

  storage = {
    load: async () => {
      try {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data).keys || {};
      } catch (e) {
        return {};
      }
    },
    save: async (keys) => {
      const tempFile = `${KEYS_FILE}.tmp`;
      try {
        fs.writeFileSync(tempFile, JSON.stringify({ keys }, null, 2));
        fs.renameSync(tempFile, KEYS_FILE);
      } catch (e) {
        console.error('File Save Error:', e);
      }
    }
  };
}

// Generate CSRF token (fixed for Vercel serverless)
const CSRF_TOKEN = process.env.CSRF_TOKEN || 'vercel-csrf-token-' + (process.env.VERCEL_GIT_COMMIT_SHA || 'local');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Security: Rate Limiting (Vercel-compatible)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable validation for Vercel compatibility
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.ip || 'unknown';
  },
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use(limiter);

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.ip || 'unknown';
  },
  message: { error: 'Too many admin attempts, please try again later.' }
});
app.use('/admin/', adminLimiter);

// CSRF validation middleware
const validateCsrf = (req, res, next) => {
  const token = req.headers['x-csrf-token'];
  if (token !== CSRF_TOKEN) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
};

// Inject CSRF token into HTML
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal Server Error');
    }
    const html = data.replace(
      '</head>',
      `<script>window.CSRF_TOKEN = "${CSRF_TOKEN}";</script>\n</head>`
    );
    res.send(html);
  });
});

// API Routes

// System Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '0.7.0',
    mode: USE_REDIS ? 'redis' : 'filesystem',
    proxy_active: true,
    timestamp: new Date().toISOString()
  });
});

// Helper: Generate Complex Random String
const generateComplexKey = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789^.@-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Admin: Generate Key
app.post('/admin/generate-key', async (req, res) => {
  const { secret, quota, prefix } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  // Lock for safety
  await keysMutex.runExclusive(async () => {
    const keys = await storage.load();
    const keyPrefix = prefix || 'cdk';
    const newKey = keyPrefix + '_' + generateComplexKey(32);

    keys[newKey] = {
      quota: quota || 1000,
      used: 0,
      active: true,
      created_at: new Date().toISOString()
    };
    await storage.save(keys);
    res.json({ key: newKey, quota: keys[newKey].quota });
  });
});

// Admin: Delete Key
app.delete('/admin/delete-key', async (req, res) => {
  const { secret, key } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!key) return res.status(400).json({ error: 'Key is required' });

  await keysMutex.runExclusive(async () => {
    const keys = await storage.load();
    if (keys[key]) {
      delete keys[key];
      await storage.save(keys);
      res.json({ success: true, message: 'Key deleted' });
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  });
});

// Admin: List Keys
app.get('/admin/keys', async (req, res) => {
  const { secret } = req.query;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const keys = await storage.load();
  res.json({ keys });
});

// Batch Verification (Proxy)
app.post('/api/batch', validateCsrf, async (req, res) => {
  const { hCaptchaToken, verificationIds } = req.body;

  if (!hCaptchaToken || !verificationIds || !Array.isArray(verificationIds)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // 1. Validate Local Key
  // Note: We load keys just to check, separate from quota deduction to be fast
  let keys = await storage.load();
  let keyData = keys[hCaptchaToken];

  if (!keyData || !keyData.active) {
    return res.status(403).json({ error: 'Invalid or inactive API Key' });
  }

  if (keyData.used + verificationIds.length > keyData.quota) {
    return res.status(402).json({ error: 'Quota exceeded for this API Key' });
  }

  // 2. Prepare Proxy Request
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    console.log(`Forwarding request for key ${hCaptchaToken} to upstream...`);

    const response = await axios({
      method: 'post',
      url: 'https://neigui.1key.me/api/batch',
      data: {
        hCaptchaToken: MASTER_KEY || 'no-master-key-set',
        verificationIds: verificationIds,
      },
      responseType: 'stream',
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://neigui.1key.me/',
        'Origin': 'https://neigui.1key.me'
      }
    });

    console.log(`Upstream responded with status: ${response.status}`);

    // 3. Update Quota (deduct all initially)
    if (response.status === 200) {
      await keysMutex.runExclusive(async () => {
        // Reload strict to avoid race
        const freshKeys = await storage.load();
        if (freshKeys[hCaptchaToken]) {
          freshKeys[hCaptchaToken].used += verificationIds.length;
          await storage.save(freshKeys);
        }
      });
    }

    let failedCount = 0;
    let streamBuffer = '';

    response.data.on('data', (chunk) => {
      res.write(chunk);
      if (response.status === 200) {
        streamBuffer += chunk.toString();
        const lines = streamBuffer.split('\n\n');
        streamBuffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.replace('data: ', '');
              const data = JSON.parse(jsonStr);
              if (data.verificationId && data.currentStep && data.currentStep !== 'success') {
                failedCount++;
              }
            } catch (e) { }
          }
        }
      }
    });

    response.data.on('end', async () => {
      if (failedCount > 0) {
        await keysMutex.runExclusive(async () => {
          const freshKeys = await storage.load();
          if (freshKeys[hCaptchaToken]) {
            freshKeys[hCaptchaToken].used = Math.max(0, freshKeys[hCaptchaToken].used - failedCount);
            await storage.save(freshKeys);
            console.log(`Refunded ${failedCount} credits to key ${hCaptchaToken}`);
          }
        });
      }
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('Stream Error:', err);
      res.write(`event: error\ndata: {"message": "Upstream stream error"}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.write(`event: error\ndata: {"message": "Proxy connection failed. Check logs."}\n\n`);
    res.end();
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
    console.log(`🔑 Master Key Configured: ${MASTER_KEY ? 'YES' : 'NO'}`);
    if (!MASTER_KEY) console.warn('⚠️ WARNING: MASTER_KEY is not set in .env! Proxy will fail.');
  });
}

module.exports = app;
