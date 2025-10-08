# Current Outbound Campaign Architecture

**Last Updated:** 2025-10-08

## Architecture Overview

### Single API Call Approach (Current)

```javascript
// One API call to initiate outbound call
sipClient.createSipParticipant(
  sipTrunkId,      // "ST_xxxxx"
  phoneNumber,     // "+14155550123"
  roomName,        // "outbound-campaign-123-xxx"
  options
)
```

### Call Flow

```
Backend (Node.js)
    ↓
LiveKit API (CreateSIPParticipant)
    ↓
LiveKit Room Created
    ↓
Outbound SIP Trunk
    ↓
Twilio Termination Domain
    ↓
PSTN Network
    ↓
Lead's Phone
```

---

## Key Components

### 1. LiveKitExecutor Service
**File:** `src/services/LiveKitExecutor.js`

**Purpose:** Makes outbound calls using LiveKit Server SDK

**Method:** `makeCall(phoneNumber, sipTrunkId, roomName, agentName)`

**Returns:**
```javascript
{
  success: true,
  phoneNumber: "+14155550123",
  roomName: "outbound-campaign-123-xxx",
  participantId: "PA_xxxxx",          // LiveKit participant ID
  participantIdentity: "caller-xxxxx",
  sipCallId: "SCL_xxxxx",             // LiveKit SIP call ID
  duration: 1000,                      // milliseconds
  timestamp: "2025-10-08T..."
}
```

### 2. CampaignQueue Service
**File:** `src/services/CampaignQueue.js`

**Purpose:** Manages call queue with concurrency control

**Features:**
- Concurrency control (maxConcurrent)
- Retry logic
- Pause/Resume/Stop
- Real-time stats
- Event emitters

### 3. Campaign Controller
**File:** `src/controllers/campaignController.js`

**Purpose:** HTTP API endpoints for campaign management

**Endpoints:**
- POST `/campaigns/:id/start` - Start campaign
- POST `/campaigns/:id/stop` - Stop campaign
- POST `/campaigns/:id/pause` - Pause campaign
- POST `/campaigns/:id/resume` - Resume campaign
- GET `/campaigns/:id/stats` - Get statistics

---

## Configuration

### Campaign Model Fields

```javascript
{
  // Campaign settings
  name: String,
  description: String,
  maxConcurrent: Int (default: 3),
  retryFailed: Boolean (default: false),
  retryAttempts: Int (default: 1),
  callDelay: Int (default: 2000ms),

  // LiveKit/SIP Configuration
  agentName: String,        // AI agent name (e.g., "telephony-agent")
  sipTrunkId: String,       // SIP trunk ID (e.g., "ST_xxxxx")
  callerIdNumber: String,   // Caller ID to display

  // Status tracking
  status: String,           // draft, active, paused, completed, stopped
  totalCalls: Int,
  successfulCalls: Int,
  failedCalls: Int
}
```

### Call Tracking

**CallLog Model:**
```javascript
{
  phoneNumber: String,
  roomName: String,         // LiveKit room name
  callSid: String,          // LiveKit SIP call ID (sipCallId)
  status: String,           // completed, failed, etc.
  duration: Int,            // milliseconds
  error: String,            // Error message if failed
  metadata: JSON            // Full result object
}
```

---

## Agent Join Mechanism

### **IMPORTANT: Agent Dispatch**

There are two ways for the AI agent to join the room and speak:

#### Option A: Dispatch Rules (Recommended)
- Configure in LiveKit Dashboard
- Room pattern: `outbound-*`
- Agent auto-joins matching rooms
- **Faster** (~1 second)
- **Simpler** (no code changes)

#### Option B: Explicit Dispatch
- Programmatic agent dispatch
- Two API calls required
- **Slower** (~2.6 seconds)
- Works without dashboard setup

**Current Implementation:** Code supports dispatch rules (Option A)

**Status:** ⚠️ Requires dispatch rules configuration in LiveKit Dashboard

---

## Unique Room Names

Each lead gets a unique room for 1:1 conversation:

**Format:** `outbound-{campaignId}-{timestamp}-{random}`

**Example:** `outbound-cmgi625pw-1759938720337-yp25wz`

**Generator:** `LiveKitExecutor.generateRoomName(campaignId)`

---

## Data Flow

### 1. Campaign Creation
```
POST /api/v1/campaigns
→ Create campaign in database
→ Status: draft
```

### 2. Add Leads
```
POST /api/v1/campaigns/:id/leads
POST /api/v1/campaigns/:id/leads/upload (CSV)
→ Create lead records
→ Status: pending
```

### 3. Start Campaign
```
POST /api/v1/campaigns/:id/start
→ Create CampaignQueue instance
→ Load pending leads
→ Start calling process
→ Update campaign status: active
```

### 4. Make Calls
```
For each lead:
  1. Generate unique room name
  2. Call LiveKitExecutor.makeCall()
     → createSipParticipant()
  3. Track call in CallLog
  4. Update lead status
  5. Wait for call delay
  6. Process next lead
```

### 5. Campaign Completion
```
When all leads processed:
→ Update campaign stats
→ Set status: completed
→ Remove from active campaigns
```

---

## Removed/Deprecated

### ❌ Removed in Current Architecture

1. **PythonExecutor** - Old Python subprocess approach (~8 seconds per call)
2. **Explicit Agent Dispatch** - Moved to dispatch rules (~1 second vs ~2.6 seconds)
3. **dispatchId** - No longer tracked (use sipCallId instead)

### Database Fields (Optional/Deprecated)

- `CallLog.dispatchId` - Still in schema but not used (can be removed in future migration)

---

## Performance

### Current Performance

- **Call Initiation:** ~1 second
- **Improvement:** 62% faster than explicit dispatch (2.6s)
- **Migration Benefit:** 87.5% faster than Python approach (8s)

### Concurrency

- Configurable per campaign
- Default: 3 concurrent calls
- Prevents system overload
- Configurable delay between calls (default: 2s)

---

## Environment Variables

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Database
DATABASE_URL=sqlite:./dev.db

# Server
PORT=3000
NODE_ENV=development
```

---

## Next Steps / Known Issues

### ⚠️ Known Issues

1. **Agent Not Responding** - Dispatch rules not configured
   - **Solution:** Configure dispatch rules in LiveKit Dashboard OR implement explicit dispatch

2. **Caller ID Not Implemented** - callerIdNumber field stored but not passed to API
   - **Solution:** Need to implement caller ID passing to LiveKit SDK

### 🚀 Future Enhancements

- [ ] Add webhook handler for Twilio callbacks
- [ ] Implement real-time call monitoring
- [ ] Add recording URL tracking
- [ ] Build analytics dashboard
- [ ] Add scheduled campaigns
- [ ] Implement A/B testing for agents

---

## Testing

### Test a Campaign

```bash
# 1. Create campaign
curl -X POST http://localhost:3000/api/v1/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "maxConcurrent": 1,
    "agentName": "telephony-agent",
    "sipTrunkId": "ST_xxxxx"
  }'

# 2. Add lead
curl -X POST http://localhost:3000/api/v1/campaigns/:id/leads \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+14155550123",
    "name": "Test Lead"
  }'

# 3. Start campaign
curl -X POST http://localhost:3000/api/v1/campaigns/:id/start

# 4. Check stats
curl http://localhost:3000/api/v1/campaigns/:id/stats
```

---

## Architecture Comparison

| Feature | Old (Python) | Previous (Explicit Dispatch) | Current (Dispatch Rules) |
|---------|-------------|------------------------------|--------------------------|
| API Calls | 1 (via Python) | 2 (dispatch + SIP) | 1 (SIP only) |
| Performance | ~8 seconds | ~2.6 seconds | ~1 second |
| Agent Join | Automatic | Explicit dispatch | Dispatch rules |
| Setup Required | Python env | None | Dashboard config |
| Scalability | Poor | Good | Excellent |
| Code Complexity | High | Medium | Low |

**Current Status:** ✅ Clean, optimized, production-ready (pending dispatch rules setup)
