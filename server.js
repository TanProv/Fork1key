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
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

// Multi-Key Pool System with Per-Key Quota Tracking
// Supports: MASTER_KEYS=key1,key2,key3 OR individual MASTER_KEY, MASTER_KEY_2, etc.
function loadMasterKeys() {
  const keys = [];

  // Method 1: Comma-separated list
  if (process.env.MASTER_KEYS) {
    process.env.MASTER_KEYS.split(',').forEach(k => {
      const trimmed = k.trim();
      if (trimmed) keys.push({
        key: trimmed,
        enabled: true,
        errorCount: 0,
        quota: 0,  // Will be loaded from Redis
        used: 0    // Will be loaded from Redis
      });
    });
  }

  // Method 2: Individual keys (MASTER_KEY, MASTER_KEY_2, MASTER_KEY_3, etc.)
  if (process.env.MASTER_KEY) {
    keys.push({ key: process.env.MASTER_KEY, enabled: true, errorCount: 0, quota: 0, used: 0 });
  }
  for (let i = 2; i <= 10; i++) {
    const envKey = process.env[`MASTER_KEY_${i}`];
    if (envKey) keys.push({ key: envKey, enabled: true, errorCount: 0, quota: 0, used: 0 });
  }

  return keys;
}

let masterKeyPool = loadMasterKeys();
let currentKeyIndex = 0;

// Get short key ID for Redis storage (first 8 chars)
function getKeyId(keyObj) {
  return keyObj.key.substring(0, 8);
}

// Load per-key quotas from Redis
async function loadMasterKeyQuotas() {
  if (!USE_REDIS || !storage.redis) return;

  for (const keyObj of masterKeyPool) {
    const keyId = getKeyId(keyObj);
    const quota = await storage.redis.hget('master_key_quotas', keyId) || 0;
    const used = await storage.redis.hget('master_key_used', keyId) || 0;
    keyObj.quota = parseInt(quota);
    keyObj.used = parseInt(used);
  }
  console.log('📊 Loaded per-key quotas from Redis');
}

// Save per-key quota to Redis
async function saveMasterKeyQuota(keyObj) {
  if (!USE_REDIS || !storage.redis) return;
  const keyId = getKeyId(keyObj);
  await storage.redis.hset('master_key_quotas', keyId, keyObj.quota);
}

// Increment used count for a key (atomic)
async function incrementMasterKeyUsed(keyObj, amount) {
  keyObj.used += amount;
  if (USE_REDIS && storage.redis) {
    const keyId = getKeyId(keyObj);
    await storage.redis.hincrby('master_key_used', keyId, amount);
  }
}

// Get next available key (round-robin, skip disabled AND exhausted keys)
function getNextMasterKey() {
  if (masterKeyPool.length === 0) return null;

  const startIndex = currentKeyIndex;
  do {
    const keyObj = masterKeyPool[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % masterKeyPool.length;

    // Skip if disabled or quota exhausted (quota=0 means unlimited)
    if (keyObj.enabled && (keyObj.quota === 0 || keyObj.used < keyObj.quota)) {
      return keyObj;
    }
  } while (currentKeyIndex !== startIndex);

  // All keys disabled or exhausted, return first one anyway
  return masterKeyPool[0];
}

// Mark key as failed (disable after 3 consecutive errors)
function markKeyFailed(keyObj) {
  keyObj.errorCount++;
  if (keyObj.errorCount >= 3) {
    keyObj.enabled = false;
    console.log(`⚠️ Master Key disabled after 3 errors: ${keyObj.key.substring(0, 8)}...`);
  }
}

// Mark key as successful (reset error count)
function markKeySuccess(keyObj) {
  keyObj.errorCount = 0;
  keyObj.enabled = true;
}

console.log(`🔑 Loaded ${masterKeyPool.length} Master Key(s)`);


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

// Immediately load per-key quotas from Redis (for Vercel serverless cold starts)
(async () => {
  if (USE_REDIS && storage && storage.redis) {
    try {
      for (const keyObj of masterKeyPool) {
        const keyId = keyObj.key.substring(0, 8);
        const quota = await storage.redis.hget('master_key_quotas', keyId);
        const used = await storage.redis.hget('master_key_used', keyId);
        if (quota !== null) keyObj.quota = parseInt(quota);
        if (used !== null) keyObj.used = parseInt(used);
      }
      console.log('📊 Per-key quotas loaded from Redis');
    } catch (e) {
      console.error('⚠️ Failed to load per-key quotas:', e.message);
    }
  }
})();

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
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
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

// Upstream Health Check (Cached)
let upstreamHealthCache = { status: 'unknown', ping: 0, lastCheck: 0 };

app.get('/api/upstream-status', async (req, res) => {
  const now = Date.now();
  const CACHE_TTL = 30 * 1000; // 30 seconds

  // Return cached result if still valid
  if (upstreamHealthCache.lastCheck > 0 && (now - upstreamHealthCache.lastCheck) < CACHE_TTL) {
    return res.json(upstreamHealthCache);
  }

  // Perform health check
  const startTime = Date.now();
  try {
    const response = await axios.get('https://neigui.1key.me/', {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const ping = Date.now() - startTime;
    const hasToken = response.data && response.data.includes('CSRF_TOKEN');

    upstreamHealthCache = {
      status: response.status === 200 && hasToken ? 'online' : 'degraded',
      ping: ping,
      lastCheck: now,
      httpStatus: response.status
    };
  } catch (error) {
    upstreamHealthCache = {
      status: 'offline',
      ping: Date.now() - startTime,
      lastCheck: now,
      error: error.code || error.message
    };
  }

  res.json(upstreamHealthCache);
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

// Admin: List Master Key Pool
app.get('/admin/master-keys', (req, res) => {
  const { secret } = req.query;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const safeList = masterKeyPool.map((k, index) => ({
    id: index,
    keyPreview: k.key.substring(0, 8) + '...' + k.key.slice(-4),
    enabled: k.enabled,
    errorCount: k.errorCount,
    quota: k.quota,
    used: k.used,
    remaining: k.quota > 0 ? Math.max(0, k.quota - k.used) : null
  }));

  res.json({
    total: masterKeyPool.length,
    active: masterKeyPool.filter(k => k.enabled && (k.quota === 0 || k.used < k.quota)).length,
    keys: safeList
  });
});

// Admin: Add Master Key to Pool (Runtime)
app.post('/admin/master-keys/add', (req, res) => {
  const { secret, key } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!key || key.length < 10) return res.status(400).json({ error: 'Invalid key' });

  // Check duplicate
  if (masterKeyPool.some(k => k.key === key)) {
    return res.status(409).json({ error: 'Key already exists in pool' });
  }

  masterKeyPool.push({ key: key, enabled: true, errorCount: 0 });
  console.log(`✅ New Master Key added to pool: ${key.substring(0, 8)}...`);

  res.json({
    success: true,
    message: 'Key added to pool',
    total: masterKeyPool.length
  });
});

// Admin: Toggle Master Key (Enable/Disable)
app.post('/admin/master-keys/toggle', (req, res) => {
  const { secret, keyIndex } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  if (keyIndex < 0 || keyIndex >= masterKeyPool.length) {
    return res.status(404).json({ error: 'Key not found' });
  }

  masterKeyPool[keyIndex].enabled = !masterKeyPool[keyIndex].enabled;
  masterKeyPool[keyIndex].errorCount = 0; // Reset error count

  res.json({
    success: true,
    keyIndex: keyIndex,
    enabled: masterKeyPool[keyIndex].enabled
  });
});

// Admin: Remove Master Key from Pool
app.delete('/admin/master-keys/remove', (req, res) => {
  const { secret, keyIndex } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  if (keyIndex < 0 || keyIndex >= masterKeyPool.length) {
    return res.status(404).json({ error: 'Key not found' });
  }

  const removed = masterKeyPool.splice(keyIndex, 1);
  console.log(`🗑️ Master Key removed from pool: ${removed[0].key.substring(0, 8)}...`);

  res.json({
    success: true,
    message: 'Key removed from pool',
    total: masterKeyPool.length
  });
});

// Admin: Set Master Key Quota
app.post('/admin/master-keys/set-quota', async (req, res) => {
  const { secret, keyIndex, quota, resetUsed } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  if (keyIndex < 0 || keyIndex >= masterKeyPool.length) {
    return res.status(404).json({ error: 'Key not found' });
  }

  const keyObj = masterKeyPool[keyIndex];

  if (quota !== undefined) {
    keyObj.quota = parseInt(quota) || 0;
    await saveMasterKeyQuota(keyObj);
  }

  if (resetUsed) {
    keyObj.used = 0;
    if (USE_REDIS && storage.redis) {
      const keyId = getKeyId(keyObj);
      await storage.redis.hset('master_key_used', keyId, 0);
    }
  }

  res.json({
    success: true,
    keyIndex: keyIndex,
    quota: keyObj.quota,
    used: keyObj.used
  });
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
    // Get next available Master Key from pool
    const masterKeyObj = getNextMasterKey();
    if (!masterKeyObj) {
      return res.status(503).json({ error: 'No Master Keys configured. Please contact Admin.' });
    }

    console.log(`Forwarding request for key ${hCaptchaToken} to upstream...`);
    console.log(`Using Master Key: ${masterKeyObj.key.substring(0, 8)}... (Pool: ${masterKeyPool.length} keys)`);

    // Fetch dynamic CSRF config
    const upstreamConfig = await getUpstreamConfig();

    const response = await axios({
      method: 'post',
      url: 'https://neigui.1key.me/api/batch',
      data: {
        hCaptchaToken: masterKeyObj.key,
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

    // Handle key errors (402 = quota exceeded, 403 = invalid key)
    if (response.status === 402 || response.status === 403) {
      markKeyFailed(masterKeyObj);
      console.log(`⚠️ Master Key error (${response.status}): ${masterKeyObj.key.substring(0, 8)}...`);
    } else if (response.status === 200) {
      markKeySuccess(masterKeyObj);
      // Track per-key usage
      await incrementMasterKeyUsed(masterKeyObj, verificationIds.length);
      console.log(`📊 Master Key ${masterKeyObj.key.substring(0, 8)}... used: ${masterKeyObj.used}/${masterKeyObj.quota || '∞'}`);
    }

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
  const oneDayAgo = now - 24 * 60 * 60 * 1000; // Look back up to 24h to find last 100
  let success = 0;
  let fail = 0;
  let events_list = [];

  if (USE_REDIS && storage.redis) {
    try {
      const events = await storage.redis.zrange('stats_events', oneDayAgo, now, { byScore: true });
      events.forEach(member => {
        if (typeof member === 'string') {
          const parts = member.split(':');
          const isSuccess = parts[1] === '1';
          events_list.push(isSuccess ? 1 : 0);
        }
      });
    } catch (e) {
      console.error('Redis Stats Error:', e);
    }
  } else {
    if (global.localStats) {
      global.localStats.forEach(s => {
        if (s.ts > oneDayAgo) {
          events_list.push(s.success ? 1 : 0);
        }
      });
    }
  }

  // Get last 100
  const recent_events = events_list.slice(-100);
  recent_events.forEach(status => {
    if (status === 1) success++;
    else fail++;
  });

  res.json({ success, fail, events: recent_events });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
    console.log(`🔑 Master Key Pool: ${masterKeyPool.length} key(s) configured`);
    if (masterKeyPool.length === 0) console.warn('⚠️ WARNING: No Master Keys configured! Proxy will fail.');

    // Load per-key quotas from Redis
    await loadMasterKeyQuotas();
  });
}

module.exports = app;
