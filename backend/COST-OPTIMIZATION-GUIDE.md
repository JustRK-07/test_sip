# Cost Optimization Guide

## Overview

This document provides comprehensive strategies for optimizing costs across infrastructure, API usage, database operations, and SIP/calling services in the multi-tenant campaign calling system.

---

## Table of Contents

1. [Database Optimization](#database-optimization)
2. [API & Middleware Optimization](#api--middleware-optimization)
3. [LiveKit & SIP Cost Optimization](#livekit--sip-cost-optimization)
4. [Twilio Cost Optimization](#twilio-cost-optimization)
5. [Infrastructure & Deployment](#infrastructure--deployment)
6. [Monitoring & Observability](#monitoring--observability)
7. [Code-Level Optimizations](#code-level-optimizations)

---

## Database Optimization

### 1. Connection Pooling
**Current State**: Each controller creates separate Prisma instances
**Recommendation**: Use singleton pattern for Prisma client

```javascript
// Bad - Creates multiple Prisma instances
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Good - Use singleton
// src/config/database.js
let prisma;
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      connectionLimit: 10, // Adjust based on load
    });
  }
  return prisma;
}
module.exports = { getPrismaClient };
```

**Estimated Savings**: 30-40% reduction in database connections

### 2. Query Optimization

#### Use Select Projections
```javascript
// Bad - Fetches all fields
const campaigns = await prisma.campaign.findMany({
  where: { tenantId }
});

// Good - Only fetch needed fields
const campaigns = await prisma.campaign.findMany({
  where: { tenantId },
  select: { id: true, name: true, status: true }
});
```

**Estimated Savings**: 50-70% reduction in data transfer

#### Use Pagination
```javascript
// Bad - Fetches all records
const leads = await prisma.lead.findMany({ where: { campaignId } });

// Good - Implement pagination (already in place)
const leads = await prisma.lead.findMany({
  where: { campaignId },
  skip,
  take: limit
});
```

### 3. Index Optimization

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_lead_tenant_campaign ON Lead(tenantId, campaignId);
CREATE INDEX idx_lead_tenant_status ON Lead(tenantId, status);
CREATE INDEX idx_campaign_tenant_status ON Campaign(tenantId, status);
CREATE INDEX idx_calllog_campaign_created ON CallLog(campaignId, createdAt);
```

**Estimated Savings**: 60-80% faster query performance, reduced database CPU usage

### 4. Database Caching

Implement Redis for frequently accessed data:

```javascript
const redis = require('redis');
const client = redis.createClient();

// Cache campaign stats for 5 minutes
async function getCampaignStats(campaignId, tenantId) {
  const cacheKey = `stats:${tenantId}:${campaignId}`;

  // Check cache first
  const cached = await client.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch from database
  const stats = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    include: { leads: true, callLogs: true }
  });

  // Cache for 5 minutes
  await client.setex(cacheKey, 300, JSON.stringify(stats));

  return stats;
}
```

**Estimated Savings**: 80-90% reduction in database queries for frequently accessed data
**Cost**: Redis hosting ~$10-30/month (worth it for high-traffic scenarios)

---

## API & Middleware Optimization

### 1. Implement Rate Limiting (Already Added)

Prevents abuse and reduces infrastructure costs:

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each tenant to 100 requests per window
  keyGenerator: (req) => req.params.tenantId || req.ip
});

router.use('/tenants/:tenantId/', apiLimiter);
```

**Estimated Savings**: Prevents API abuse, protects against DDoS

### 2. Response Compression

```javascript
const compression = require('compression');

app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
```

**Estimated Savings**: 60-80% reduction in bandwidth costs

### 3. Implement API Response Caching

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

function cacheMiddleware(duration) {
  return (req, res, next) => {
    const key = `${req.method}:${req.originalUrl}:${req.params.tenantId}`;
    const cached Response = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      cache.set(key, body, duration);
      return originalJson(body);
    };

    next();
  };
}

// Use for GET endpoints
router.get('/:tenantId/campaigns', cacheMiddleware(60), getAllCampaigns);
```

**Estimated Savings**: 70-90% reduction in compute for read-heavy endpoints

### 4. Batch Operations

Current bulk operations are good, but can be improved:

```javascript
// Good - Already implemented
exports.addLeadsBulk = async (req, res) => {
  // Batch insert with transaction
};

// Better - Use Prisma's createMany for better performance
const createdLeads = await prisma.lead.createMany({
  data: validLeads,
  skipDuplicates: true // Available in PostgreSQL, MySQL
});
```

**Note**: SQLite doesn't support `skipDuplicates`. Consider upgrading to PostgreSQL for production.

---

## LiveKit & SIP Cost Optimization

### 1. Call Duration Optimization

```javascript
// Implement automatic call termination after max duration
const MAX_CALL_DURATION = 5 * 60 * 1000; // 5 minutes

async function makeCall(lead, campaign) {
  const callStartTime = Date.now();

  // Start call
  const call = await LiveKitService.createCall(lead.phoneNumber, campaign);

  // Set timeout to end call
  const timeout = setTimeout(async () => {
    await LiveKitService.endCall(call.id);
    logger.warn(`Call ${call.id} auto-terminated after ${MAX_CALL_DURATION}ms`);
  }, MAX_CALL_DURATION);

  // Clear timeout if call ends normally
  call.on('ended', () => clearTimeout(timeout));
}
```

**Estimated Savings**: 15-25% reduction in SIP costs by preventing runaway calls

### 2. Concurrent Call Optimization

```javascript
// Already implemented in CampaignQueue
// Ensure maxConcurrent is set appropriately
const optimalConcurrency = Math.min(
  campaign.maxConcurrent,
  Math.ceil(availablePhoneNumbers.length * 0.8) // 80% of available lines
);
```

**Recommended**: Set `maxConcurrent` based on your LiveKit plan limits

### 3. Smart Retry Logic

```javascript
// Implement exponential backoff for failed calls
class SmartRetry {
  constructor(maxAttempts = 3) {
    this.maxAttempts = maxAttempts;
  }

  async retryCall(lead, campaign, attempt = 1) {
    try {
      return await LiveKitService.createCall(lead.phoneNumber, campaign);
    } catch (error) {
      if (attempt >= this.maxAttempts) throw error;

      // Don't retry for certain errors (invalid number, etc.)
      if (error.code === 'INVALID_NUMBER') throw error;

      // Exponential backoff: 2^attempt minutes
      const delay = Math.pow(2, attempt) * 60 * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.retryCall(lead, campaign, attempt + 1);
    }
  }
}
```

**Estimated Savings**: 30-40% reduction in wasted retry attempts

### 4. Call Analytics & Optimization

```javascript
// Track call success rates and optimize
async function analyzeCallPatterns(campaignId) {
  const stats = await prisma.callLog.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true
  });

  const successRate = stats.find(s => s.status === 'completed')?._count /
                      stats.reduce((sum, s) => sum + s._count, 0);

  if (successRate < 0.3) {
    logger.warn(`Campaign ${campaignId} has low success rate: ${successRate}`);
    // Pause campaign, review phone numbers/agent config
  }
}
```

**Estimated Savings**: Prevents wasting money on poorly performing campaigns

---

## Twilio Cost Optimization

### 1. Phone Number Management

```javascript
// Release unused phone numbers
async function cleanupUnusedPhoneNumbers(tenantId) {
  // Find phone numbers not used in 30 days
  const unusedNumbers = await prisma.phoneNumber.findMany({
    where: {
      tenantId,
      OR: [
        { campaignId: null },
        {
          campaign: {
            status: { in: ['completed', 'stopped'] },
            completedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        }
      ]
    }
  });

  for (const number of unusedNumbers) {
    await TwilioService.releasePhoneNumber(number.number);
    await prisma.phoneNumber.delete({ where: { id: number.id } });
  }

  return unusedNumbers.length;
}
```

**Estimated Savings**: $1-5 per phone number per month

### 2. Efficient Number Search

```javascript
// Cache available numbers for 24 hours
const availableNumbersCache = new Map();

async function searchAvailableNumbers(criteria) {
  const cacheKey = JSON.stringify(criteria);
  const cached = availableNumbersCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.numbers;
  }

  const numbers = await TwilioService.searchAvailableNumbers(criteria);
  availableNumbersCache.set(cacheKey, {
    numbers,
    timestamp: Date.now()
  });

  return numbers;
}
```

**Estimated Savings**: Reduces Twilio API calls by 80-90%

### 3. Bulk Operations

```javascript
// Purchase numbers in bulk when possible
async function bulkPurchaseNumbers(tenantId, quantity, criteria) {
  const numbers = await TwilioService.searchAvailableNumbers({
    ...criteria,
    limit: quantity
  });

  // Purchase in parallel (with rate limiting)
  const purchased = [];
  for (let i = 0; i < numbers.length; i += 5) {
    const batch = numbers.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(num => TwilioService.purchasePhoneNumber(num))
    );
    purchased.push(...results);

    // Rate limit: wait 1 second between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return purchased;
}
```

**Estimated Savings**: Faster provisioning, fewer API calls

---

## Infrastructure & Deployment

### 1. Use Production Database

**Current**: SQLite (development)
**Recommended**: PostgreSQL or MySQL (production)

Benefits:
- Better performance with indexes
- Connection pooling support
- `skipDuplicates` support in bulk operations
- Better concurrency handling

**Migration**:
```bash
# Update DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/campaign_db"

# Run migration
npx prisma migrate deploy
```

**Estimated Savings**: 50-70% better query performance

### 2. Horizontal Scaling

```javascript
// Use PM2 for clustering
module.exports = {
  apps: [{
    name: 'campaign-api',
    script: './src/server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

**Estimated Savings**: Handle 4-8x more requests with same hardware

### 3. CDN for Static Assets

Use CDN (Cloudflare, AWS CloudFront) for:
- API documentation
- CSV export files (store in S3, serve via CDN)
- Static resources

**Estimated Savings**: 60-80% reduction in bandwidth costs

### 4. Container Optimization

```dockerfile
# Use multi-stage builds
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**Estimated Savings**: 50-70% smaller Docker images, faster deployments

---

## Monitoring & Observability

### 1. Implement Metrics

```javascript
const promClient = require('prom-client');

// Track API latency
const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpDuration.labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  next();
});
```

**Benefit**: Identify slow endpoints, optimize bottlenecks

### 2. Error Tracking

Use Sentry or similar:

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // Sample 10% of transactions
});
```

**Estimated Savings**: Catch issues before they cause expensive downtime

### 3. Log Aggregation

Use structured logging:

```javascript
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ]
});

// Log with structured data
logger.info('Campaign started', {
  campaignId,
  tenantId,
  leadCount: campaign.leads.length,
  timestamp: new Date().toISOString()
});
```

**Benefit**: Easier debugging, faster issue resolution

---

## Code-Level Optimizations

### 1. Async Optimizations

```javascript
// Bad - Sequential
const campaign = await prisma.campaign.findFirst({ where: { id } });
const leads = await prisma.lead.findMany({ where: { campaignId: id } });
const logs = await prisma.callLog.findMany({ where: { campaignId: id } });

// Good - Parallel
const [campaign, leads, logs] = await Promise.all([
  prisma.campaign.findFirst({ where: { id } }),
  prisma.lead.findMany({ where: { campaignId: id } }),
  prisma.callLog.findMany({ where: { campaignId: id } })
]);
```

**Estimated Savings**: 60-70% faster response times

### 2. Memory Management

```javascript
// Bad - Loads all leads into memory
const leads = await prisma.lead.findMany({ where: { campaignId } });
for (const lead of leads) {
  await processLead(lead);
}

// Good - Stream processing
for await (const lead of getLead sStream(campaignId)) {
  await processLead(lead);
}

async function* getLeadsStream(campaignId, batchSize = 100) {
  let skip = 0;
  while (true) {
    const batch = await prisma.lead.findMany({
      where: { campaignId },
      skip,
      take: batchSize
    });

    if (batch.length === 0) break;

    for (const lead of batch) {
      yield lead;
    }

    skip += batchSize;
  }
}
```

**Estimated Savings**: 80-90% reduction in memory usage for large datasets

### 3. N+1 Query Prevention

```javascript
// Bad - N+1 query problem
const campaigns = await prisma.campaign.findMany({ where: { tenantId } });
for (const campaign of campaigns) {
  campaign.leadCount = await prisma.lead.count({ where: { campaignId: campaign.id } });
}

// Good - Use include or separate aggregation
const campaigns = await prisma.campaign.findMany({
  where: { tenantId },
  include: {
    _count: {
      select: { leads: true }
    }
  }
});
```

**Estimated Savings**: 90-95% reduction in database queries

---

## Cost Summary

### Monthly Cost Estimates (500 Active Campaigns, 50,000 Leads)

| Category | Before Optimization | After Optimization | Savings |
|----------|---------------------|-------------------|---------|
| Database | $200/month | $80/month | $120 (60%) |
| API Infrastructure | $300/month | $150/month | $150 (50%) |
| LiveKit/SIP | $1,500/month | $1,050/month | $450 (30%) |
| Twilio | $500/month | $350/month | $150 (30%) |
| Bandwidth | $100/month | $30/month | $70 (70%) |
| **Total** | **$2,600/month** | **$1,660/month** | **$940/month (36%)** |

### Annual Savings: **$11,280**

---

## Implementation Priority

### High Priority (Implement Immediately)
1. Database connection pooling
2. Query optimization (select projections, pagination)
3. Response compression
4. Call duration limits
5. Unused phone number cleanup

### Medium Priority (Implement Within 1 Month)
1. Redis caching
2. API response caching
3. Database indexes
4. Rate limiting
5. Monitoring & metrics

### Low Priority (Long-term Improvements)
1. Horizontal scaling
2. CDN integration
3. Container optimization
4. Advanced caching strategies

---

## Monitoring Metrics

Track these KPIs to measure cost optimization success:

- Average API response time
- Database query count per request
- Cache hit rate
- Average call duration
- Number of active phone numbers
- API error rate
- Resource utilization (CPU, memory)

---

## Conclusion

By implementing these optimizations, you can expect:
- **36% reduction** in monthly infrastructure costs
- **50-70% improvement** in API performance
- **Better scalability** for growth
- **Improved reliability** through monitoring

Start with high-priority items for immediate impact, then gradually implement medium and low priority optimizations.

---

**Last Updated**: 2025-10-10
**Version**: 1.0
**Author**: Development Team
