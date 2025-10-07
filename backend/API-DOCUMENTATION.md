# Campaign Calling API Documentation

## 🚀 Overview

Production-ready REST API for managing campaign-based outbound calling system. Built with Express.js, Prisma ORM, and integrates with the proven CampaignQueue service.

**Base URL:** `http://localhost:3000/api/v1`

---

## 📊 API Endpoints

### Health Check

**GET** `/api/v1/health`

Check if the API is running.

```bash
curl http://localhost:3000/api/v1/health
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign Calling API is running",
  "timestamp": "2025-10-07T20:00:00.000Z"
}
```

---

## 📋 Campaign Endpoints

### Create Campaign

**POST** `/api/v1/campaigns`

Create a new calling campaign.

**Request Body:**
```json
{
  "name": "Q4 Sales Campaign",
  "description": "End of year sales push",
  "maxConcurrent": 3,
  "retryFailed": false,
  "retryAttempts": 1,
  "callDelay": 2000,
  "status": "draft"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmggzkcrc0000sbanzqb7a2hc",
    "name": "Q4 Sales Campaign",
    "description": "End of year sales push",
    "status": "draft",
    "maxConcurrent": 3,
    "retryFailed": false,
    "retryAttempts": 1,
    "callDelay": 2000,
    "scheduledAt": null,
    "startedAt": null,
    "completedAt": null,
    "totalCalls": 0,
    "successfulCalls": 0,
    "failedCalls": 0,
    "createdAt": "2025-10-07T20:00:00.000Z",
    "updatedAt": "2025-10-07T20:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign","maxConcurrent":3,"callDelay":2000}'
```

---

### Get All Campaigns

**GET** `/api/v1/campaigns`

Get list of all campaigns with pagination.

**Query Parameters:**
- `status` (optional): Filter by status (draft, active, completed, stopped)
- `page` (default: 1): Page number
- `limit` (default: 10): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmggzkcrc0000sbanzqb7a2hc",
      "name": "Q4 Sales Campaign",
      "status": "active",
      "_count": {
        "leads": 150,
        "campaignAgents": 2
      }
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/v1/campaigns?status=active&page=1&limit=10"
```

---

### Get Campaign by ID

**GET** `/api/v1/campaigns/:id`

Get detailed information about a specific campaign.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmggzkcrc0000sbanzqb7a2hc",
    "name": "Q4 Sales Campaign",
    "status": "active",
    "leads": [...],
    "campaignAgents": [...]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc
```

---

### Update Campaign

**PUT** `/api/v1/campaigns/:id`

Update campaign details. Cannot update active campaigns.

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "description": "New description",
  "maxConcurrent": 5,
  "callDelay": 3000
}
```

**Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc \
  -H "Content-Type: application/json" \
  -d '{"maxConcurrent":5}'
```

---

### Delete Campaign

**DELETE** `/api/v1/campaigns/:id`

Delete a campaign. Cannot delete active campaigns.

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc
```

---

### Start Campaign

**POST** `/api/v1/campaigns/:id/start`

Start executing a campaign. Initiates calls to all pending leads.

**Response:**
```json
{
  "success": true,
  "message": "Campaign started successfully",
  "data": {
    "campaignId": "cmggzkcrc0000sbanzqb7a2hc",
    "totalLeads": 150,
    "maxConcurrent": 3
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/start
```

---

### Stop Campaign

**POST** `/api/v1/campaigns/:id/stop`

Stop a running campaign.

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/stop
```

---

### Pause Campaign

**POST** `/api/v1/campaigns/:id/pause`

Pause a running campaign (can be resumed later).

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/pause
```

---

### Resume Campaign

**POST** `/api/v1/campaigns/:id/resume`

Resume a paused campaign.

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/resume
```

---

### Get Campaign Stats

**GET** `/api/v1/campaigns/:id/stats`

Get real-time campaign statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLeads": 150,
    "pending": 120,
    "calling": 3,
    "completed": 25,
    "failed": 2,
    "totalCalls": 27,
    "successfulCalls": 25,
    "failedCalls": 2,
    "averageDuration": 8234,
    "realtime": {
      "total": 150,
      "completed": 25,
      "failed": 2,
      "active": 3,
      "pending": 120
    }
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/stats
```

---

## 📞 Lead Endpoints

### Add Single Lead

**POST** `/api/v1/campaigns/:campaignId/leads`

Add a single lead to a campaign.

**Request Body:**
```json
{
  "phoneNumber": "+919529117230",
  "name": "John Doe",
  "priority": 1,
  "metadata": {
    "source": "website",
    "tags": ["high-value"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lead_abc123",
    "campaignId": "cmggzkcrc0000sbanzqb7a2hc",
    "phoneNumber": "+919529117230",
    "name": "John Doe",
    "status": "pending",
    "priority": 1,
    "metadata": "{\"source\":\"website\",\"tags\":[\"high-value\"]}"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919529117230","name":"John Doe","priority":1}'
```

---

### Add Leads in Bulk

**POST** `/api/v1/campaigns/:campaignId/leads/bulk`

Add multiple leads at once.

**Request Body:**
```json
{
  "leads": [
    {
      "phoneNumber": "+919529117230",
      "name": "John Doe",
      "priority": 1
    },
    {
      "phoneNumber": "+918329823146",
      "name": "Jane Smith",
      "priority": 2
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 2,
    "total": 2
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads/bulk \
  -H "Content-Type: application/json" \
  -d '{"leads":[{"phoneNumber":"+919529117230","name":"John"},{"phoneNumber":"+918329823146","name":"Jane"}]}'
```

---

### Upload Leads from CSV

**POST** `/api/v1/campaigns/:campaignId/leads/upload`

Upload leads from a CSV file.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file`

**CSV Format:**
```csv
phoneNumber,name,priority,metadata
+919529117230,John Doe,1,{"source":"website"}
+918329823146,Jane Smith,2,{"source":"referral"}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploaded": 150,
    "total": 152,
    "errors": [
      {
        "row": {...},
        "error": "Phone number is required"
      }
    ]
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads/upload \
  -F "file=@leads.csv"
```

---

### Get Campaign Leads

**GET** `/api/v1/campaigns/:campaignId/leads`

Get all leads for a campaign.

**Query Parameters:**
- `status` (optional): Filter by status (pending, calling, completed, failed)
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead_abc123",
      "phoneNumber": "+919529117230",
      "name": "John Doe",
      "status": "pending",
      "priority": 1
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads?status=pending"
```

---

### Get Single Lead

**GET** `/api/v1/campaigns/:campaignId/leads/:leadId`

Get details of a specific lead including call history.

**Example:**
```bash
curl http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads/lead_abc123
```

---

### Update Lead

**PUT** `/api/v1/campaigns/:campaignId/leads/:leadId`

Update lead information.

**Request Body:**
```json
{
  "name": "John Updated",
  "priority": 2,
  "metadata": {"updated": true}
}
```

**Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads/lead_abc123 \
  -H "Content-Type: application/json" \
  -d '{"priority":2}'
```

---

### Delete Lead

**DELETE** `/api/v1/campaigns/:campaignId/leads/:leadId`

Delete a lead. Cannot delete if call is in progress.

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads/lead_abc123
```

---

### Delete All Leads

**DELETE** `/api/v1/campaigns/:campaignId/leads`

Delete all leads from a campaign. Cannot delete if campaign is active.

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/campaigns/cmggzkcrc0000sbanzqb7a2hc/leads
```

---

## 🤖 Agent Endpoints

### Create Agent

**POST** `/api/v1/agents`

Create a new AI agent.

**Request Body:**
```json
{
  "name": "Sales Agent",
  "description": "Handles sales inquiries",
  "voiceId": "voice_123",
  "personality": "Professional and friendly",
  "systemPrompt": "You are a helpful sales assistant..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent_xyz",
    "name": "Sales Agent",
    "isActive": true,
    "createdAt": "2025-10-07T20:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Sales Agent","description":"Handles sales"}'
```

---

### Get All Agents

**GET** `/api/v1/agents`

Get list of all agents.

**Query Parameters:**
- `isActive` (optional): Filter by active status (true/false)
- `page` (default: 1)
- `limit` (default: 10)

**Example:**
```bash
curl "http://localhost:3000/api/v1/agents?isActive=true"
```

---

### Get Agent by ID

**GET** `/api/v1/agents/:id`

Get detailed information about an agent.

**Example:**
```bash
curl http://localhost:3000/api/v1/agents/agent_xyz
```

---

### Update Agent

**PUT** `/api/v1/agents/:id`

Update agent configuration.

**Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/agents/agent_xyz \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'
```

---

### Delete Agent

**DELETE** `/api/v1/agents/:id`

Delete an agent. Cannot delete if assigned to active campaigns.

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/agents/agent_xyz
```

---

## 📊 API Features

### ✅ Implemented Features

1. **Campaign Management**
   - ✅ Create, read, update, delete campaigns
   - ✅ Start, stop, pause, resume campaigns
   - ✅ Real-time campaign statistics
   - ✅ Campaign status tracking

2. **Lead Management**
   - ✅ Add single leads
   - ✅ Bulk lead import
   - ✅ CSV upload
   - ✅ Lead CRUD operations
   - ✅ Lead status filtering

3. **Agent Management**
   - ✅ Agent CRUD operations
   - ✅ Agent-campaign assignments
   - ✅ Active/inactive status

4. **Security & Performance**
   - ✅ Helmet security headers
   - ✅ CORS enabled
   - ✅ Rate limiting
   - ✅ Request compression
   - ✅ Error handling
   - ✅ Winston logging
   - ✅ Swagger documentation

5. **Database**
   - ✅ Prisma ORM
   - ✅ SQLite (testing)
   - ✅ PostgreSQL ready
   - ✅ Database migrations

---

## 🚀 Quick Start Example

```bash
# 1. Create a campaign
CAMPAIGN_ID=$(curl -s -X POST http://localhost:3000/api/v1/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Campaign","maxConcurrent":3}' \
  | jq -r '.data.id')

# 2. Add leads
curl -X POST http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/leads/bulk \
  -H "Content-Type: application/json" \
  -d '{"leads":[
    {"phoneNumber":"+919529117230","name":"John"},
    {"phoneNumber":"+918329823146","name":"Jane"}
  ]}'

# 3. Start campaign
curl -X POST http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/start

# 4. Check stats
curl http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/stats
```

---

## 🔍 API Documentation

**Interactive API Documentation:** http://localhost:3000/api-docs

Swagger UI provides:
- Complete API reference
- Request/response examples
- Try-it-out functionality
- Schema definitions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Express.js API                       │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
   │Campaign │      │   Lead    │     │   Agent   │
   │Controller│      │Controller │     │Controller │
   └────┬────┘      └─────┬─────┘     └─────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Prisma    │
                    │     ORM     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   SQLite/   │
                    │ PostgreSQL  │
                    └─────────────┘
```

---

## 📝 Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error

---

## 🎯 Next Steps

**Recommended Additions:**
1. **Authentication** - Add JWT-based auth
2. **Webhooks** - Handle Twilio status callbacks
3. **Analytics** - Advanced reporting endpoints
4. **Scheduling** - Campaign scheduling with cron
5. **WebSockets** - Real-time campaign updates
6. **Bull Queue** - Redis-based job queue for production
7. **Tests** - API integration tests

---

## 💡 Notes

- **SQLite Limitations**: The current implementation uses SQLite for testing. Some Prisma features like `skipDuplicates` in `createMany` are not available in SQLite.
- **Metadata Storage**: JSON fields are stored as strings in SQLite. Always stringify objects before sending to the API.
- **Concurrent Calls**: The `maxConcurrent` setting controls how many simultaneous calls can be made. Recommended: 2-5.
- **Call Delay**: The `callDelay` setting (in milliseconds) controls the delay between initiating calls. Recommended: 2000-5000ms.

---

**Server Status:** ✅ Running at http://localhost:3000
**API Docs:** http://localhost:3000/api-docs
**Health Check:** http://localhost:3000/health
