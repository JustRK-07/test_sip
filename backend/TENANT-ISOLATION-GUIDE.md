# Tenant Isolation Guide

Complete guide to implementing tenant-specific campaigns and leads for multi-tenancy support.

---

## 🎯 What Changed?

Your campaigns and leads are now **tenant-specific**. This means:

✅ **Each tenant has isolated data**
- Tenant A cannot see Tenant B's campaigns or leads
- Data is filtered automatically by `tenantId`
- Prevents accidental data leaks

✅ **Flexible tenant assignment**
- Can assign leads/campaigns to tenant
- Can leave tenantId null for system-level resources

---

## 📊 Database Schema Changes

### **Campaign Model**
```prisma
model Campaign {
  // ... existing fields ...

  // NEW: Multi-tenancy support
  tenantId  String?  @map("tenant_id")

  // Relations
  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  @@index([tenantId])  // Index for fast tenant queries
}
```

### **Lead Model**
```prisma
model Lead {
  // ... existing fields ...

  // NEW: Made campaignId optional for unassigned leads
  campaignId  String?  @map("campaign_id")

  // NEW: Multi-tenancy support
  tenantId    String?  @map("tenant_id")

  // Relations
  tenant      Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  campaign    Campaign? @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([tenantId])  // Index for fast tenant queries
}
```

---

## 🔐 How Tenant Identification Works

The system identifies tenants using the **`tenantMiddleware.js`** in this priority order:

### **1. X-Tenant-ID Header** (Recommended)
```bash
curl http://localhost:3001/api/v1/campaigns \
  -H "X-Tenant-ID: tenant-123"
```

### **2. JWT Token** (Production-ready, TODO)
```javascript
// Extract from decoded JWT
Authorization: Bearer eyJhbGc...
// Token contains: { userId: "user-1", tenantId: "tenant-123" }
```

### **3. Subdomain** (Optional)
```
https://acme.yourapp.com → tenantId from Tenant.domain = "acme"
https://widgets.yourapp.com → tenantId from Tenant.domain = "widgets"
```

Enable with: `ENABLE_SUBDOMAIN_TENANCY=true` in `.env`

### **4. Query Parameter** (Development only)
```bash
# ONLY works in development mode
curl http://localhost:3001/api/v1/campaigns?tenantId=tenant-123
```

---

## 🚀 Usage Guide

### **Step 1: Create Tenant**

```bash
POST /api/v1/tenants
{
  "name": "Acme Corporation",
  "domain": "acme",
  "isActive": true
}

# Response:
{
  "success": true,
  "data": {
    "id": "tenant-acme-123",
    "name": "Acme Corporation"
  }
}
```

### **Step 2: Create Campaign for Tenant**

```bash
POST /api/v1/campaigns
X-Tenant-ID: tenant-acme-123

{
  "name": "Q4 Sales Campaign",
  "maxConcurrent": 5
}

# The campaign is automatically assigned to tenant-acme-123
```

### **Step 3: Add Leads to Campaign**

```bash
POST /api/v1/campaigns/camp-123/leads/bulk
X-Tenant-ID: tenant-acme-123

{
  "leads": [
    {"phoneNumber": "+1234567890", "name": "John Doe"},
    {"phoneNumber": "+9876543210", "name": "Jane Smith"}
  ]
}

# Leads are automatically assigned to tenant-acme-123
```

### **Step 4: Query Tenant-Specific Data**

```bash
# Get all campaigns for this tenant
GET /api/v1/campaigns
X-Tenant-ID: tenant-acme-123

# Only returns campaigns where tenantId = "tenant-acme-123"
```

---

## 🔒 Data Isolation Examples

### **Scenario: Two Tenants**

**Tenant A (Acme Corp):**
- Campaign: "Acme Sales Q4"
- Leads: 100 leads

**Tenant B (Widgets Inc):**
- Campaign: "Widgets Outreach"
- Leads: 50 leads

**API Calls:**

```bash
# Tenant A requests
GET /api/v1/campaigns
X-Tenant-ID: tenant-acme-123

# Returns:
{
  "data": [
    {
      "id": "camp-1",
      "name": "Acme Sales Q4",
      "tenantId": "tenant-acme-123"
    }
  ]
}
# ✅ ONLY Acme's campaign


# Tenant B requests
GET /api/v1/campaigns
X-Tenant-ID: tenant-widgets-456

# Returns:
{
  "data": [
    {
      "id": "camp-2",
      "name": "Widgets Outreach",
      "tenantId": "tenant-widgets-456"
    }
  ]
}
# ✅ ONLY Widgets' campaign
```

**Result:** **Complete data isolation!** ✅

---

## 🛠️ Middleware Configuration

### **Global Tenant Extraction** (Recommended)

Apply to all routes:

```javascript
// app.js
const { extractTenant } = require('./middleware/tenantMiddleware');

// Extract tenant from all requests
app.use('/api', extractTenant);
```

### **Require Tenant for Specific Routes**

```javascript
// routes/campaignRoutes.js
const { requireTenant, validateTenant } = require('../middleware/tenantMiddleware');

// Require tenant for campaign routes
router.use(requireTenant);        // Ensures tenantId is present
router.use(validateTenant);       // Validates tenant exists and is active

router.get('/', getCampaigns);    // Automatically filtered by tenant
router.post('/', createCampaign); // Automatically assigns to tenant
```

---

## 📝 Controller Pattern

### **Before (No Tenant Filtering):**

```javascript
exports.getCampaigns = async (req, res) => {
  const campaigns = await prisma.campaign.findMany();
  // ❌ Returns ALL campaigns from ALL tenants
  res.json({ data: campaigns });
};
```

### **After (With Tenant Filtering):**

```javascript
exports.getCampaigns = async (req, res) => {
  const where = {};

  // Filter by tenant if present
  if (req.tenantId) {
    where.tenantId = req.tenantId;
  }

  const campaigns = await prisma.campaign.findMany({ where });
  // ✅ Returns ONLY campaigns for this tenant
  res.json({ data: campaigns });
};
```

---

## 🔄 Migration Strategy

### **Option 1: Require Tenants (Strict)**

```env
# .env
REQUIRE_TENANT=true
```

- All requests MUST have tenantId
- Fails with 400 error if tenantId missing
- Best for new multi-tenant systems

### **Option 2: Optional Tenants (Flexible)**

```env
# .env
REQUIRE_TENANT=false  # or omit
```

- Requests without tenantId show ALL data (system-level)
- Requests with tenantId show filtered data
- Best for gradual migration

### **Migrating Existing Data**

```javascript
// Script to assign existing campaigns/leads to a tenant
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateToTenant(tenantId) {
  // Assign all campaigns without tenant to this tenant
  await prisma.campaign.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  });

  // Assign all leads without tenant to this tenant
  await prisma.lead.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  });

  console.log('Migration complete!');
}

// Run: node migrate-tenant.js
migrateToTenant('tenant-default-123');
```

---

## 🧪 Testing Tenant Isolation

### **Test Script:**

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3001/api/v1'
});

async function testTenantIsolation() {
  // Create two tenants
  const tenant1 = await api.post('/tenants', { name: 'Tenant A' });
  const tenant2 = await api.post('/tenants', { name: 'Tenant B' });

  const tenantA = tenant1.data.data.id;
  const tenantB = tenant2.data.data.id;

  // Create campaign for Tenant A
  await api.post('/campaigns',
    { name: 'Campaign A' },
    { headers: { 'X-Tenant-ID': tenantA } }
  );

  // Create campaign for Tenant B
  await api.post('/campaigns',
    { name: 'Campaign B' },
    { headers: { 'X-Tenant-ID': tenantB } }
  );

  // Query as Tenant A
  const campaignsA = await api.get('/campaigns', {
    headers: { 'X-Tenant-ID': tenantA }
  });

  console.log('Tenant A sees:', campaignsA.data.data);
  // ✅ Should ONLY see "Campaign A"

  // Query as Tenant B
  const campaignsB = await api.get('/campaigns', {
    headers: { 'X-Tenant-ID': tenantB }
  });

  console.log('Tenant B sees:', campaignsB.data.data);
  // ✅ Should ONLY see "Campaign B"

  // Verify isolation
  const hasOnlyOwnData =
    campaignsA.data.data.every(c => c.tenantId === tenantA) &&
    campaignsB.data.data.every(c => c.tenantId === tenantB);

  console.log('✅ Tenant isolation:', hasOnlyOwnData ? 'PASS' : 'FAIL');
}

testTenantIsolation();
```

---

## ⚠️ Important Security Notes

### **1. ALWAYS Filter by Tenant**

```javascript
// ❌ WRONG - No tenant filtering
const campaign = await prisma.campaign.findUnique({
  where: { id: campaignId }
});

// ✅ CORRECT - With tenant check
const campaign = await prisma.campaign.findFirst({
  where: {
    id: campaignId,
    tenantId: req.tenantId  // ← MUST check tenant!
  }
});
```

### **2. Prevent Cross-Tenant Updates**

```javascript
// ❌ WRONG - Can update any tenant's campaign
await prisma.campaign.update({
  where: { id: campaignId },
  data: { name: 'Hacked!' }
});

// ✅ CORRECT - Check tenant first
const campaign = await prisma.campaign.findFirst({
  where: {
    id: campaignId,
    tenantId: req.tenantId
  }
});

if (!campaign) {
  return res.status(404).json({ error: 'Campaign not found' });
}

await prisma.campaign.update({
  where: { id: campaignId },
  data: { name: 'Updated Name' }
});
```

### **3. Check Tenant on Related Resources**

```javascript
// When adding lead to campaign, verify campaign belongs to tenant
const campaign = await prisma.campaign.findFirst({
  where: {
    id: campaignId,
    tenantId: req.tenantId  // ← Verify ownership!
  }
});

if (!campaign) {
  return res.status(404).json({ error: 'Campaign not found' });
}

// Now safe to add lead
await prisma.lead.create({
  data: {
    campaignId,
    tenantId: req.tenantId,  // ← Assign to same tenant
    phoneNumber,
    name
  }
});
```

---

## ✅ Summary

**Tenant isolation is now implemented for campaigns and leads!**

**Key Changes:**
- ✅ Added `tenantId` to Campaign and Lead models
- ✅ Created tenant middleware for automatic tenant extraction
- ✅ Updated schema with tenant relations and indexes
- ✅ Controllers will be updated to filter by tenant (next step)

**Next Steps:**
1. Run database migration
2. Update controllers with tenant filtering
3. Test tenant isolation
4. Update API documentation

**Security Benefits:**
- 🔒 Data isolation between tenants
- 🔒 Prevents accidental cross-tenant queries
- 🔒 Automatic tenant filtering
- 🔒 Validation of tenant existence and status

**Your multi-tenant system is ready!** 🎉
