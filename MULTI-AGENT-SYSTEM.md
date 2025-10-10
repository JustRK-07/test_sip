# Multi-Agent System Documentation

Complete guide to the multi-agent assignment system with rotation, load balancing, and automatic fallback.

---

## Overview

The system now supports **multiple agents per campaign** using the CampaignAgent junction table, with intelligent agent selection strategies including:

- **Primary/Backup agents** - Designate primary and backup agents
- **Round-robin rotation** - Distribute calls evenly across agents
- **Least-loaded balancing** - Route to agent with fewest active calls
- **Automatic fallback** - Switch to backup when primary is at capacity
- **Real-time load tracking** - Monitor agent availability

---

## Architecture

### Database Schema

```prisma
// Many-to-many relationship between Campaigns and Agents
model CampaignAgent {
  id          String   @id @default(cuid())
  campaignId  String
  agentId     String
  isPrimary   Boolean  @default(false)  // Primary agent flag

  campaign    Campaign @relation(...)
  agent       Agent    @relation(...)

  @@unique([campaignId, agentId])
}

model Agent {
  id                 String   @id
  name               String
  maxConcurrentCalls Int      @default(3)  // Max calls per agent
  isActive           Boolean  @default(true)
}
```

### Key Components

1. **AgentSelectionService** (`src/services/AgentSelectionService.js`)
   - Intelligent agent selection with 4 strategies
   - Real-time load balancing
   - Capacity tracking
   - Automatic fallback

2. **CampaignQueue** (`src/services/CampaignQueue.js`)
   - Dynamic agent selection per call
   - Load tracking integration
   - Backward compatible with single-agent mode

3. **InboundCallService** (`src/services/InboundCallService.js`)
   - Multi-agent support for inbound calls
   - Fallback to campaign.agentName if needed
   - Least-loaded strategy for inbound

---

## Agent Selection Strategies

### 1. PRIMARY_FIRST (Default)

Always use primary agent first, fallback to others when at capacity.

```javascript
const agent = await AgentSelectionService.selectAgentForCampaign(
  campaignId,
  SELECTION_STRATEGIES.PRIMARY_FIRST
);
```

**Flow:**
```
1. Try primary agent
   ├─ Available? → Use primary
   └─ At capacity? → Try backup agent 1
      ├─ Available? → Use backup 1
      └─ At capacity? → Try backup agent 2
```

**Use case:** Most campaigns - ensures consistent primary agent with automatic failover

### 2. ROUND_ROBIN

Rotate through all agents evenly regardless of load.

```javascript
const agent = await AgentSelectionService.selectAgentForCampaign(
  campaignId,
  SELECTION_STRATEGIES.ROUND_ROBIN
);
```

**Flow:**
```
Call 1 → Agent A
Call 2 → Agent B
Call 3 → Agent C
Call 4 → Agent A (cycles back)
```

**Use case:** Distribute load evenly across all agents

### 3. LEAST_LOADED

Always select agent with fewest active calls.

```javascript
const agent = await AgentSelectionService.selectAgentForCampaign(
  campaignId,
  SELECTION_STRATEGIES.LEAST_LOADED
);
```

**Flow:**
```
Agent A: 2 active calls
Agent B: 0 active calls  ← Selected
Agent C: 1 active call

Next call:
Agent A: 2 active calls
Agent B: 1 active call
Agent C: 1 active call   ← Selected (random between B and C)
```

**Use case:** Optimal load distribution, high-volume campaigns

### 4. RANDOM

Randomly select from available agents.

```javascript
const agent = await AgentSelectionService.selectAgentForCampaign(
  campaignId,
  SELECTION_STRATEGIES.RANDOM
);
```

**Use case:** Testing, load spreading without tracking

---

## API Endpoints

### Campaign Agent Management

#### Assign Agent to Campaign
```http
POST /api/v1/campaigns/:campaignId/agents
Content-Type: application/json

{
  "agentId": "agent-id-123",
  "isPrimary": true  // Optional, default false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "assignment-id",
    "campaignId": "campaign-id",
    "agentId": "agent-id-123",
    "isPrimary": true,
    "agent": {
      "id": "agent-id-123",
      "name": "agent-primary",
      "maxConcurrentCalls": 3
    }
  }
}
```

#### Get Campaign Agents (with availability)
```http
GET /api/v1/campaigns/:campaignId/agents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "assignment-id-1",
      "campaignId": "campaign-id",
      "agentId": "agent-id-1",
      "isPrimary": true,
      "agent": {
        "id": "agent-id-1",
        "name": "agent-primary",
        "maxConcurrentCalls": 3,
        "activeCalls": 2,          // ← Real-time
        "available": true,          // ← Can take more calls
        "loadPercentage": 67        // ← 2/3 = 67%
      }
    },
    {
      "id": "assignment-id-2",
      "isPrimary": false,
      "agent": {
        "name": "agent-backup",
        "activeCalls": 0,
        "available": true,
        "loadPercentage": 0
      }
    }
  ]
}
```

#### Get Available Agents
```http
GET /api/v1/campaigns/:campaignId/agents/available
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-id-1",
      "name": "agent-primary",
      "isPrimary": true,
      "activeCalls": 2,
      "maxConcurrentCalls": 3,
      "available": true
    }
  ],
  "summary": {
    "total": 3,
    "available": 2,
    "primary": 1
  }
}
```

#### Remove Agent from Campaign
```http
DELETE /api/v1/campaigns/:campaignId/agents/:agentId
```

### Global Agent Stats

#### Get Agent Load Statistics
```http
GET /api/v1/agents/load-stats
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-id-1",
      "name": "agent-primary",
      "maxConcurrentCalls": 3,
      "activeCalls": 2,
      "available": true,
      "loadPercentage": 67
    }
  ],
  "summary": {
    "totalAgents": 5,
    "activeAgents": 2,          // Agents with active calls
    "availableAgents": 4,       // Agents below capacity
    "totalActiveCalls": 7       // Total calls across all agents
  }
}
```

---

## Usage Examples

### Example 1: Setup Multi-Agent Campaign

```javascript
// 1. Create agents
const primaryAgent = await prisma.agent.create({
  data: {
    name: 'agent-primary',
    maxConcurrentCalls: 3,
    isActive: true
  }
});

const backupAgent = await prisma.agent.create({
  data: {
    name: 'agent-backup',
    maxConcurrentCalls: 5,
    isActive: true
  }
});

// 2. Create campaign
const campaign = await prisma.campaign.create({
  data: {
    name: 'Sales Campaign',
    maxConcurrent: 10
  }
});

// 3. Assign agents
await prisma.campaignAgent.create({
  data: {
    campaignId: campaign.id,
    agentId: primaryAgent.id,
    isPrimary: true  // Primary agent
  }
});

await prisma.campaignAgent.create({
  data: {
    campaignId: campaign.id,
    agentId: backupAgent.id,
    isPrimary: false  // Backup agent
  }
});

// 4. Start campaign - agents selected automatically!
// Campaign will use primary first, fallback to backup when needed
```

### Example 2: Monitor Agent Load

```javascript
const AgentSelectionService = require('./src/services/AgentSelectionService');

// Get current loads
const stats = AgentSelectionService.getAgentLoadStats();
console.log(stats);
// Output: { 'agent-id-1': 2, 'agent-id-2': 0 }

// Get available agents for campaign
const available = await AgentSelectionService.getAvailableAgents(campaignId);
console.log(available);
// Output: [{ name: 'agent-primary', activeCalls: 2, available: true }, ...]
```

### Example 3: Custom Strategy Per Campaign

```javascript
// Set strategy in campaign metadata
await prisma.campaign.update({
  where: { id: campaignId },
  data: {
    metadata: JSON.stringify({
      agentSelectionStrategy: 'least_loaded'
    })
  }
});

// Strategy automatically used when campaign starts
```

---

## How It Works

### Outbound Call Flow

```
1. Campaign starts
   ↓
2. For each lead:
   ↓
3. CampaignQueue.startCall(lead)
   ↓
4. AgentSelectionService.selectAgentForCampaign(campaignId, strategy)
   ├─ Query: SELECT * FROM CampaignAgent WHERE campaignId = ?
   ├─ Apply strategy (primary_first / round_robin / least_loaded)
   ├─ Check agent availability (activeCalls < maxConcurrentCalls)
   └─ Return selected agent
   ↓
5. Increment active call count
   AgentSelectionService.incrementActiveCall(agentId)
   ↓
6. Make call with selected agent
   livekitExecutor.makeCall(phone, trunk, room, agent.name)
   ↓
7. Call completes/fails
   ↓
8. Decrement active call count
   AgentSelectionService.decrementActiveCall(agentId)
```

### Inbound Call Flow

```
1. Call arrives at phone number
   ↓
2. LiveKit calls webhook
   ↓
3. InboundCallService.handleInboundCall(sipData)
   ↓
4. Look up phone number
   ├─ Find campaign association
   └─ phoneNumber.campaignId exists
   ↓
5. AgentSelectionService.selectAgentForInbound(phoneNumber)
   ├─ Uses LEAST_LOADED strategy for inbound
   ├─ Checks campaign agents
   └─ Returns agent with fewest calls
   ↓
6. Return agent name to LiveKit
   { "agent_name": "agent-primary" }
   ↓
7. Agent auto-connects
```

---

## Backward Compatibility

The system maintains **100% backward compatibility** with the old single-agent approach:

### Old Way (Still Works)
```javascript
const campaign = await prisma.campaign.create({
  data: {
    name: 'Simple Campaign',
    agentName: 'telephony-agent'  // ← Old field still works
  }
});
```

### New Way (Multi-Agent)
```javascript
const campaign = await prisma.campaign.create({
  data: {
    name: 'Advanced Campaign'
  }
});

// Assign multiple agents
await prisma.campaignAgent.createMany({
  data: [
    { campaignId: campaign.id, agentId: agent1.id, isPrimary: true },
    { campaignId: campaign.id, agentId: agent2.id, isPrimary: false }
  ]
});
```

### Selection Priority

```
1. CampaignAgent assignments (if exist)
   ↓ Use AgentSelectionService
2. campaign.agentName (if set)
   ↓ Use hardcoded agent
3. Tenant default agent (if exists)
   ↓ Query first active agent
4. System default 'telephony-agent'
   ↓ Fallback
```

---

## Testing

### Run Multi-Agent Test

```bash
node backend/test-multi-agent-campaign.js
```

**What it tests:**
- ✅ Multiple agents per campaign
- ✅ Primary agent assignment
- ✅ All 4 selection strategies
- ✅ Load balancing
- ✅ Capacity limits and fallback
- ✅ Available agents query
- ✅ Inbound call agent selection

### Manual Testing

```bash
# 1. Create agents via API
curl -X POST http://localhost:3001/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "agent-1", "maxConcurrentCalls": 3}'

# 2. Assign to campaign
curl -X POST http://localhost:3001/api/v1/campaigns/CAMPAIGN_ID/agents \
  -H "Content-Type: application/json" \
  -d '{"agentId": "AGENT_ID", "isPrimary": true}'

# 3. Check availability
curl http://localhost:3001/api/v1/campaigns/CAMPAIGN_ID/agents/available

# 4. Monitor load
curl http://localhost:3001/api/v1/agents/load-stats
```

---

## Configuration

### Agent Capacity

Set max concurrent calls per agent:

```javascript
await prisma.agent.update({
  where: { id: agentId },
  data: {
    maxConcurrentCalls: 10  // Increase capacity
  }
});
```

### Campaign Strategy

Set default strategy in campaign metadata:

```javascript
await prisma.campaign.update({
  where: { id: campaignId },
  data: {
    metadata: JSON.stringify({
      agentSelectionStrategy: 'least_loaded'  // or 'round_robin', 'primary_first', 'random'
    })
  }
});
```

---

## Benefits

### 1. High Availability
- **Automatic fallback** - No manual intervention when primary agent fails
- **No dropped calls** - System always finds an available agent

### 2. Load Distribution
- **Prevent overload** - Respects maxConcurrentCalls limits
- **Efficient utilization** - Distributes calls across agents

### 3. Scalability
- **Add agents dynamically** - No code changes needed
- **Campaign-specific** - Different agents per campaign

### 4. Monitoring
- **Real-time visibility** - See active calls per agent
- **Load percentage** - Know when agents are near capacity
- **Availability status** - Which agents can take more calls

### 5. Flexibility
- **Multiple strategies** - Choose best approach per campaign
- **Mix and match** - Primary + backups, or pure rotation
- **Easy migration** - Old campaigns continue to work

---

## Production Recommendations

### 1. Agent Capacity Planning

```javascript
// Low-volume campaign
agent.maxConcurrentCalls = 1-3

// Medium-volume campaign
agent.maxConcurrentCalls = 5-10

// High-volume campaign
agent.maxConcurrentCalls = 20+
```

### 2. Strategy Selection

| Scenario | Recommended Strategy |
|----------|---------------------|
| **Single primary agent with backup** | PRIMARY_FIRST |
| **Equal load distribution** | ROUND_ROBIN |
| **High volume, multiple agents** | LEAST_LOADED |
| **Inbound calls** | LEAST_LOADED |

### 3. Monitoring Setup

```javascript
// Poll load stats every 10 seconds
setInterval(async () => {
  const response = await fetch('http://localhost:3001/api/v1/agents/load-stats');
  const data = await response.json();

  // Alert if any agent over 80% capacity
  const overloaded = data.data.filter(a => a.loadPercentage > 80);
  if (overloaded.length > 0) {
    console.warn('⚠️  Agents near capacity:', overloaded);
  }
}, 10000);
```

### 4. Database Indexes

Already configured in schema:
```prisma
@@index([campaignId, agentId])  // Fast lookups
@@index([isPrimary])            // Quick primary agent queries
```

---

## Migration Guide

### Migrating Existing Campaigns

```javascript
// For each campaign with agentName set:
const campaigns = await prisma.campaign.findMany({
  where: { agentName: { not: null } }
});

for (const campaign of campaigns) {
  // Find or create agent
  let agent = await prisma.agent.findFirst({
    where: { name: campaign.agentName }
  });

  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        name: campaign.agentName,
        isActive: true,
        maxConcurrentCalls: 5
      }
    });
  }

  // Create CampaignAgent assignment
  await prisma.campaignAgent.create({
    data: {
      campaignId: campaign.id,
      agentId: agent.id,
      isPrimary: true
    }
  });

  // Optional: Clear old agentName field
  // await prisma.campaign.update({
  //   where: { id: campaign.id },
  //   data: { agentName: null }
  // });
}
```

---

## Summary

✅ **Multi-agent support** - Multiple agents per campaign
✅ **4 selection strategies** - PRIMARY_FIRST, ROUND_ROBIN, LEAST_LOADED, RANDOM
✅ **Real-time load tracking** - Active calls per agent
✅ **Automatic fallback** - When primary at capacity
✅ **Backward compatible** - Old campaigns still work
✅ **REST API** - Full management endpoints
✅ **Tested** - Comprehensive test suite
✅ **Production-ready** - Used in both outbound and inbound flows

**Status: FULLY IMPLEMENTED AND TESTED! 🎉**
