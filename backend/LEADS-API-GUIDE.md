# Leads API Guide

Complete guide to using both nested (campaign-scoped) and independent (global) Leads APIs.

---

## 📊 Two API Approaches

You now have **TWO ways** to manage leads:

### 1. **Nested API** (Campaign-Scoped)
- Base path: `/api/v1/campaigns/:campaignId/leads`
- Use for: Campaign management workflows
- Context: Always tied to a specific campaign

### 2. **Independent API** (Global Scope) - **NEW!**
- Base path: `/api/v1/leads`
- Use for: Lead management tab, cross-campaign operations
- Context: Works across all campaigns

---

## 🎯 When to Use Which API?

| Scenario | Use This API | Reason |
|----------|-------------|--------|
| **Adding leads to specific campaign** | Nested | Campaign context is primary |
| **Viewing all leads across campaigns** | Independent | Need global view |
| **Moving lead between campaigns** | Independent | Cross-campaign operation |
| **Searching all leads** | Independent | Global search |
| **Uploading CSV to campaign** | Nested | Direct campaign assignment |
| **Importing leads without campaign** | Independent | Assign campaign later |
| **Getting lead statistics** | Independent | Global analytics |
| **Viewing leads within campaign detail** | Nested | Campaign context |

---

## 📱 UI Tab Mapping

### **Campaigns Tab** → Uses Nested API

```javascript
// Show campaign with its leads
GET /api/v1/campaigns/camp-123
GET /api/v1/campaigns/camp-123/leads

// Add leads to this campaign
POST /api/v1/campaigns/camp-123/leads/bulk
POST /api/v1/campaigns/camp-123/leads/upload
```

### **Leads Tab** → Uses Independent API

```javascript
// Show all leads
GET /api/v1/leads?page=1&limit=50

// Search across all leads
GET /api/v1/leads?search=+1234

// Filter by campaign
GET /api/v1/leads?campaignId=camp-123&status=pending

// Get statistics
GET /api/v1/leads/stats
```

---

## 🔧 API Reference

### **Independent Leads API** (Global Scope)

#### 1. Get All Leads

```http
GET /api/v1/leads
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50)
- `status` (string) - Filter by status (pending, calling, completed, failed)
- `campaignId` (string) - Filter by campaign ID
- `search` (string) - Search phone number or name
- `sortBy` (string) - Sort field (default: createdAt)
- `sortOrder` (string) - asc or desc (default: desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-123",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "status": "pending",
      "priority": 1,
      "campaign": {
        "id": "camp-123",
        "name": "Sales Q4",
        "status": "active"
      },
      "callLogs": [
        {
          "id": "log-456",
          "status": "completed",
          "duration": 45000,
          "createdAt": "2025-01-15T10:30:00Z"
        }
      ],
      "createdAt": "2025-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "limit": 50,
    "pages": 25
  }
}
```

**Example Usage:**

```bash
# Get all leads
curl http://localhost:3001/api/v1/leads

# Get pending leads only
curl http://localhost:3001/api/v1/leads?status=pending

# Search for specific phone
curl http://localhost:3001/api/v1/leads?search=%2B1234567890

# Get leads from specific campaign
curl http://localhost:3001/api/v1/leads?campaignId=camp-123

# Paginate results
curl http://localhost:3001/api/v1/leads?page=2&limit=100
```

---

#### 2. Search Leads

```http
GET /api/v1/leads/search?q=search_term
```

**Query Parameters:**
- `q` (string, required) - Search query (min 2 characters)
- `limit` (number) - Max results (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-123",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "status": "pending",
      "campaign": {
        "id": "camp-123",
        "name": "Sales Q4"
      }
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl "http://localhost:3001/api/v1/leads/search?q=john"
```

---

#### 3. Get Lead Statistics

```http
GET /api/v1/leads/stats
```

**Query Parameters:**
- `campaignId` (string, optional) - Filter by campaign

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "byStatus": {
      "pending": 450,
      "calling": 10,
      "completed": 600,
      "failed": 190
    },
    "unassigned": 25,
    "byCampaign": [
      {
        "campaignId": "camp-123",
        "campaignName": "Sales Q4",
        "count": 500
      },
      {
        "campaignId": "camp-456",
        "campaignName": "Support",
        "count": 725
      }
    ]
  }
}
```

**Example:**
```bash
# All leads stats
curl http://localhost:3001/api/v1/leads/stats

# Specific campaign stats
curl http://localhost:3001/api/v1/leads/stats?campaignId=camp-123
```

---

#### 4. Get Lead by ID

```http
GET /api/v1/leads/:leadId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lead-123",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "status": "completed",
    "priority": 1,
    "metadata": null,
    "campaign": {
      "id": "camp-123",
      "name": "Sales Q4",
      "status": "active",
      "maxConcurrent": 5
    },
    "callLogs": [
      {
        "id": "log-456",
        "status": "completed",
        "duration": 45000,
        "agentId": "agent-primary",
        "createdAt": "2025-01-15T10:30:00Z"
      }
    ],
    "createdAt": "2025-01-10T08:00:00Z",
    "updatedAt": "2025-01-15T10:31:00Z"
  }
}
```

**Example:**
```bash
curl http://localhost:3001/api/v1/leads/lead-123
```

---

#### 5. Update Lead

```http
PUT /api/v1/leads/:leadId
```

**Body:**
```json
{
  "phoneNumber": "+1234567890",
  "name": "John Updated",
  "priority": 2,
  "campaignId": "camp-456",  // Move to different campaign
  "status": "pending",
  "metadata": { "source": "referral" }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lead-123",
    "phoneNumber": "+1234567890",
    "name": "John Updated",
    "priority": 2,
    "campaignId": "camp-456",
    "status": "pending",
    "campaign": {
      "id": "camp-456",
      "name": "New Campaign"
    }
  }
}
```

**Example:**
```bash
# Move lead to different campaign
curl -X PUT http://localhost:3001/api/v1/leads/lead-123 \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "camp-456"}'

# Update lead details
curl -X PUT http://localhost:3001/api/v1/leads/lead-123 \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "priority": 1}'
```

---

#### 6. Delete Lead

```http
DELETE /api/v1/leads/:leadId
```

**Response:**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3001/api/v1/leads/lead-123
```

---

#### 7. Import Leads

```http
POST /api/v1/leads/import
```

**Body:**
```json
{
  "campaignId": "camp-123",  // Optional - can be null
  "leads": [
    {
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "priority": 1,
      "metadata": { "source": "website" }
    },
    {
      "phoneNumber": "+9876543210",
      "name": "Jane Smith"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imported": 2,
    "total": 2,
    "campaignId": "camp-123"
  }
}
```

**Example:**
```bash
# Import leads without campaign (assign later)
curl -X POST http://localhost:3001/api/v1/leads/import \
  -H "Content-Type: application/json" \
  -d '{
    "leads": [
      {"phoneNumber": "+1234567890", "name": "John"},
      {"phoneNumber": "+9876543210", "name": "Jane"}
    ]
  }'

# Import leads directly to campaign
curl -X POST http://localhost:3001/api/v1/leads/import \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "camp-123",
    "leads": [{"phoneNumber": "+1234567890"}]
  }'
```

---

#### 8. Bulk Assign to Campaign

```http
POST /api/v1/leads/bulk/assign
```

**Body:**
```json
{
  "leadIds": ["lead-1", "lead-2", "lead-3"],
  "campaignId": "camp-456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated": 3,
    "requested": 3,
    "campaignId": "camp-456"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/v1/leads/bulk/assign \
  -H "Content-Type: application/json" \
  -d '{
    "leadIds": ["lead-1", "lead-2", "lead-3"],
    "campaignId": "camp-456"
  }'
```

---

#### 9. Bulk Update Status

```http
POST /api/v1/leads/bulk/status
```

**Body:**
```json
{
  "leadIds": ["lead-1", "lead-2"],
  "status": "pending"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "requested": 2,
    "status": "pending"
  }
}
```

**Example:**
```bash
# Reset leads to pending
curl -X POST http://localhost:3001/api/v1/leads/bulk/status \
  -H "Content-Type: application/json" \
  -d '{
    "leadIds": ["lead-1", "lead-2"],
    "status": "pending"
  }'
```

---

#### 10. Export Leads as CSV

```http
GET /api/v1/leads/export
```

**Query Parameters:**
- `campaignId` (string, optional) - Filter by campaign
- `status` (string, optional) - Filter by status

**Response:**
CSV file download

**Example:**
```bash
# Export all leads
curl http://localhost:3001/api/v1/leads/export -o leads.csv

# Export specific campaign
curl "http://localhost:3001/api/v1/leads/export?campaignId=camp-123" -o campaign-leads.csv

# Export pending leads only
curl "http://localhost:3001/api/v1/leads/export?status=pending" -o pending-leads.csv
```

---

## 🆚 Comparison: Nested vs Independent API

### **Nested API** (Campaign-Scoped)
```http
GET    /api/v1/campaigns/:campaignId/leads          # List leads in campaign
POST   /api/v1/campaigns/:campaignId/leads          # Add lead to campaign
POST   /api/v1/campaigns/:campaignId/leads/bulk     # Bulk add to campaign
POST   /api/v1/campaigns/:campaignId/leads/upload   # Upload CSV to campaign
GET    /api/v1/campaigns/:campaignId/leads/:leadId  # Get lead (must be in campaign)
PUT    /api/v1/campaigns/:campaignId/leads/:leadId  # Update lead in campaign
DELETE /api/v1/campaigns/:campaignId/leads/:leadId  # Delete lead from campaign
DELETE /api/v1/campaigns/:campaignId/leads          # Delete all leads in campaign
```

**Pros:**
- ✅ Clear campaign context
- ✅ Simpler for campaign-focused workflows
- ✅ Natural nesting in campaign detail pages

**Cons:**
- ❌ Cannot view leads across campaigns
- ❌ Cannot move leads between campaigns
- ❌ Cannot get global statistics
- ❌ Requires campaignId for every operation

---

### **Independent API** (Global Scope)
```http
GET    /api/v1/leads                     # List ALL leads
GET    /api/v1/leads/search              # Search across all leads
GET    /api/v1/leads/stats               # Global statistics
GET    /api/v1/leads/export              # Export leads as CSV
POST   /api/v1/leads/import              # Import leads (optional campaign)
POST   /api/v1/leads/bulk/assign         # Bulk assign to campaign
POST   /api/v1/leads/bulk/status         # Bulk update status
GET    /api/v1/leads/:leadId             # Get any lead
PUT    /api/v1/leads/:leadId             # Update any lead (move between campaigns)
DELETE /api/v1/leads/:leadId             # Delete any lead
```

**Pros:**
- ✅ Global view across all campaigns
- ✅ Cross-campaign operations
- ✅ Flexible filtering by campaign
- ✅ Better for lead management tab
- ✅ Can import without campaign
- ✅ Bulk operations

**Cons:**
- ❌ Campaign context not always clear
- ❌ May need more filtering in queries

---

## 💡 Recommended Usage Pattern

### **Use Both APIs Together!**

```javascript
// In "Campaigns Tab" - Use Nested API
// User clicks on "Sales Q4" campaign
GET /api/v1/campaigns/camp-123
GET /api/v1/campaigns/camp-123/leads

// User uploads CSV to campaign
POST /api/v1/campaigns/camp-123/leads/upload


// In "Leads Tab" - Use Independent API
// User views all leads
GET /api/v1/leads?page=1&limit=50

// User searches for lead
GET /api/v1/leads/search?q=john

// User filters by status and campaign
GET /api/v1/leads?status=pending&campaignId=camp-123

// User moves leads to different campaign
POST /api/v1/leads/bulk/assign
{
  "leadIds": ["lead-1", "lead-2"],
  "campaignId": "camp-456"
}

// User views lead details
GET /api/v1/leads/lead-123

// User exports leads
GET /api/v1/leads/export?status=pending
```

---

## ✅ Summary

**You now have the best of both worlds:**

1. **Nested API** for campaign-centric workflows
2. **Independent API** for global lead management

**Use cases:**
- **Campaigns Tab** → Nested API (campaign context)
- **Leads Tab** → Independent API (global operations)
- **Lead Detail Modal** → Independent API (works from anywhere)
- **Upload CSV to Campaign** → Nested API (direct assignment)
- **Import Unassigned Leads** → Independent API (assign later)
- **Move Leads Between Campaigns** → Independent API (cross-campaign)
- **Global Search** → Independent API (all campaigns)
- **Statistics Dashboard** → Independent API (analytics)

**This dual API approach gives you maximum flexibility for your UI!** 🎉
