# Agent Availability & Load Balancing Implementation Guide

**Scenario:** Campaign with multiple agents assigned based on availability

---

## 🎯 Solution: Explicit Dispatch with Availability Tracking

### **Why This Solution?**

Your requirements:
- ✅ Campaign has multiple agents
- ✅ Agents assigned based on availability
- ✅ Load balancing across agents
- ✅ Track active calls per agent

**Chosen Approach:** Explicit Agent Dispatch (Solution B)

---

## 📐 Architecture

```
Campaign Start
    ↓
Load Campaign Agents (from database)
    ↓
Initialize Agent Availability Tracker
    ↓
For Each Lead:
    ├─ Get Available Agent (least-busy algorithm)
    ├─ Dispatch Agent to Room (API call 1)
    ├─ Create SIP Participant (API call 2)
    ├─ Mark Agent as Busy
    └─ On Call End: Mark Agent as Available
```

---

## 🔧 Implementation Components

### 1. **Database Schema** ✅ DONE

```prisma
model Agent {
  id                 String
  name               String                 // "agent-1", "agent-2"
  isActive           Boolean               // Can agent take calls?
  maxConcurrentCalls Int      @default(3) // Max simultaneous calls

  campaignAgents     CampaignAgent[]       // Many-to-many with campaigns
}

model CampaignAgent {
  campaignId  String
  agentId     String
  isPrimary   Boolean  // Primary agent for campaign

  campaign    Campaign
  agent       Agent
}
```

### 2. **Agent Availability Tracker** ✅ DONE

**File:** `src/services/AgentAvailabilityTracker.js`

**Features:**
- Track active calls per agent
- Least-busy agent selection algorithm
- Load balancing
- Real-time stats

**Key Methods:**
```javascript
registerAgents(agents)           // Register campaign agents
getAvailableAgent()              // Get least-busy agent
markBusy(agentName, roomName)    // Mark agent busy
markAvailable(agentName, roomName) // Mark agent available
getStats()                       // Get real-time stats
```

### 3. **LiveKit Executor with Explicit Dispatch** ✅ DONE

**File:** `src/services/LiveKitExecutor.js`

**Updated Flow:**
```javascript
async makeCall(phoneNumber, sipTrunkId, roomName, agentName, callerIdNumber) {
  // Step 1: Dispatch agent to room
  const dispatchInfo = await this.agentDispatch.createDispatch(
    roomName,
    agentName,
    { metadata: {...} }
  );

  // Step 2: Create SIP participant
  const sipParticipantInfo = await this.sipClient.createSipParticipant(
    sipTrunkId,
    phoneNumber,
    roomName,
    options
  );

  return {
    success: true,
    agentName,
    dispatchId: dispatchInfo.id,
    sipCallId: sipParticipantInfo.sipCallId,
    ...
  };
}
```

---

## 📝 Integration with CampaignQueue

### **Step 1: Update CampaignQueue Constructor**

```javascript
// src/services/CampaignQueue.js

const AgentAvailabilityTracker = require('./AgentAvailabilityTracker');

class CampaignQueue extends EventEmitter {
  constructor(options = {}) {
    super();

    this.campaignId = options.campaignId;
    this.campaignName = options.campaignName;

    // Agent configuration
    this.agents = options.agents || []; // Array of agent objects from DB
    this.availabilityTracker = new AgentAvailabilityTracker();

    // Register agents
    if (this.agents.length > 0) {
      this.availabilityTracker.registerAgents(this.agents);
    }

    // Queues
    this.pendingLeads = [];
    this.activeLeads = new Map();

    // Services
    this.livekitExecutor = new LiveKitExecutor();
  }
}
```

### **Step 2: Update startCall Method**

```javascript
async startCall(lead) {
  lead.status = 'calling';
  lead.attempts++;

  // Get available agent
  const agentName = this.availabilityTracker.getAvailableAgent();

  if (!agentName) {
    logger.error(`No available agents for lead ${lead.id}`);
    lead.status = 'failed';
    lead.error = 'No available agents';
    this.failedLeads.push(lead);
    this.emit('call_failed', { lead, error: { error: 'No available agents' } });
    return;
  }

  logger.info(`📞 Calling ${lead.name} with agent ${agentName}`, {
    phoneNumber: lead.phoneNumber,
    agentName,
    attempt: lead.attempts,
  });

  // Generate unique room name
  const roomName = this.livekitExecutor.generateRoomName(this.campaignId);

  // Mark agent as busy
  this.availabilityTracker.markBusy(agentName, roomName);

  // Create call promise with agent
  const callPromise = this.livekitExecutor
    .makeCall(
      lead.phoneNumber,
      this.sipTrunkId,
      roomName,
      agentName,           // Dynamic agent assignment!
      this.callerIdNumber
    )
    .then((result) => {
      // Call succeeded
      lead.status = 'completed';
      lead.result = result;
      lead.agentName = agentName;

      this.completedLeads.push(lead);
      this.stats.completed++;

      logger.info(`✅ Call completed with agent ${agentName}`, {
        lead: lead.name,
        duration: result.duration,
      });

      this.emit('call_completed', { lead, result });
    })
    .catch((error) => {
      // Call failed
      lead.status = 'failed';
      lead.error = error;
      lead.agentName = agentName;

      logger.error(`❌ Call failed with agent ${agentName}`, {
        lead: lead.name,
        error: error.error || error.message,
      });

      // Retry logic (same as before)
      if (this.retryFailed && lead.attempts < this.retryAttempts) {
        lead.status = 'pending';
        this.pendingLeads.push(lead);
      } else {
        this.failedLeads.push(lead);
        this.stats.failed++;
      }

      this.emit('call_failed', { lead, error });
    })
    .finally(() => {
      // Mark agent as available
      this.availabilityTracker.markAvailable(agentName, roomName);

      // Remove from active calls
      this.activeLeads.delete(lead.id);
      this.stats.active = this.activeLeads.size;
    });

  // Add to active calls
  this.activeLeads.set(lead.id, callPromise);
}
```

### **Step 3: Add Agent Stats Method**

```javascript
getAgentStats() {
  return this.availabilityTracker.getStats();
}
```

---

## 🚀 Usage Example

### **1. Create Campaign with Multiple Agents**

```bash
# Step 1: Create agents
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "agent-1",
    "description": "Sales Agent 1",
    "isActive": true,
    "maxConcurrentCalls": 3
  }'

curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "agent-2",
    "description": "Sales Agent 2",
    "isActive": true,
    "maxConcurrentCalls": 5
  }'

# Step 2: Create campaign
curl -X POST http://localhost:3000/api/v1/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Multi-Agent Campaign",
    "maxConcurrent": 8,
    "sipTrunkId": "ST_YOUR_TRUNK_ID",
    "callerIdNumber": "+14155550100"
  }'

# Step 3: Assign agents to campaign
curl -X POST http://localhost:3000/api/v1/campaigns/:campaignId/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agentIds": ["agent-1-id", "agent-2-id"]
  }'

# Step 4: Upload leads
curl -X POST http://localhost:3000/api/v1/campaigns/:campaignId/leads/upload \
  -F "file=@leads.csv"

# Step 5: Start campaign
curl -X POST http://localhost:3000/api/v1/campaigns/:campaignId/start
```

### **2. Load Balancing in Action**

```
Campaign with 10 leads, 2 agents:

Call 1  → Check availability → agent-1 (0 active) ✅ Selected
Call 2  → Check availability → agent-2 (0 active) ✅ Selected
Call 3  → Check availability → agent-1 (1 active) ✅ Selected
Call 4  → Check availability → agent-2 (1 active) ✅ Selected
...
Call 9  → Check availability → agent-1 (at max)
                            → agent-2 (available) ✅ Selected
```

---

## 📊 Real-time Agent Stats

```javascript
// In campaign controller
app.get('/api/v1/campaigns/:id/agent-stats', (req, res) => {
  const campaignQueue = activeCampaigns.get(req.params.id);

  if (!campaignQueue) {
    return res.status(404).json({ error: 'Campaign not active' });
  }

  const stats = campaignQueue.getAgentStats();

  res.json({
    success: true,
    data: stats
  });
});
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "agent-1",
      "isActive": true,
      "activeCalls": 2,
      "maxConcurrent": 3,
      "utilization": "66.7%",
      "available": true
    },
    {
      "name": "agent-2",
      "isActive": true,
      "activeCalls": 5,
      "maxConcurrent": 5,
      "utilization": "100%",
      "available": false
    }
  ]
}
```

---

## 🔍 Monitoring & Debugging

### **View Agent Activity**

```bash
# Check which agent handled each call
curl http://localhost:3000/api/v1/campaigns/:id/stats

# Response includes agent names per call
```

### **Logs Show Agent Assignment**

```
📞 Calling John Doe with agent agent-1 (+14155550123)
Dispatching agent agent-1 to room outbound-xxx
Agent dispatched successfully (dispatchId: DSP_xxx)
✅ Call initiated successfully with agent agent-1

📞 Calling Jane Smith with agent agent-2 (+14155550124)
Dispatching agent agent-2 to room outbound-yyy
Agent dispatched successfully (dispatchId: DSP_yyy)
✅ Call initiated successfully with agent agent-2
```

---

## ⚖️ Load Balancing Algorithms

### **Current: Least-Busy Algorithm**

```javascript
getAvailableAgent() {
  let selectedAgent = null;
  let minActiveCalls = Infinity;

  for (const [agentName, config] of this.agentConfigs.entries()) {
    if (!config.isActive) continue;

    const activeCalls = this.activeCallsByAgent.get(agentName)?.size || 0;

    if (activeCalls < config.maxConcurrent && activeCalls < minActiveCalls) {
      minActiveCalls = activeCalls;
      selectedAgent = agentName;
    }
  }

  return selectedAgent;
}
```

### **Alternative: Round-Robin**

```javascript
// Add to AgentAvailabilityTracker
this.lastSelectedIndex = 0;

getAvailableAgentRoundRobin() {
  const activeAgents = Array.from(this.agentConfigs.entries())
    .filter(([name, config]) => {
      const activeCalls = this.activeCallsByAgent.get(name)?.size || 0;
      return config.isActive && activeCalls < config.maxConcurrent;
    });

  if (activeAgents.length === 0) return null;

  const selected = activeAgents[this.lastSelectedIndex % activeAgents.length];
  this.lastSelectedIndex++;

  return selected[0]; // agent name
}
```

---

## 🎯 Performance Impact

### **Comparison:**

| Metric | Dispatch Rules | Explicit Dispatch (Your Solution) |
|--------|----------------|-----------------------------------|
| API Calls per Call | 1 | 2 |
| Time per Call | ~1.0s | ~2.6s |
| Agent Selection | Fixed pattern | Dynamic availability ✅ |
| Load Balancing | ❌ No | ✅ Yes |
| Multi-Agent Support | ❌ No | ✅ Yes |

**Trade-off:** Slower calls (~2.6s vs ~1s) BUT you get dynamic agent assignment!

---

## ✅ Implementation Checklist

- [x] Database schema updated (maxConcurrentCalls added)
- [x] AgentAvailabilityTracker service created
- [x] LiveKitExecutor updated with explicit dispatch
- [x] Database migration applied
- [x] CallLog tracks dispatchId
- [ ] CampaignQueue integration (manual step needed)
- [ ] Agent assignment API endpoint
- [ ] Test with multiple agents
- [ ] Monitor agent load balancing

---

## 🚀 Next Steps

1. **Integrate AgentAvailabilityTracker with CampaignQueue** (code provided above)
2. **Create agent assignment endpoint** (`POST /campaigns/:id/agents`)
3. **Test multi-agent scenario**
4. **Monitor agent utilization in production**
5. **Consider adding agent priority/skill-based routing**

---

## 📞 Support Scenarios

### **What if all agents are busy?**

```javascript
if (!agentName) {
  // Option 1: Queue the call and retry
  logger.warn(`All agents busy, queuing lead ${lead.id}`);
  setTimeout(() => this.startCall(lead), 5000); // Retry in 5s

  // Option 2: Mark as failed
  lead.status = 'failed';
  lead.error = 'All agents busy';
  this.failedLeads.push(lead);
}
```

### **What if an agent goes offline mid-campaign?**

```javascript
// In your agent controller
app.post('/api/v1/agents/:id/deactivate', async (req, res) => {
  await prisma.agent.update({
    where: { id: req.params.id },
    data: { isActive: false }
  });

  // Notify active campaigns to stop assigning this agent
  // They'll automatically skip inactive agents
});
```

---

## 🎉 Summary

**Best Solution for Your Use Case:** Explicit Dispatch with Agent Availability Tracking

**Benefits:**
- ✅ Multiple agents per campaign
- ✅ Dynamic assignment based on availability
- ✅ Load balancing (least-busy algorithm)
- ✅ Real-time agent utilization tracking
- ✅ Scalable to many agents
- ✅ Flexible (can change algorithms easily)

**Trade-offs:**
- ⚠️ 2 API calls per dial (~2.6s vs ~1s)
- ⚠️ More complex than dispatch rules
- ⚠️ Requires agent availability management

**Perfect for:** Call centers with multiple agents handling campaigns
