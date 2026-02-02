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

// Upstream CSRF Cache
let upstreamCsrfCache = {
  token: null,
  cookie: null,
  expiry: 0
};

// Helper: Fetch Upstream CSRF Token & Cookies
async function getUpstreamConfig() {
  const now = Date.now();
  if (upstreamCsrfCache.token && upstreamCsrfCache.expiry > now) {
    return upstreamCsrfCache;
  }

  try {
    console.log('🔄 Fetching fresh CSRF token from upstream...');
    const response = await axios.get('https://neigui.1key.me/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    const html = response.data;
    const match = html.match(/window\.CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
    const token = match ? match[1] : null;

    // Extract cookies
    const setCookies = response.headers['set-cookie'];
    const cookieHeader = setCookies ? setCookies.map(c => c.split(';')[0]).join('; ') : null;

    if (token) {
      console.log('✅ Upstream CSRF token acquired');
      upstreamCsrfCache = {
        token,
        cookie: cookieHeader,
        expiry: now + 20 * 60 * 1000 // Cache for 20 minutes
      };
      return upstreamCsrfCache;
    }
  } catch (error) {
    console.error('❌ Error fetching upstream CSRF:', error.message);
  }
  return { token: null, cookie: null };
}

// Storage Adapter Strategy
let storage;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(redisUrl && redisToken);

if (USE_REDIS) {
  console.log('☁️ Storage Mode: Redis (Upstash)');
  console.log('📍 Redis URL:', redisUrl);
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  storage = {
    redis: redis, // Expose for stats
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

// Master Key Quota Helpers
async function getMasterQuota() {
  if (USE_REDIS && storage.redis) {
    const inventory = await storage.redis.get('master_inventory') || 13;
    const publicLimit = await storage.redis.get('master_public_limit') || 13;
    const used = await storage.redis.get('master_quota_used') || 0;
    return {
      inventory: parseInt(inventory),
      public_limit: parseInt(publicLimit),
      used: parseInt(used),
      total: parseInt(publicLimit) // Legacy bridge
    };
  } else {
    return global.masterQuota || { inventory: 13, public_limit: 13, used: 0, total: 13 };
  }
}

async function setMasterQuota(quota) {
  if (USE_REDIS && storage.redis) {
    if (quota.inventory !== undefined) await storage.redis.set('master_inventory', quota.inventory);
    if (quota.public_limit !== undefined) await storage.redis.set('master_public_limit', quota.public_limit);
    if (quota.used !== undefined) await storage.redis.set('master_quota_used', quota.used);
  } else {
    global.masterQuota = { ...global.masterQuota, ...quota };
    global.masterQuota.total = global.masterQuota.public_limit; // Sync legacy
  }
}

// Quota Helpers with Atomic support
async function getUsedCount(key) {
  if (USE_REDIS && storage.redis) {
    const fromUsage = await storage.redis.hget('key_usage', key) || 0;
    return parseInt(fromUsage);
  } else {
    const keys = await storage.load();
    return keys[key]?.used || 0;
  }
}

async function deductQuota(key, amount) {
  if (USE_REDIS && storage.redis) {
    await storage.redis.hincrby('key_usage', key, amount);
    await storage.redis.incrby('master_quota_used', amount);
  } else {
    await keysMutex.runExclusive(async () => {
      const keys = await storage.load();
      if (keys[key]) {
        keys[key].used += amount;
        await storage.save(keys);
      }
    });
    // Master quota local
    const mq = await getMasterQuota();
    mq.used += amount;
    await setMasterQuota(mq);
  }
}

async function refundQuota(key, amount) {
  if (amount <= 0) return;
  if (USE_REDIS && storage.redis) {
    await storage.redis.hincrby('key_usage', key, -amount);
    await storage.redis.incrby('master_quota_used', -amount);
    console.log(`✅ Atomic Refund: ${amount} to ${key}`);
  } else {
    await keysMutex.runExclusive(async () => {
      const keys = await storage.load();
      if (keys[key]) {
        keys[key].used = Math.max(0, keys[key].used - amount);
        await storage.save(keys);
      }
    });
    const mq = await getMasterQuota();
    mq.used = Math.max(0, mq.used - amount);
    await setMasterQuota(mq);
  }
}

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

// CSRF validation middleware (disabled for Vercel serverless)
const validateCsrf = (req, res, next) => {
  // Skip CSRF validation on Vercel (serverless doesn't support stateful CSRF tokens)
  if (process.env.VERCEL) {
    return next();
  }
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

// Debug: Check Redis Config (REMOVE IN PRODUCTION)
app.get('/debug/redis-config', (req, res) => {
  res.json({
    USE_REDIS,
    hasKV_URL: !!process.env.KV_REST_API_URL,
    hasKV_TOKEN: !!process.env.KV_REST_API_TOKEN,
    hasUPSTASH_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    hasUPSTASH_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    redisUrl: redisUrl ? redisUrl.substring(0, 40) + '...' : null,
    storageMode: USE_REDIS ? 'Redis' : 'Local File'
  });
});

// Status Endpoint
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

// Admin: Bulk Generate Keys
app.post('/admin/bulk-generate', async (req, res) => {
  const { secret, quota, prefix, count } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const keyCount = Math.min(parseInt(count) || 1, 50); // Max 50 at once
  const keyPrefix = prefix || 'bulk';
  const keyQuota = parseInt(quota) || 1000;

  const generatedKeys = [];

  await keysMutex.runExclusive(async () => {
    const keys = await storage.load();

    for (let i = 0; i < keyCount; i++) {
      const newKey = keyPrefix + '_' + generateComplexKey(32);
      keys[newKey] = {
        quota: keyQuota,
        used: 0,
        active: true,
        created_at: new Date().toISOString()
      };
      generatedKeys.push({ key: newKey, quota: keyQuota });
    }

    await storage.save(keys);
  });

  res.json({ success: true, count: generatedKeys.length, keys: generatedKeys });
});

// Admin: Top-up Quota for existing key
app.post('/admin/topup-quota', async (req, res) => {
  const { secret, key, addQuota } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!key || !addQuota) return res.status(400).json({ error: 'Key and addQuota required' });

  await keysMutex.runExclusive(async () => {
    const keys = await storage.load();

    if (!keys[key]) {
      return res.status(404).json({ error: 'Key not found' });
    }

    keys[key].quota += parseInt(addQuota);
    await storage.save(keys);

    res.json({
      success: true,
      key: key,
      newQuota: keys[key].quota,
      used: keys[key].used,
      remaining: keys[key].quota - keys[key].used
    });
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

  // Update used counts with atomic values from Redis
  if (USE_REDIS && storage.redis) {
    const usages = await storage.redis.hgetall('key_usage') || {};
    for (const key in keys) {
      if (usages[key]) {
        keys[key].used = parseInt(usages[key]);
      }
    }
  }

  res.json({ keys });
});

// Admin: Get Master Quota
app.get('/admin/master-quota', async (req, res) => {
  const { secret } = req.query;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const quota = await getMasterQuota();
  res.json(quota);
});

// Admin: Update Master Quota
app.post('/admin/master-quota', async (req, res) => {
  const { secret, total, used, inventory, publicLimit } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const updated = {};
  if (inventory !== undefined) updated.inventory = parseInt(inventory);
  if (publicLimit !== undefined) updated.public_limit = parseInt(publicLimit);
  if (used !== undefined) updated.used = parseInt(used);
  if (total !== undefined) updated.public_limit = parseInt(total); // Legacy support

  await setMasterQuota(updated);
  const final = await getMasterQuota();
  res.json({ success: true, quota: final });
});

// User: Get Quota (for realtime display)
app.get('/api/user/quota', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'API Key required' });

  const keys = await storage.load();
  const keyData = keys[key];

  if (!keyData) {
    return res.status(404).json({ error: 'Key not found' });
  }

  const used = await getUsedCount(key);

  res.json({
    quota: keyData.quota,
    used: used,
    remaining: keyData.quota - used,
    active: keyData.active
  });
});

// Batch Verification (Proxy)
app.post('/api/batch', validateCsrf, async (req, res) => {
  let { hCaptchaToken, verificationIds } = req.body;

  if (!hCaptchaToken || !verificationIds || !Array.isArray(verificationIds)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Security: Limit array size to prevent OOM/DoS
  if (verificationIds.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 IDs per request allowed.' });
  }

  // Auto-extract IDs from URLs
  verificationIds = verificationIds.map(id => {
    // Check if it's a URL
    if (id.includes('verificationId=')) {
      const match = id.match(/verificationId=([a-f0-9]{24})/);
      return match ? match[1] : id;
    }
    // Fallback: Check if it's already a 24-char hex
    if (/^[a-f0-9]{24}$/i.test(id)) {
      return id;
    }
    // Deep fallback: try to find any 24-char hex sequence
    const deepMatch = id.match(/([a-f0-9]{24})/);
    return deepMatch ? deepMatch[1] : id;
  });

  // 1. Validate Local Key
  const keys = await storage.load();
  const keyData = keys[hCaptchaToken];

  if (!keyData || !keyData.active) {
    return res.status(403).json({ error: 'Invalid or inactive API Key' });
  }

  const currentUsed = await getUsedCount(hCaptchaToken);
  if (currentUsed + verificationIds.length > keyData.quota) {
    return res.status(402).json({ error: 'Quota exceeded for this API Key' });
  }

  // 1b. Check Master Key quota pool (Public Limit)
  const masterQuota = await getMasterQuota();
  const masterRemaining = masterQuota.public_limit - masterQuota.used;
  if (masterRemaining < verificationIds.length) {
    return res.status(503).json({
      error: 'Hệ thống tạm hết quota công cộng. Vui lòng liên hệ Admin để nạp thêm.',
      masterRemaining: masterRemaining
    });
  }

  // 2. Reserve Quota Immediately
  await deductQuota(hCaptchaToken, verificationIds.length);

  // 3. Prepare Proxy Request
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    console.log(`Forwarding request for key ${hCaptchaToken} to upstream...`);
    console.log(`Using MASTER_KEY: ${MASTER_KEY ? 'SET' : 'NOT SET'}`);

    // Fetch dynamic CSRF config
    const upstreamConfig = await getUpstreamConfig();

    const response = await axios({
      method: 'post',
      url: 'https://neigui.1key.me/api/batch',
      data: {
        hCaptchaToken: MASTER_KEY || 'no-master-key-set',
        verificationIds: verificationIds,
        useLucky: false,
        programId: ""
      },
      responseType: 'stream',
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': upstreamConfig.token || '',
        'Cookie': upstreamConfig.cookie || '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://neigui.1key.me/',
        'Origin': 'https://neigui.1key.me'
      }
    });

    console.log(`Upstream responded with status: ${response.status}`);

    if (response.status === 400) {
      let errorData = '';
      response.data.on('data', chunk => { errorData += chunk; });
      response.data.on('end', () => {
        console.error('❌ Upstream 400 Error Body:', errorData);
      });
    }

    // 4. Stream Response & Track Failures

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
      await refundQuota(hCaptchaToken, failedCount);
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('Stream Error:', err);
      res.write(`event: error\ndata: {"message": "Upstream stream error"}\n\n`);
      res.end();
    });

    // 4. Update Stats (Async)
    updateStats(response.status === 200).catch(e => console.error('Stats Update Error:', e));

  } catch (error) {
    if (!res.headersSent) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Upstream Proxy Error:', error.message);
        res.status(error.response?.status || 502).json({ error: 'Upstream Error', details: errorData });
      } else {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
    // Update Stats as fail
    updateStats(false).catch(e => console.error('Stats Update Error:', e));
  }
});

// Stats: Helper to track success/fail events
// Uses Redis Sorted Set (ZSET) to store events by timestamp
// Key: stats_events
// Score: timestamp
// Member: timestamp:status:random
async function updateStats(isSuccess) {
  const now = Date.now();
  const status = isSuccess ? '1' : '0';
  const member = `${now}:${status}:${Math.random().toString(36).substring(7)}`;

  if (USE_REDIS && storage.redis) { // Assuming we expose redis instance or use global
    // We need access to the `redis` instance created in the IF block above.
    // To fix this, I'll move `redis` to a broader scope or re-instantiate if needed, 
    // but better to just attach it to `storage` object which is accessible.
    // Checking line 30 in original file... yes, I need to make sure I can access it.
    await storage.redis.zadd('stats_events', { score: now, member });
    // Cleanup old (> 10 mins)
    const tenMinsAgo = now - 10 * 60 * 1000;
    await storage.redis.zremrangebyscore('stats_events', 0, tenMinsAgo);
  } else {
    // Local memory fallback (not persistent across Vercel restarts, but fine for local)
    if (!global.localStats) global.localStats = [];
    global.localStats.push({ ts: now, success: isSuccess });
    // Cleanup
    const tenMinsAgo = now - 10 * 60 * 1000;
    global.localStats = global.localStats.filter(e => e.ts > tenMinsAgo);
  }
}

// Stats: Endpoint
app.get('/api/stats/recent', async (req, res) => {
  const now = Date.now();
  const tenMinsAgo = now - 10 * 60 * 1000;
  let success = 0;
  let fail = 0;

  if (USE_REDIS && storage.redis) {
    try {
      // Get all events in last 10 mins
      const events = await storage.redis.zrange('stats_events', tenMinsAgo, now, { byScore: true });
      events.forEach(member => { // member format: timestamp:status:random
        if (typeof member === 'string') {
          const parts = member.split(':');
          if (parts[1] === '1') success++;
          else fail++;
        }
      });
    } catch (e) {
      console.error('Redis Stats Error:', e);
    }
  } else {
    // Local
    if (global.localStats) {
      global.localStats.forEach(s => {
        if (s.ts > tenMinsAgo) {
          if (s.success) success++;
          else fail++;
        }
      });
    }
  }

  res.json({ success, fail });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
    console.log(`🔑 Master Key Configured: ${MASTER_KEY ? 'YES' : 'NO'}`);
    if (!MASTER_KEY) console.warn('⚠️ WARNING: MASTER_KEY is not set in .env! Proxy will fail.');
  });
}

module.exports = app;
