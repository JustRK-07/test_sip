# Controller Updates for Tenant Scoping

This document shows the exact changes needed to add tenant filtering to campaign and lead controllers.

---

## Pattern to Follow

### Before (No Tenant Filtering):
```javascript
exports.getAllCampaigns = async (req, res) => {
  const campaigns = await prisma.campaign.findMany();
  // ❌ Returns ALL campaigns
};
```

### After (With Tenant Filtering):
```javascript
const { addTenantFilter, addTenantToData, ensureTenantOwnership } = require('../utils/tenantHelper');

exports.getAllCampaigns = async (req, res) => {
  const where = addTenantFilter({}, req.tenantId);
  const campaigns = await prisma.campaign.findMany({ where });
  // ✅ Returns ONLY campaigns for this tenant
};
```

---

## Required Changes for campaignController.js

### 1. Add imports at top:
```javascript
const { addTenantFilter, addTenantToData, ensureTenantOwnership } = require('../utils/tenantHelper');
```

### 2. createCampaign - Add tenant to created campaign:
```javascript
// CHANGE: Line 45-58
const campaign = await prisma.campaign.create({
  data: addTenantToData({  // ← ADD THIS
    name,
    description,
    maxConcurrent,
    retryFailed,
    retryAttempts,
    callDelay,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    status,
    agentName,
    sipTrunkId,
    callerIdNumber,
  }, req.tenantId),  // ← ADD THIS
});
```

### 3. getAllCampaigns - Filter by tenant:
```javascript
// CHANGE: Line 88-91
const where = {};
if (status) {
  where.status = status;
}
// ADD THIS LINE:
Object.assign(where, addTenantFilter(where, req.tenantId));
```

### 4. getCampaign - Check tenant ownership:
```javascript
// Find around line 125
const campaign = await prisma.campaign.findFirst({  // ← Change findUnique to findFirst
  where: addTenantFilter({ id }, req.tenantId),  // ← ADD tenant filter
  include: {
    _count: {
      select: {
        leads: true,
      },
    },
  },
});

if (!campaign) {
  return res.status(404).json({
    success: false,
    error: 'Campaign not found',
  });
}
```

### 5. updateCampaign - Ensure tenant owns campaign:
```javascript
// Find around line 195
const existingCampaign = await prisma.campaign.findFirst({  // ← Change to findFirst
  where: addTenantFilter({ id }, req.tenantId),  // ← ADD tenant filter
});

if (!existingCampaign) {
  return res.status(404).json({
    success: false,
    error: 'Campaign not found',
  });
}
```

### 6. deleteCampaign - Ensure tenant owns campaign:
```javascript
// Find around line 258
const campaign = await prisma.campaign.findFirst({  // ← Change to findFirst
  where: addTenantFilter({ id }, req.tenantId),  // ← ADD tenant filter
});

if (!campaign) {
  return res.status(404).json({
    success: false,
    error: 'Campaign not found',
  });
}
```

### 7. startCampaign - Ensure tenant owns campaign:
```javascript
// Find around line 307
const campaign = await prisma.campaign.findFirst({  // ← Change to findFirst
  where: addTenantFilter({ id }, req.tenantId),  // ← ADD tenant filter
  include: {
    leads: {
      where: {
        status: 'pending',
      },
    },
  },
});

if (!campaign) {
  return res.status(404).json({
    success: false,
    error: 'Campaign not found',
  });
}
```

### 8. stopCampaign, pauseCampaign, resumeCampaign - Same pattern:
```javascript
const campaign = await prisma.campaign.findFirst({
  where: addTenantFilter({ id }, req.tenantId),
});

if (!campaign) {
  return res.status(404).json({
    success: false,
    error: 'Campaign not found',
  });
}
```

---

## Required Changes for leadController.js (Nested)

### 1. Add imports:
```javascript
const { addTenantFilter, addTenantToData, ensureTenantOwnership } = require('../utils/tenantHelper');
```

### 2. addLead - Verify campaign belongs to tenant + assign tenant to lead:
```javascript
// Around line 48
const campaign = await prisma.campaign.findFirst({  // ← Change to findFirst
  where: addTenantFilter({ id: campaignId }, req.tenantId),  // ← ADD tenant filter
});

if (!campaign) {
  return res.status(404).json({
    success: false,
    error: 'Campaign not found',
  });
}

// Around line 76
const lead = await prisma.lead.create({
  data: addTenantToData({  // ← ADD THIS
    campaignId,
    phoneNumber,
    name: name || phoneNumber,
    priority,
    metadata: metadata ? JSON.stringify(metadata) : null,
    status: 'pending',
  }, req.tenantId),  // ← ADD THIS
});
```

### 3. addLeadsBulk - Same pattern:
```javascript
// Verify campaign (line 121)
const campaign = await prisma.campaign.findFirst({
  where: addTenantFilter({ id: campaignId }, req.tenantId),
});

// Add tenant to each lead (line 148)
validLeads.push(addTenantToData({
  campaignId,
  phoneNumber: lead.phoneNumber,
  name: lead.name || lead.phoneNumber,
  priority: lead.priority || 1,
  metadata: lead.metadata ? JSON.stringify(lead.metadata) : null,
  status: 'pending',
}, req.tenantId));
```

### 4. uploadLeadsCSV - Same pattern:
```javascript
// Verify campaign (line 213)
const campaign = await prisma.campaign.findFirst({
  where: addTenantFilter({ id: campaignId }, req.tenantId),
});

// Add tenant to leads (line 245)
leads.push(addTenantToData({
  campaignId,
  phoneNumber: phoneNumber.trim(),
  name: row.name?.trim() || phoneNumber.trim(),
  priority: parseInt(row.priority) || 1,
  metadata: row.metadata ? JSON.parse(row.metadata) : {},
  status: 'pending',
}, req.tenantId));
```

### 5. getLeads - Filter by campaign AND tenant:
```javascript
// Around line 323
const where = {
  campaignId,
  ...addTenantFilter({}, req.tenantId),  // ← ADD tenant filter
};
if (status) {
  where.status = status;
}
```

### 6. getLead - Verify tenant ownership:
```javascript
// Around line 367
const lead = await prisma.lead.findFirst({  // ← Change to findFirst
  where: {
    id: leadId,
    campaignId,
    ...addTenantFilter({}, req.tenantId),  // ← ADD tenant filter
  },
  include: {
    callLogs: true,
  },
});
```

### 7. updateLead, deleteLead - Same pattern:
```javascript
const lead = await prisma.lead.findFirst({
  where: {
    id: leadId,
    campaignId,
    ...addTenantFilter({}, req.tenantId),
  },
});

if (!lead) {
  return res.status(404).json({
    success: false,
    error: 'Lead not found',
  });
}
```

### 8. deleteAllLeads - Verify campaign + filter leads:
```javascript
// Verify campaign (line 509)
const campaign = await prisma.campaign.findFirst({
  where: addTenantFilter({ id: campaignId }, req.tenantId),
});

// Delete with tenant filter (line 527)
const result = await prisma.lead.deleteMany({
  where: addTenantFilter({ campaignId }, req.tenantId),
});
```

---

## Required Changes for leadControllerIndependent.js (Global)

### 1. Add imports:
```javascript
const { addTenantFilter, addTenantToData, ensureTenantOwnership } = require('../utils/tenantHelper');
```

### 2. getAllLeads - Filter by tenant:
```javascript
// Around line 28
const where = {};
if (status) where.status = status;
if (campaignId) where.campaignId = campaignId;
if (search) {
  where.OR = [
    { phoneNumber: { contains: search } },
    { name: { contains: search } },
  ];
}
// ADD THIS:
Object.assign(where, addTenantFilter(where, req.tenantId));
```

### 3. searchLeads - Filter by tenant:
```javascript
// Around line 93
const leads = await prisma.lead.findMany({
  where: {
    ...addTenantFilter({}, req.tenantId),  // ← ADD THIS
    OR: [
      { phoneNumber: { contains: q } },
      { name: { contains: q } },
    ],
  },
  // ... rest
});
```

### 4. getLeadStats - Filter by tenant:
```javascript
// Around line 124
const where = campaignId ? { campaignId } : {};
Object.assign(where, addTenantFilter(where, req.tenantId));  // ← ADD THIS

const [total, pending, calling, completed, failed, unassigned] = await Promise.all([
  prisma.lead.count({ where }),
  prisma.lead.count({ where: { ...where, status: 'pending' } }),
  // ... etc
]);
```

### 5. getLeadById - Filter by tenant:
```javascript
// Around line 174
const lead = await prisma.lead.findFirst({  // ← Change to findFirst
  where: addTenantFilter({ id: leadId }, req.tenantId),  // ← ADD tenant filter
  include: {
    campaign: true,
    callLogs: {
      orderBy: { createdAt: 'desc' },
    },
  },
});
```

### 6. updateLeadById - Verify tenant ownership:
```javascript
// Around line 207
const lead = await prisma.lead.findFirst({
  where: addTenantFilter({ id: leadId }, req.tenantId),
});

// When moving to different campaign, verify new campaign belongs to tenant
if (campaignId && campaignId !== lead.campaignId) {
  const newCampaign = await prisma.campaign.findFirst({
    where: addTenantFilter({ id: campaignId }, req.tenantId),  // ← ADD tenant filter
  });

  if (!newCampaign) {
    return res.status(404).json({
      success: false,
      error: 'Target campaign not found',
    });
  }
}
```

### 7. deleteLeadById - Verify tenant ownership:
```javascript
// Around line 293
const lead = await prisma.lead.findFirst({
  where: addTenantFilter({ id: leadId }, req.tenantId),
});
```

### 8. importLeads - Assign tenant to leads:
```javascript
// Verify campaign if provided (line 343)
if (campaignId) {
  const campaign = await prisma.campaign.findFirst({
    where: addTenantFilter({ id: campaignId }, req.tenantId),
  });

  if (!campaign) {
    return res.status(404).json({
      success: false,
      error: 'Campaign not found',
    });
  }
}

// Create leads with tenant (line 355)
const validLeads = leads.map(lead => addTenantToData({
  phoneNumber: lead.phoneNumber,
  name: lead.name || lead.phoneNumber,
  priority: lead.priority || 1,
  campaignId: campaignId || null,
  status: 'pending',
  metadata: lead.metadata ? JSON.stringify(lead.metadata) : null,
}, req.tenantId));
```

### 9. bulkAssignCampaign - Verify campaign + filter leads:
```javascript
// Verify campaign (line 396)
const campaign = await prisma.campaign.findFirst({
  where: addTenantFilter({ id: campaignId }, req.tenantId),
});

// Update only tenant's leads (line 409)
const result = await prisma.lead.updateMany({
  where: {
    id: { in: leadIds },
    status: { not: 'calling' },
    ...addTenantFilter({}, req.tenantId),  // ← ADD tenant filter
  },
  data: {
    campaignId,
  },
});
```

### 10. bulkUpdateStatus - Filter by tenant:
```javascript
// Around line 456
const result = await prisma.lead.updateMany({
  where: {
    id: { in: leadIds },
    ...addTenantFilter({}, req.tenantId),  // ← ADD tenant filter
  },
  data: {
    status,
  },
});
```

### 11. exportLeads - Filter by tenant:
```javascript
// Around line 487
const where = {};
if (campaignId) where.campaignId = campaignId;
if (status) where.status = status;
Object.assign(where, addTenantFilter(where, req.tenantId));  // ← ADD THIS

const leads = await prisma.lead.findMany({
  where,
  // ... rest
});
```

---

## Summary of Changes

**Pattern:**
1. ✅ Add `addTenantFilter()` to all `findMany()`, `findFirst()`, `findUnique()` queries
2. ✅ Add `addTenantToData()` to all `create()` operations
3. ✅ Change `findUnique()` to `findFirst()` when filtering by tenant (since unique constraints don't include tenantId)
4. ✅ Verify campaign/resource ownership before operations

**Security:**
- Returns 404 (not 403) when resource doesn't belong to tenant
- Prevents leaking existence of other tenants' resources
- Automatic tenant assignment on create
- Automatic tenant filtering on read

**Next Step:**
Apply these changes to the actual controller files!
