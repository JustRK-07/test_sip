# Complete Call Flow: Caller → Webhook → Agent

**Simple, focused flow showing every step from dialing to agent connection**

---

## 🔄 The Complete Journey

```
📱 CALLER DIALS
    ↓
☁️ TWILIO RECEIVES
    ↓
🔗 TWILIO TRUNK ROUTES
    ↓
🎙️ LIVEKIT SIP RECEIVES
    ↓
📡 LIVEKIT CALLS WEBHOOK
    ↓
🖥️ YOUR BACKEND PROCESSES
    ↓
📤 BACKEND RESPONDS
    ↓
🤖 LIVEKIT DISPATCHES AGENT
    ↓
💬 AGENT CONNECTS
    ↓
🎉 CONVERSATION STARTS
```

---

## Detailed Flow with Data

### Step 1: Caller Dials Number

```
┌─────────────────────────┐
│  📱 Person with Phone   │
│                         │
│  Action: Dials number   │
│  Number: +1XXXXXXXXXX   │
│                         │
│  Phone carrier:         │
│  AT&T / Verizon / etc.  │
└────────────┬────────────┘
             │
             │ [Voice call over PSTN]
             ↓
```

**What happens:**
- Someone picks up their phone
- Dials: `+1 (858) 879-6658`
- Their phone carrier initiates call
- Call goes through public telephone network

**Time elapsed:** 0 seconds

---

### Step 2: Twilio Receives Call

```
             ↓
┌──────────────────────────────────────┐
│  ☁️ TWILIO CLOUD                     │
│                                       │
│  Incoming Call Detected:              │
│    FROM: +15551234567                │
│    TO:   +1XXXXXXXXXX                │
│                                       │
│  Looking up phone number...           │
│                                       │
│  ✅ Found: +1XXXXXXXXXX              │
│     Owner: Your Account               │
│     SID: PNa636a188160685c...        │
│     Trunk: TKb7dce640389bbae...      │
└────────────┬─────────────────────────┘
             │
             │ [Call accepted, routing to trunk]
             ↓
```

**What happens:**
- Twilio's infrastructure receives the call
- Looks up the phone number `+1XXXXXXXXXX`
- Finds it belongs to your account
- Sees it's configured with a SIP trunk
- Decision: Route to trunk (not webhook URL)

**Time elapsed:** ~0.1 seconds

**Data at this point:**
```json
{
  "from": "+15551234567",
  "to": "+1XXXXXXXXXX",
  "call_sid": "CAxxxxxxxxxxxxxxxx",
  "direction": "inbound"
}
```

---

### Step 3: Twilio Trunk Routes to LiveKit

```
             ↓
┌──────────────────────────────────────┐
│  🔗 TWILIO SIP TRUNK                 │
│                                       │
│  Trunk SID: TKb7dce640389bbae...     │
│                                       │
│  Origination URI:                     │
│  sip:your-sip-domain.sip.livekit.cloud   │
│                                       │
│  Sending SIP INVITE →                │
└────────────┬─────────────────────────┘
             │
             │ [SIP Protocol]
             │ [Over Internet]
             ↓
```

**What happens:**
- Trunk looks up its Origination URI
- Initiates SIP INVITE to LiveKit's SIP server
- Converts phone call to SIP protocol
- Sends call details in SIP headers

**Time elapsed:** ~0.2 seconds

**SIP INVITE Message:**
```
INVITE sip:+1XXXXXXXXXX@your-sip-domain.sip.livekit.cloud SIP/2.0
From: <sip:+15551234567@twilio.com>
To: <sip:+1XXXXXXXXXX@your-sip-domain.sip.livekit.cloud>
Call-ID: unique-call-identifier-12345
Content-Type: application/sdp

[SDP: Audio codec information]
```

---

### Step 4: LiveKit SIP Receives Call

```
             ↓
┌──────────────────────────────────────┐
│  🎙️ LIVEKIT SIP PLATFORM            │
│                                       │
│  SIP URI: your-sip-domain.sip...         │
│                                       │
│  Received SIP INVITE                  │
│  Inbound Trunk: ST_YOUR_INBOUND_TRUNK_ID      │
│                                       │
│  Actions:                             │
│  1. Accept SIP INVITE                 │
│  2. Create room: sip-abc123          │
│  3. Add SIP participant               │
│  4. Look up webhook URL               │
└────────────┬─────────────────────────┘
             │
             │ [Webhook configured for trunk]
             │ [Need to know which agent to connect]
             ↓
```

**What happens:**
- LiveKit SIP server receives INVITE
- Trunk `ST_YOUR_INBOUND_TRUNK_ID` accepts the call
- Creates a room: `sip-room-abc123` (auto-generated name)
- Adds caller as SIP participant in room
- Needs to know which AI agent to dispatch
- Looks up webhook URL configured for this trunk

**Time elapsed:** ~0.3 seconds

**Room State:**
```json
{
  "room_name": "sip-room-abc123",
  "participants": [
    {
      "identity": "sip-participant-+15551234567",
      "kind": "sip",
      "audio": "connected"
    }
  ],
  "status": "waiting_for_agent"
}
```

---

### Step 5: LiveKit Calls Your Webhook

```
             ↓
┌──────────────────────────────────────┐
│  📡 HTTP POST REQUEST                │
│                                       │
│  POST https://your-domain.com/       │
│       api/v1/webhooks/               │
│       livekit/sip-inbound            │
│                                       │
│  Headers:                             │
│    Content-Type: application/json    │
│                                       │
│  Body:                                │
│  {                                    │
│    "call_id": "SIP-12345",           │
│    "trunk_id": "ST_YOUR_INBOUND_TRUNK_ID",    │
│    "from_number": "+15551234567",    │
│    "to_number": "+1XXXXXXXXXX",      │
│    "room_name": "sip-room-abc123",   │
│    "timestamp": "2025-10-09T..."     │
│  }                                    │
└────────────┬─────────────────────────┘
             │
             │ [Waiting for response...]
             │ [Max timeout: 10 seconds]
             ↓
```

**What happens:**
- LiveKit makes HTTP POST to your webhook
- Sends all call details
- Waits for your server to respond
- Response will tell LiveKit which agent to dispatch

**Time elapsed:** ~0.4 seconds

**Webhook Payload Breakdown:**
```javascript
{
  call_id: "SIP-12345",              // Unique identifier for this call
  trunk_id: "ST_YOUR_INBOUND_TRUNK_ID",       // Which trunk received it
  trunk_phone_number: "+1XXXXXXXXXX", // Your number
  from_number: "+15551234567",        // Caller's number
  to_number: "+1XXXXXXXXXX",          // Your number (same as above)
  room_name: "sip-room-abc123",       // LiveKit room name
  timestamp: "2025-10-09T15:30:00Z"   // When call arrived
}
```

---

### Step 6: Your Backend Receives Webhook

```
             ↓
┌──────────────────────────────────────────────┐
│  🖥️ YOUR EXPRESS.JS SERVER                   │
│                                               │
│  Route: POST /api/v1/webhooks/               │
│         livekit/sip-inbound                   │
│                                               │
│  File: src/routes/webhookRoutes.js           │
│                                               │
│  Code executing:                              │
│  ┌─────────────────────────────────────┐    │
│  │ router.post('/livekit/sip-inbound', │    │
│  │   async (req, res) => {              │    │
│  │     const sipData = req.body;        │    │
│  │     const response = await           │    │
│  │       InboundCallService             │    │
│  │         .handleInboundCall(sipData); │    │
│  │     res.json(response);              │    │
│  │   }                                  │    │
│  │ );                                   │    │
│  └─────────────────────────────────────┘    │
└────────────┬──────────────────────────────────┘
             │
             │ [Calling service layer]
             ↓
```

**What happens:**
- Express.js route handler receives POST request
- Extracts `sipData` from request body
- Calls `InboundCallService.handleInboundCall()`
- Service will process and return response

**Time elapsed:** ~0.41 seconds

---

### Step 7: Backend Looks Up Phone Number

```
             ↓
┌────────────────────────────────────────────────┐
│  🔍 DATABASE LOOKUP                            │
│                                                 │
│  File: src/services/InboundCallService.js      │
│                                                 │
│  Step 7.1: Normalize Phone Number              │
│  ┌──────────────────────────────────────┐     │
│  │ Input:  "+1XXXXXXXXXX"               │     │
│  │ Output: "+1XXXXXXXXXX" (E.164)       │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Step 7.2: Query Database                      │
│  ┌──────────────────────────────────────┐     │
│  │ SELECT * FROM phone_numbers          │     │
│  │ WHERE number = '+1XXXXXXXXXX'        │     │
│  │ INCLUDE tenant, campaign             │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Step 7.3: Result Found ✅                     │
│  ┌──────────────────────────────────────┐     │
│  │ PhoneNumber {                        │     │
│  │   id: "cmgjk2lp30001sbfwxx2kbajs",  │     │
│  │   number: "+1XXXXXXXXXX",           │     │
│  │   tenant: {                          │     │
│  │     id: "7c8693c6...",              │     │
│  │     name: "Ytel QA Team"            │     │
│  │   },                                 │     │
│  │   campaign: {                        │     │
│  │     id: "cmgjk3k1m...",             │     │
│  │     name: "Phone Number Test",      │     │
│  │     agentName: "telephony-agent"    │     │
│  │   }                                  │     │
│  │ }                                    │     │
│  └──────────────────────────────────────┘     │
└────────────┬───────────────────────────────────┘
             │
             │ [Phone found, has campaign]
             ↓
```

**What happens:**
- Service normalizes the phone number format
- Queries `phone_numbers` table
- Finds record with tenant and campaign info
- Campaign has `agentName: "telephony-agent"`

**Time elapsed:** ~0.45 seconds (database query ~40ms)

**Code:**
```javascript
const phoneNumber = await prisma.phoneNumber.findUnique({
  where: { number: "+1XXXXXXXXXX" },
  include: {
    tenant: { select: { id: true, name: true } },
    campaign: { select: { id: true, name: true, agentName: true } }
  }
});
// Returns: { number: "+1XXXXXXXXXX", campaign: { agentName: "telephony-agent" } }
```

---

### Step 8: Backend Determines Which Agent

```
             ↓
┌────────────────────────────────────────────────┐
│  🤖 AGENT SELECTION LOGIC                      │
│                                                 │
│  Priority 1: Campaign's Agent                  │
│  ┌──────────────────────────────────────┐     │
│  │ if (phoneNumber.campaign?.agentName) │     │
│  │   return "telephony-agent"; ✅       │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Priority 2: Tenant's Default Agent            │
│  (skipped - already found agent)               │
│                                                 │
│  Priority 3: System Default                    │
│  (skipped - already found agent)               │
│                                                 │
│  Selected Agent: "telephony-agent" ✅          │
└────────────┬───────────────────────────────────┘
             │
             │ [Agent determined]
             ↓
```

**What happens:**
- Service checks if campaign has agent name
- Found: `"telephony-agent"`
- Decision made immediately
- No need to check other priorities

**Time elapsed:** ~0.46 seconds

**Code:**
```javascript
async getAgentForCall(phoneNumber) {
  // Priority 1: Campaign's agent
  if (phoneNumber.campaign?.agentName) {
    return phoneNumber.campaign.agentName; // "telephony-agent"
  }

  // Priority 2: Tenant default (skipped)
  // Priority 3: System default (skipped)
}
```

---

### Step 9: Backend Creates Lead

```
             ↓
┌────────────────────────────────────────────────┐
│  📝 CREATE/UPDATE LEAD                         │
│                                                 │
│  Step 9.1: Check if Lead Exists                │
│  ┌──────────────────────────────────────┐     │
│  │ SELECT * FROM leads                  │     │
│  │ WHERE campaignId = "cmgjk3k1m..."    │     │
│  │   AND phoneNumber = "+15551234567"   │     │
│  │                                       │     │
│  │ Result: Not found                    │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Step 9.2: Create New Lead                     │
│  ┌──────────────────────────────────────┐     │
│  │ INSERT INTO leads (                  │     │
│  │   campaignId,                        │     │
│  │   phoneNumber,                       │     │
│  │   name,                              │     │
│  │   status                             │     │
│  │ ) VALUES (                           │     │
│  │   "cmgjk3k1m0000sbll7wvbqgt4",      │     │
│  │   "+15551234567",                    │     │
│  │   "Inbound Caller +15551234567",    │     │
│  │   "calling"                          │     │
│  │ )                                    │     │
│  │                                       │     │
│  │ Lead Created ✅                      │     │
│  │ ID: "cmgjl1234..."                  │     │
│  └──────────────────────────────────────┘     │
└────────────┬───────────────────────────────────┘
             │
             │ [Lead created for tracking]
             ↓
```

**What happens:**
- Checks if caller already exists as a lead
- Not found (first time caller)
- Creates new lead record
- Lead links caller to campaign

**Time elapsed:** ~0.50 seconds (database insert ~40ms)

**Code:**
```javascript
let lead = await prisma.lead.findFirst({
  where: {
    campaignId: phoneNumber.campaignId,
    phoneNumber: "+15551234567"
  }
});

if (!lead) {
  lead = await prisma.lead.create({
    data: {
      campaignId: phoneNumber.campaignId,
      phoneNumber: "+15551234567",
      name: "Inbound Caller +15551234567",
      status: "calling"
    }
  });
}
```

---

### Step 10: Backend Logs Call

```
             ↓
┌────────────────────────────────────────────────┐
│  📊 CREATE CALL LOG                            │
│                                                 │
│  INSERT INTO call_logs (                       │
│    leadId,                                      │
│    campaignId,                                  │
│    phoneNumber,                                 │
│    callSid,                                     │
│    roomName,                                    │
│    status,                                      │
│    metadata                                     │
│  ) VALUES (                                     │
│    "cmgjl1234...",         -- Lead ID          │
│    "cmgjk3k1m...",         -- Campaign         │
│    "+15551234567",         -- Caller           │
│    "SIP-12345",            -- Call ID          │
│    "sip-room-abc123",      -- Room             │
│    "ringing",              -- Status           │
│    {                       -- Metadata         │
│      call_type: "inbound",                     │
│      trunk_id: "ST_YOUR_INBOUND_TRUNK_ID",             │
│      phone_number_id: "cmgjk2lp..."           │
│    }                                            │
│  )                                              │
│                                                 │
│  CallLog Created ✅                            │
│  ID: "cmgjkyhd20003sbzwf2hq01iv"              │
└────────────┬───────────────────────────────────┘
             │
             │ [Call logged for tracking]
             ↓
```

**What happens:**
- Creates call log entry
- Links call to lead and campaign
- Stores all call metadata
- Initial status: "ringing"
- Will be updated when call ends

**Time elapsed:** ~0.54 seconds (database insert ~40ms)

**Code:**
```javascript
const callLog = await prisma.callLog.create({
  data: {
    leadId: lead.id,
    campaignId: phoneNumber.campaignId,
    phoneNumber: "+15551234567",
    callSid: "SIP-12345",
    roomName: "sip-room-abc123",
    status: "ringing",
    metadata: JSON.stringify({
      call_type: "inbound",
      trunk_id: "ST_YOUR_INBOUND_TRUNK_ID",
      phone_number_id: phoneNumber.id
    })
  }
});
```

---

### Step 11: Backend Responds to LiveKit

```
             ↓
┌────────────────────────────────────────────────┐
│  📤 HTTP RESPONSE TO LIVEKIT                   │
│                                                 │
│  Status: 200 OK                                │
│  Content-Type: application/json                │
│                                                 │
│  Response Body:                                │
│  {                                              │
│    "agent_name": "telephony-agent",            │
│    "metadata": {                               │
│      "call_type": "inbound",                   │
│      "phone_number_id": "cmgjk2lp...",        │
│      "tenant_id": "7c8693c6...",              │
│      "campaign_id": "cmgjk3k1m...",           │
│      "from_number": "+15551234567",           │
│      "to_number": "+1XXXXXXXXXX"              │
│    },                                           │
│    "attributes": {                             │
│      "inbound": "true",                        │
│      "phone_number": "+1XXXXXXXXXX",          │
│      "caller": "+15551234567"                 │
│    }                                            │
│  }                                              │
└────────────┬───────────────────────────────────┘
             │
             │ [Response sent back to LiveKit]
             ↓
```

**What happens:**
- Backend constructs response JSON
- Most important: `agent_name: "telephony-agent"`
- Includes metadata for agent context
- Sends 200 OK response
- LiveKit receives response

**Time elapsed:** ~0.55 seconds (total backend processing ~150ms)

**Code:**
```javascript
return res.json({
  agent_name: "telephony-agent",
  metadata: JSON.stringify({
    call_type: "inbound",
    phone_number_id: phoneNumber.id,
    tenant_id: phoneNumber.tenantId,
    campaign_id: phoneNumber.campaignId,
    from_number: "+15551234567",
    to_number: "+1XXXXXXXXXX"
  }),
  attributes: {
    inbound: "true",
    phone_number: "+1XXXXXXXXXX",
    caller: "+15551234567"
  }
});
```

---

### Step 12: LiveKit Dispatches Agent

```
             ↓
┌────────────────────────────────────────────────┐
│  🤖 LIVEKIT AGENT DISPATCH                     │
│                                                 │
│  Received webhook response ✅                  │
│  Agent to dispatch: "telephony-agent"          │
│                                                 │
│  Action: Find and dispatch agent               │
│                                                 │
│  Step 12.1: Locate Agent                       │
│  ┌──────────────────────────────────────┐     │
│  │ Looking for agent with name:         │     │
│  │ "telephony-agent"                    │     │
│  │                                       │     │
│  │ Checking agent pool...               │     │
│  │ Found available agent ✅             │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Step 12.2: Send Dispatch Request              │
│  ┌──────────────────────────────────────┐     │
│  │ AgentDispatch.create({               │     │
│  │   agent_name: "telephony-agent",     │     │
│  │   room: "sip-room-abc123",           │     │
│  │   metadata: {...}                    │     │
│  │ })                                   │     │
│  │                                       │     │
│  │ Dispatch ID: AD_YOUR_DISPATCH_ID ✅            │     │
│  └──────────────────────────────────────┘     │
└────────────┬───────────────────────────────────┘
             │
             │ [Agent dispatched to room]
             ↓
```

**What happens:**
- LiveKit receives agent_name from webhook
- Looks for agent named "telephony-agent"
- Finds available agent instance
- Sends dispatch request to agent
- Agent receives notification to join room

**Time elapsed:** ~0.7 seconds

---

### Step 13: Agent Connects to Room

```
             ↓
┌────────────────────────────────────────────────┐
│  🎙️ AGENT JOINING ROOM                        │
│                                                 │
│  Agent: "telephony-agent"                      │
│  Room: "sip-room-abc123"                       │
│                                                 │
│  Step 13.1: Agent Receives Dispatch            │
│  ┌──────────────────────────────────────┐     │
│  │ Dispatch notification received       │     │
│  │ Room: sip-room-abc123                │     │
│  │ Metadata: {call_type: "inbound"...} │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Step 13.2: Agent Connects to Room             │
│  ┌──────────────────────────────────────┐     │
│  │ Connecting to LiveKit room...        │     │
│  │ Establishing audio stream...         │     │
│  │ Setting up voice recognition...      │     │
│  │                                       │     │
│  │ Connected ✅                         │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Current Room State:                           │
│  ┌──────────────────────────────────────┐     │
│  │ Room: sip-room-abc123                │     │
│  │                                       │     │
│  │ Participants: 2                      │     │
│  │   1. SIP Participant                 │     │
│  │      (Caller +15551234567)           │     │
│  │      Audio: Publishing               │     │
│  │                                       │     │
│  │   2. Agent                            │     │
│  │      (telephony-agent)               │     │
│  │      Audio: Publishing               │     │
│  │                                       │     │
│  │ Status: Active ✅                    │     │
│  └──────────────────────────────────────┘     │
└────────────┬───────────────────────────────────┘
             │
             │ [Both participants in room]
             ↓
```

**What happens:**
- Agent service receives dispatch
- Agent reads metadata (knows it's inbound call)
- Agent connects to LiveKit room
- Establishes audio stream
- Both caller and agent now in same room
- Audio can flow between them

**Time elapsed:** ~1.2 seconds

---

### Step 14: Agent Speaks First

```
             ↓
┌────────────────────────────────────────────────┐
│  💬 AGENT INITIATES CONVERSATION               │
│                                                 │
│  Agent analyzes context:                       │
│  - Call type: inbound                          │
│  - Caller: +15551234567                        │
│  - Campaign: Phone Number Test Campaign        │
│                                                 │
│  Agent generates greeting:                     │
│  ┌──────────────────────────────────────┐     │
│  │ "Hello! Thank you for calling.       │     │
│  │  This is your AI assistant.          │     │
│  │  How can I help you today?"          │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Text-to-Speech (TTS):                         │
│    Text → Audio stream                         │
│                                                 │
│  Audio published to room:                      │
│    Agent → LiveKit → SIP → Caller hears       │
└────────────┬───────────────────────────────────┘
             │
             │ [Caller hears agent speaking]
             ↓
```

**What happens:**
- Agent reads call context from metadata
- Generates appropriate greeting
- Converts text to speech
- Publishes audio to LiveKit room
- LiveKit sends audio to SIP participant
- Audio travels back through SIP → Trunk → Twilio
- **Caller hears the AI agent!**

**Time elapsed:** ~1.5 seconds from initial dial

---

### Step 15: Conversation Active

```
             ↓
┌────────────────────────────────────────────────┐
│  🎉 ACTIVE CONVERSATION                        │
│                                                 │
│  Caller 🗣️ → LiveKit → Agent 🤖               │
│  Agent 🤖 → LiveKit → Caller 🗣️                │
│                                                 │
│  Real-time bidirectional audio:                │
│  ┌──────────────────────────────────────┐     │
│  │                                       │     │
│  │  Caller: "I need help with..."       │     │
│  │    ↓ [Speech-to-Text]                │     │
│  │  Agent AI processes request           │     │
│  │    ↓ [AI generates response]          │     │
│  │  Agent: "I can help you with that..." │     │
│  │    ↓ [Text-to-Speech]                │     │
│  │  Caller hears response                │     │
│  │                                       │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Call continues until:                         │
│  - Caller hangs up                             │
│  - Agent ends call                             │
│  - Call timeout                                │
│                                                 │
│  Current call duration: 00:03:27               │
└────────────────────────────────────────────────┘
```

**What happens:**
- Caller and agent can hear each other
- Agent uses speech recognition for caller's words
- Agent processes with AI/LLM
- Agent responds with natural speech
- Conversation flows naturally
- Everything tracked in database

**Full audio loop:**
```
Caller speaks
  → Phone mic captures
  → PSTN carries
  → Twilio receives
  → SIP trunk forwards
  → LiveKit receives
  → Agent's speech-to-text converts
  → Agent AI processes
  → Agent generates response text
  → Agent's text-to-speech converts
  → LiveKit sends audio
  → SIP trunk forwards
  → Twilio sends
  → PSTN carries
  → Caller hears
```

---

## ⏱️ Timeline Summary

| Time | Step | What Happens |
|------|------|--------------|
| 0.0s | Caller dials | Person dials +1XXXXXXXXXX |
| 0.1s | Twilio receives | Call enters Twilio system |
| 0.2s | Trunk routes | SIP INVITE to LiveKit |
| 0.3s | LiveKit receives | Room created, SIP participant added |
| 0.4s | Webhook called | LiveKit POSTs to your server |
| 0.41s | Backend receives | Express route handler called |
| 0.45s | Database query | Phone number looked up |
| 0.46s | Agent selected | "telephony-agent" chosen |
| 0.50s | Lead created | Caller saved as lead |
| 0.54s | Call logged | CallLog record created |
| 0.55s | Response sent | Backend responds with agent name |
| 0.7s | Agent dispatched | LiveKit dispatches agent to room |
| 1.2s | Agent connected | Agent joins room, audio ready |
| 1.5s | Agent speaks | Caller hears "Hello!" |
| 1.5s+ | **Conversation** | **Active call in progress** |

**Total time from dial to "Hello": ~1.5 seconds** ⚡

---

## 🔄 Data Flow Summary

### Phone Call (Voice)
```
Caller Voice
  → PSTN
  → Twilio
  → SIP (Trunk)
  → LiveKit
  → Agent AI
  → [Process]
  → Agent AI
  → LiveKit
  → SIP (Trunk)
  → Twilio
  → PSTN
  → Caller Hears
```

### Webhook (Data)
```
LiveKit
  ↓ [HTTP POST]
Your Server (webhookRoutes.js)
  ↓ [Call service]
InboundCallService.handleInboundCall()
  ↓ [Query]
Database (phone_numbers)
  ↑ [Return data]
InboundCallService
  ↓ [Determine agent]
  ↓ [Create lead]
Database (leads)
  ↓ [Log call]
Database (call_logs)
  ↓ [Build response]
InboundCallService
  ↑ [Return JSON]
Your Server
  ↑ [HTTP Response]
LiveKit
  ↓ [Dispatch agent]
Agent Connects
```

---

## 📝 Key Points

1. **Speed**: Entire flow completes in ~1.5 seconds
2. **Webhook is crucial**: Without it, LiveKit doesn't know which agent to connect
3. **Database tracks everything**: Phone number, lead, call log all recorded
4. **Agent selection is smart**: Checks campaign → tenant → default
5. **Bidirectional audio**: Works like a normal phone call once connected
6. **All automatic**: No manual intervention needed

---

## 🎯 The Essential Answer

**When someone calls +1XXXXXXXXXX:**

1. Twilio receives it (0.1s)
2. Routes to LiveKit via SIP trunk (0.3s)
3. LiveKit calls your webhook (0.4s)
4. Your server:
   - Looks up phone number in database
   - Finds it's linked to "Phone Number Test Campaign"
   - Campaign says use "telephony-agent"
   - Creates lead for caller
   - Logs the call
   - Responds: "Use telephony-agent" (0.55s)
5. LiveKit dispatches that agent (0.7s)
6. Agent connects and speaks (1.5s)
7. **Conversation begins!** 🎉

**Total: 1.5 seconds from dial to "Hello"**

That's it! That's the complete flow! 🚀
