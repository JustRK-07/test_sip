# 🔄 Complete System Flow - Campaign Calling System

## Table of Contents
1. [One-Time Setup Flow](#one-time-setup-flow)
2. [System Architecture](#system-architecture)
3. [Campaign Creation Flow](#campaign-creation-flow)
4. [Campaign Execution Flow](#campaign-execution-flow)
5. [Individual Call Flow (SIP Level)](#individual-call-flow-sip-level)
6. [Agent Interaction Flow](#agent-interaction-flow)
7. [Database State Flow](#database-state-flow)
8. [Complete End-to-End Flow](#complete-end-to-end-flow)

---

## 1. One-Time Setup Flow

### 📋 Prerequisites Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONE-TIME SETUP PROCESS                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: Twilio Account Setup
┌──────────────────────────────────────┐
│ 1. Create Twilio Account             │
│ 2. Buy Phone Number (+1234567890)    │
│ 3. Create Elastic SIP Trunk          │
│ 4. Get Credentials:                  │
│    ├─ Account SID (ACxxxxx)          │
│    ├─ Auth Token                     │
│    └─ Trunk SID (TKxxxxx)            │
└──────────────────┬───────────────────┘
                   │
                   ▼
Step 2: LiveKit Account Setup
┌──────────────────────────────────────┐
│ 1. Create LiveKit Cloud Project      │
│ 2. Get API Credentials:              │
│    ├─ LiveKit URL                    │
│    ├─ API Key                        │
│    └─ API Secret                     │
└──────────────────┬───────────────────┘
                   │
                   ▼
Step 3: Connect Twilio to LiveKit
┌──────────────────────────────────────┐
│ In LiveKit Dashboard:                │
│ 1. Go to SIP Settings                │
│ 2. Create New SIP Trunk              │
│    ├─ Type: Twilio                   │
│    ├─ Enter Twilio Account SID      │
│    ├─ Enter Twilio Auth Token       │
│    └─ Enter Trunk SID                │
│ 3. Get LiveKit Trunk ID:             │
│    └─ ST_xxxxxxxxx                   │
└──────────────────┬───────────────────┘
                   │
                   ▼
Step 4: Configure Environment
┌──────────────────────────────────────┐
│ Update .env.local file:              │
│                                      │
│ LIVEKIT_URL=wss://xxx.livekit.cloud │
│ LIVEKIT_API_KEY=APIxxxxx            │
│ LIVEKIT_API_SECRET=secretxxxxx      │
│ LIVEKIT_OUTBOUND_TRUNK_ID=ST_xxx    │
│                                      │
│ TWILIO_ACCOUNT_SID=ACxxxxx          │
│ TWILIO_AUTH_TOKEN=xxxxx             │
│ TWILIO_PHONE_NUMBER=+1234567890     │
└──────────────────┬───────────────────┘
                   │
                   ▼
Step 5: Start Services
┌──────────────────────────────────────┐
│ Terminal 1:                          │
│ $ python voice_agent.py dev          │
│ ✓ Agent worker registered            │
│                                      │
│ Terminal 2:                          │
│ $ cd backend && npm run dev          │
│ ✓ Server running on port 3000       │
└──────────────────────────────────────┘

✅ SETUP COMPLETE - READY TO MAKE CALLS
```

---

## 2. System Architecture

### 🏗️ Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAMPAIGN CALLING SYSTEM                       │
└─────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────┐
                            │   Your UI/API   │
                            │    Client       │
                            └────────┬────────┘
                                     │
                                     │ HTTP REST
                                     ▼
                    ┌────────────────────────────────┐
                    │    Express.js Backend API      │
                    │  (Campaign Management)         │
                    │                                │
                    │  Controllers:                  │
                    │  ├─ Campaign CRUD              │
                    │  ├─ Lead Management            │
                    │  └─ Agent Assignment           │
                    └────────┬───────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Campaign │  │   Lead   │  │  Agent   │
        │  Table   │  │  Table   │  │  Table   │
        └──────────┘  └──────────┘  └──────────┘
                │            │            │
                └────────────┼────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  Prisma ORM        │
                    │  SQLite Database   │
                    └────────────────────┘
                             │
                             ▼
                    ┌────────────────────────────┐
                    │  CampaignQueue Service     │
                    │  (Queue Management)        │
                    │                            │
                    │  ├─ Pending Queue          │
                    │  ├─ Active Calls (max 3)   │
                    │  ├─ Concurrency Control    │
                    │  └─ Retry Logic            │
                    └──────────┬─────────────────┘
                               │
                               │ For each lead
                               ▼
                    ┌────────────────────────────┐
                    │  PythonExecutor Service    │
                    │  (Spawns Python Process)   │
                    └──────────┬─────────────────┘
                               │
                               │ spawn
                               ▼
                    ┌────────────────────────────┐
                    │  test_outbound.py          │
                    │  (Python Script)           │
                    │                            │
                    │  Step 1: Dispatch Agent    │
                    │  Step 2: Create SIP Call   │
                    └──────────┬─────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
    ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
    │  LiveKit Cloud   │ │  SIP Trunk   │ │ voice_agent  │
    │  (Call Manager)  │ │  Connection  │ │  .py         │
    └────────┬─────────┘ └──────┬───────┘ └──────┬───────┘
             │                  │                 │
             │                  ▼                 │
             │         ┌──────────────┐           │
             │         │   Twilio     │           │
             │         │  SIP Gateway │           │
             │         └──────┬───────┘           │
             │                │                   │
             │                ▼                   │
             │         ┌──────────────┐           │
             │         │ PSTN Network │           │
             │         │   (Telco)    │           │
             │         └──────┬───────┘           │
             │                │                   │
             │                ▼                   │
             │         ┌──────────────┐           │
             │         │ Customer's   │           │
             │         │   Phone 📱   │           │
             │         └──────┬───────┘           │
             │                │                   │
             └────────────────┼───────────────────┘
                              │
                    Audio Stream (Both Ways)
                              │
                    ┌─────────▼──────────┐
                    │  LiveKit Room      │
                    │  • STT (Speech)    │
                    │  • TTS (Speech)    │
                    │  • AI Agent Logic  │
                    └────────────────────┘
```

---

## 3. Campaign Creation Flow

### 📋 Creating a Campaign via API

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPAIGN CREATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

User/UI
  │
  │ POST /api/v1/campaigns
  │ {
  │   "name": "Q4 Sales Campaign",
  │   "maxConcurrent": 3,
  │   "callDelay": 2000
  │ }
  ▼
┌─────────────────────────────────────┐
│ Campaign Controller                 │
│ campaignController.createCampaign() │
└──────────────┬──────────────────────┘
               │
               │ Validate input
               ▼
┌─────────────────────────────────────┐
│ Prisma ORM                          │
│ prisma.campaign.create({...})       │
└──────────────┬──────────────────────┘
               │
               │ INSERT INTO campaigns
               ▼
┌─────────────────────────────────────┐
│ SQLite Database                     │
│                                     │
│ campaigns table:                    │
│ ┌─────────────────────────────────┐ │
│ │ id: "cmggzkcrc0000sbanzqb7a2hc"││ │
│ │ name: "Q4 Sales Campaign"       ││ │
│ │ status: "draft"                 ││ │
│ │ maxConcurrent: 3                ││ │
│ │ callDelay: 2000                 ││ │
│ │ totalCalls: 0                   ││ │
│ │ successfulCalls: 0              ││ │
│ │ failedCalls: 0                  ││ │
│ └─────────────────────────────────┘ │
└──────────────┬──────────────────────┘
               │
               │ Return campaign object
               ▼
Response: {
  "success": true,
  "data": {
    "id": "cmggzkcrc0000sbanzqb7a2hc",
    "name": "Q4 Sales Campaign",
    "status": "draft",
    "maxConcurrent": 3,
    ...
  }
}

✅ CAMPAIGN CREATED - ID: cmggzkcrc0000sbanzqb7a2hc
```

### 📞 Adding Leads to Campaign

```
User/UI
  │
  │ POST /api/v1/campaigns/{campaignId}/leads/bulk
  │ {
  │   "leads": [
  │     {"phoneNumber": "+919529117230", "name": "John"},
  │     {"phoneNumber": "+918329823146", "name": "Jane"},
  │     {"phoneNumber": "+918390288495", "name": "Bob"}
  │   ]
  │ }
  ▼
┌─────────────────────────────────────┐
│ Lead Controller                     │
│ leadController.addLeadsBulk()       │
└──────────────┬──────────────────────┘
               │
               │ For each lead:
               │ 1. Validate phone number
               │ 2. Convert metadata to JSON string
               │ 3. Set status = "pending"
               ▼
┌─────────────────────────────────────┐
│ Prisma ORM                          │
│ Loop: prisma.lead.create({...})     │
└──────────────┬──────────────────────┘
               │
               │ INSERT INTO leads (multiple)
               ▼
┌─────────────────────────────────────┐
│ SQLite Database                     │
│                                     │
│ leads table:                        │
│ ┌─────────────────────────────────┐ │
│ │ id: "lead_abc123"               ││ │
│ │ campaignId: "cmgg...2hc"        ││ │
│ │ phoneNumber: "+919529117230"    ││ │
│ │ name: "John"                    ││ │
│ │ status: "pending"               ││ │
│ │ priority: 1                     ││ │
│ │ attempts: 0                     ││ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ id: "lead_def456"               ││ │
│ │ phoneNumber: "+918329823146"    ││ │
│ │ name: "Jane"                    ││ │
│ │ status: "pending"               ││ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ id: "lead_ghi789"               ││ │
│ │ phoneNumber: "+918390288495"    ││ │
│ │ name: "Bob"                     ││ │
│ │ status: "pending"               ││ │
│ └─────────────────────────────────┘ │
└──────────────┬──────────────────────┘
               │
               ▼
Response: {
  "success": true,
  "data": {
    "created": 3,
    "total": 3
  }
}

✅ 3 LEADS ADDED TO CAMPAIGN
```

---

## 4. Campaign Execution Flow

### 🚀 Starting the Campaign

```
┌─────────────────────────────────────────────────────────────────┐
│                   CAMPAIGN EXECUTION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

User/UI
  │
  │ POST /api/v1/campaigns/{campaignId}/start
  ▼
┌──────────────────────────────────────────┐
│ Campaign Controller                      │
│ campaignController.startCampaign()       │
└──────────────┬───────────────────────────┘
               │
               │ 1. Fetch campaign from DB
               │ 2. Fetch all pending leads
               │ 3. Validate campaign can start
               ▼
┌──────────────────────────────────────────┐
│ Update Campaign Status                   │
│ prisma.campaign.update({                 │
│   status: "active",                      │
│   startedAt: new Date()                  │
│ })                                       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Create CampaignQueue Instance            │
│                                          │
│ const queue = new CampaignQueue({        │
│   campaignName: "Q4 Sales",              │
│   maxConcurrent: 3,                      │
│   retryFailed: false,                    │
│   callDelay: 2000                        │
│ })                                       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Setup Event Listeners                    │
│                                          │
│ queue.on('call_started', (lead) => {     │
│   → Update lead.status = 'calling'       │
│ })                                       │
│                                          │
│ queue.on('call_completed', (result) => { │
│   → Update lead.status = 'completed'     │
│   → Create call log entry                │
│   → Increment campaign.successfulCalls   │
│ })                                       │
│                                          │
│ queue.on('call_failed', (error) => {     │
│   → Update lead.status = 'failed'        │
│   → Create call log entry                │
│   → Increment campaign.failedCalls       │
│ })                                       │
│                                          │
│ queue.on('campaign_completed', () => {   │
│   → Update campaign.status = 'completed' │
│   → Set completedAt timestamp            │
│   → Remove from active campaigns         │
│ })                                       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Add Leads to Queue                       │
│                                          │
│ queue.addLeads([                         │
│   {id, phoneNumber, name, priority},     │
│   {id, phoneNumber, name, priority},     │
│   {id, phoneNumber, name, priority}      │
│ ])                                       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ CampaignQueue Internal State             │
│                                          │
│ pendingLeads: [lead1, lead2, lead3]      │
│ activeLeads: Set()                       │
│ completedLeads: []                       │
│ failedLeads: []                          │
│ maxConcurrent: 3                         │
│ callDelay: 2000ms                        │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Start Campaign Queue                     │
│ queue.start()                            │
└──────────────┬───────────────────────────┘
               │
               │ Returns immediately
               │ Campaign runs in background
               ▼
Response: {
  "success": true,
  "message": "Campaign started",
  "data": {
    "campaignId": "cmgg...2hc",
    "totalLeads": 3,
    "maxConcurrent": 3
  }
}

                    ┌────────────────┐
                    │  Campaign is   │
                    │  now RUNNING   │
                    │  in background │
                    └────────────────┘
                            │
                            ▼
                    [See next section]
```

### ⚙️ Queue Processing Loop

```
┌─────────────────────────────────────────────────────────────────┐
│              CAMPAIGN QUEUE PROCESSING LOOP                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CampaignQueue.processQueue()            │
│ (Runs continuously while campaign active)│
└──────────────┬──────────────────────────┘
               │
               ▼
        ┌──────────────────┐
        │ Check: Can we    │
        │ start new call?  │
        └─────┬────────────┘
              │
              ├─ YES: activeLeads.size < maxConcurrent
              │        AND pendingLeads.length > 0
              │
              ▼
       ┌──────────────────────┐
       │ Get next lead from   │
       │ pendingLeads queue   │
       │ (priority order)     │
       └─────┬────────────────┘
             │
             ▼
       ┌──────────────────────┐
       │ Move to activeLeads  │
       │ activeLeads.add(lead)│
       └─────┬────────────────┘
             │
             ▼
       ┌──────────────────────────────┐
       │ Emit: 'call_started'         │
       │ → Update DB: status='calling'│
       └─────┬────────────────────────┘
             │
             ▼
       ┌──────────────────────────────┐
       │ Call PythonExecutor          │
       │ executor.makeCall(phoneNumber)│
       └─────┬────────────────────────┘
             │
             │ [See Python Call Flow]
             │
             ▼
       ┌──────────────────────────────┐
       │ Wait callDelay (2000ms)      │
       │ before starting next call    │
       └─────┬────────────────────────┘
             │
             ▼
       ┌──────────────────────────────┐
       │ Loop back to check queue     │
       └──────────────────────────────┘


CONCURRENCY EXAMPLE:

Time: 0s
┌──────────────────────────────────────┐
│ Pending: [Lead1, Lead2, Lead3]       │
│ Active:  []                          │
│ Slots:   0/3                         │
└──────────────────────────────────────┘
         │
         │ Start Lead1
         ▼
Time: 0s
┌──────────────────────────────────────┐
│ Pending: [Lead2, Lead3]              │
│ Active:  [Lead1 🔄]                  │
│ Slots:   1/3                         │
└──────────────────────────────────────┘
         │
         │ Wait 2s, Start Lead2
         ▼
Time: 2s
┌──────────────────────────────────────┐
│ Pending: [Lead3]                     │
│ Active:  [Lead1 🔄, Lead2 🔄]        │
│ Slots:   2/3                         │
└──────────────────────────────────────┘
         │
         │ Wait 2s, Start Lead3
         ▼
Time: 4s
┌──────────────────────────────────────┐
│ Pending: []                          │
│ Active:  [Lead1 🔄, Lead2 🔄, Lead3 🔄]│
│ Slots:   3/3 ← MAX REACHED           │
└──────────────────────────────────────┘
         │
         │ WAIT for any call to finish
         ▼
Time: 11s
┌──────────────────────────────────────┐
│ Lead1 completed! ✅                  │
│ Pending: []                          │
│ Active:  [Lead2 🔄, Lead3 🔄]        │
│ Completed: [Lead1 ✅]                │
│ Slots:   2/3                         │
└──────────────────────────────────────┘
         │
         │ No more pending leads
         ▼
Time: 15s
┌──────────────────────────────────────┐
│ Lead2 completed! ✅                  │
│ Active:  [Lead3 🔄]                  │
│ Completed: [Lead1 ✅, Lead2 ✅]      │
└──────────────────────────────────────┘
         │
         ▼
Time: 18s
┌──────────────────────────────────────┐
│ Lead3 completed! ✅                  │
│ Active:  []                          │
│ Completed: [Lead1 ✅, Lead2 ✅, Lead3 ✅]│
└──────────────────────────────────────┘
         │
         │ Emit: 'campaign_completed'
         ▼
┌──────────────────────────────────────┐
│ Campaign Status: COMPLETED           │
│ Total: 3 | Success: 3 | Failed: 0    │
│ Duration: 18 seconds                 │
└──────────────────────────────────────┘
```

---

## 5. Individual Call Flow (SIP Level)

### 📞 Making a Single Call

```
┌─────────────────────────────────────────────────────────────────┐
│                   SINGLE CALL FLOW (DETAILED)                    │
└─────────────────────────────────────────────────────────────────┘

CampaignQueue
  │
  │ For Lead: John (+919529117230)
  ▼
┌──────────────────────────────────────┐
│ PythonExecutor.makeCall()            │
│ executor.makeCall("+919529117230")   │
└──────────────┬───────────────────────┘
               │
               │ Spawn child process
               ▼
┌──────────────────────────────────────┐
│ Python Process Spawned               │
│                                      │
│ Command:                             │
│ /venv/bin/python                     │
│ test_outbound.py                     │
│ +919529117230                        │
│                                      │
│ Working Dir: test_sip/               │
│ (so it can load .env.local)          │
└──────────────┬───────────────────────┘
               │
               ▼

╔═══════════════════════════════════════════════════════════════╗
║                  PYTHON SCRIPT EXECUTION                       ║
║                  (test_outbound.py)                            ║
╚═══════════════════════════════════════════════════════════════╝

Step 1: Generate Room Name
┌──────────────────────────────────────┐
│ room_name = f"outbound-call-{uuid}"  │
│ → "outbound-call-6879343e"           │
└──────────────┬───────────────────────┘
               │
               ▼

Step 2: Dispatch AI Agent to Room
┌──────────────────────────────────────┐
│ LiveKit API Call:                    │
│ dispatch.create_dispatch(            │
│   room="outbound-call-6879343e",     │
│   agent_name="voice-assistant"       │
│ )                                    │
└──────────────┬───────────────────────┘
               │
               │ HTTP POST to LiveKit
               ▼
┌──────────────────────────────────────┐
│ LiveKit Cloud                        │
│                                      │
│ 1. Create room: outbound-call-6879...│
│ 2. Find worker running agent:        │
│    "voice-assistant"                 │
│ 3. Send job to worker                │
└──────────────┬───────────────────────┘
               │
               │ WebSocket to worker
               ▼
┌──────────────────────────────────────┐
│ Your voice_agent.py (Running Worker) │
│                                      │
│ @WorkerOptions.entrypoint_fnc        │
│ async def entrypoint(ctx):           │
│   room = ctx.room                    │
│   → Connects to room                 │
│   → Initializes AI assistant         │
│   → Waits for participant            │
└──────────────┬───────────────────────┘
               │
               │ Agent READY in room
               ▼
Response to Python Script:
{
  "dispatch_id": "AD_5dk9NxVZ9kjo",
  "room": "outbound-call-6879343e",
  "agent_name": "voice-assistant"
}
               │
               ▼

Step 3: Wait for Agent (5 seconds)
┌──────────────────────────────────────┐
│ time.sleep(5)                        │
│ → Give agent time to connect         │
└──────────────┬───────────────────────┘
               │
               ▼

Step 4: Create SIP Participant (Make the Call!)
┌──────────────────────────────────────┐
│ LiveKit SIP API Call:                │
│ sip.create_sip_participant(          │
│   room_name="outbound-call-6879...", │
│   sip_trunk_id="ST_xxxxxxxxx",       │
│   sip_call_to="+919529117230",       │
│   sip_number="+1234567890"           │
│ )                                    │
└──────────────┬───────────────────────┘
               │
               │ HTTP POST to LiveKit
               ▼

╔═══════════════════════════════════════════════════════════════╗
║                     SIP SIGNALING FLOW                         ║
╚═══════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────┐
│ LiveKit SIP Server                   │
│                                      │
│ 1. Looks up trunk: ST_xxxxxxxxx      │
│ 2. Gets Twilio credentials           │
│ 3. Prepares SIP INVITE message       │
└──────────────┬───────────────────────┘
               │
               │ SIP INVITE
               │ From: sip:+1234567890@livekit
               │ To: sip:+919529117230@twilio
               │ Call-ID: xxx@livekit.cloud
               ▼
┌──────────────────────────────────────┐
│ Twilio SIP Gateway                   │
│                                      │
│ 1. Receives INVITE                   │
│ 2. Validates trunk credentials       │
│ 3. Initiates PSTN call               │
└──────────────┬───────────────────────┘
               │
               │ SS7/ISUP Signaling
               │ (Telecom protocols)
               ▼
┌──────────────────────────────────────┐
│ Telephone Network (PSTN)             │
│                                      │
│ 1. Routes to mobile carrier          │
│ 2. Locates subscriber                │
│ 3. Sends ring signal                 │
└──────────────┬───────────────────────┘
               │
               │ Ring! 📱
               ▼
┌──────────────────────────────────────┐
│ John's Phone (+919529117230)         │
│                                      │
│ Caller ID: +1234567890               │
│ [Accept] [Reject]                    │
└──────────────┬───────────────────────┘
               │
               │ User presses Accept
               ▼
┌──────────────────────────────────────┐
│ Call Answered!                       │
└──────────────┬───────────────────────┘
               │
               │ 180 Ringing
               │ 200 OK
               ▼
┌──────────────────────────────────────┐
│ Twilio → LiveKit                     │
│ Sends: 200 OK                        │
│ (Call answered)                      │
└──────────────┬───────────────────────┘
               │
               │ ACK
               ▼
┌──────────────────────────────────────┐
│ LiveKit → Twilio                     │
│ Sends: ACK (acknowledged)            │
└──────────────┬───────────────────────┘
               │
               │ RTP Stream Established
               │ (Real-time audio packets)
               ▼

╔═══════════════════════════════════════════════════════════════╗
║              AUDIO STREAM & AI CONVERSATION                    ║
╚═══════════════════════════════════════════════════════════════╝

┌────────────────────────────────────────────────────────────────┐
│                      LIVE AUDIO FLOW                            │
└────────────────────────────────────────────────────────────────┘

John's Voice
    │
    │ "Hello?"
    ▼
[Phone Microphone] 📱
    │
    │ Analog → Digital (PCM audio)
    ▼
[Mobile Network]
    │
    │ Compressed audio (AMR/G.711)
    ▼
[Twilio Gateway]
    │
    │ SIP RTP packets (UDP)
    │ Codec: PCMU/PCMA
    ▼
[LiveKit SIP Bridge]
    │
    │ Convert to WebRTC
    ▼
[LiveKit Room: outbound-call-6879343e]
    │
    │ Subscribe to audio track
    ▼
[LiveKit STT Service]
    │
    │ Speech-to-Text
    ▼
Text: "Hello?"
    │
    ▼
[voice_agent.py - AI Assistant]
    │
    │ Process with LLM:
    │ • Context: Sales call
    │ • User said: "Hello?"
    │ • Generate response
    ▼
AI Response: "Hi John! This is calling from ABC Company..."
    │
    ▼
[LiveKit TTS Service]
    │
    │ Text-to-Speech
    │ Voice: Professional/Friendly
    ▼
Audio: "Hi John! This is..."
    │
    ▼
[LiveKit Room]
    │
    │ Publish audio track
    ▼
[LiveKit SIP Bridge]
    │
    │ Convert WebRTC → RTP
    ▼
[Twilio Gateway]
    │
    │ SIP RTP packets
    ▼
[Mobile Network]
    │
    │ AMR/G.711 audio
    ▼
[John's Phone Speaker] 🔊
    │
    ▼
John hears: "Hi John! This is..."

┌────────────────────────────────────┐
│ This loop continues throughout     │
│ the entire conversation:           │
│                                    │
│ John speaks → STT → AI → TTS →    │
│ → John hears → John speaks...      │
└────────────────────────────────────┘
```

### 📊 Call Completion

```
┌──────────────────────────────────────────────────────────────┐
│                     CALL COMPLETION                           │
└──────────────────────────────────────────────────────────────┘

Scenario 1: Normal Hangup (John hangs up)
┌──────────────────────────────────────┐
│ John presses "End Call"              │
└──────────────┬───────────────────────┘
               │
               ▼
[Phone] → [Network] → [Twilio]
               │
               │ SIP BYE message
               ▼
[LiveKit SIP Bridge]
               │
               │ Participant left room
               ▼
[LiveKit Room Event]
               │
               ▼
[voice_agent.py]
               │
               │ @agent.on("participant_disconnected")
               │ async def on_disconnect():
               │     await agent.say("Goodbye!")
               │     room.disconnect()
               ▼
[Python Script Detects Success]
               │
               │ stdout: "CALL INITIATED SUCCESSFULLY"
               │ stdout: "room: outbound-call-6879343e"
               │ stdout: "Dispatch ID: AD_5dk9NxVZ9kjo"
               ▼
[PythonExecutor Captures Output]
               │
               ▼
Return to CampaignQueue:
{
  success: true,
  phoneNumber: "+919529117230",
  roomName: "outbound-call-6879343e",
  dispatchId: "AD_5dk9NxVZ9kjo",
  duration: 7201,  // milliseconds
  timestamp: "2025-10-07T..."
}
               │
               ▼
[CampaignQueue Event: 'call_completed']
               │
               ├─ Remove from activeLeads
               ├─ Add to completedLeads
               │
               ▼
[Update Database]
               │
               ├─ UPDATE leads
               │   SET status = 'completed'
               │   WHERE id = 'lead_abc123'
               │
               ├─ INSERT INTO call_logs
               │   (leadId, roomName, dispatchId,
               │    status='completed', duration=7201)
               │
               └─ UPDATE campaigns
                   SET successfulCalls = successfulCalls + 1
                       totalCalls = totalCalls + 1

✅ CALL COMPLETED SUCCESSFULLY
   Duration: 7.2 seconds
   Room: outbound-call-6879343e
```

---

## 6. Agent Interaction Flow

### 🤖 AI Agent Conversation Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                 AI AGENT CONVERSATION FLOW                       │
│                    (voice_agent.py)                              │
└─────────────────────────────────────────────────────────────────┘

Agent Initialization (when job received)
┌──────────────────────────────────────┐
│ @WorkerOptions.entrypoint_fnc        │
│ async def entrypoint(ctx):           │
│     room = ctx.room                  │
│     participant = await room.wait()  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Create VoicePipelineAgent            │
│                                      │
│ assistant = VoicePipelineAgent(      │
│     vad=silero.VAD.load(),          │
│     stt=deepgram.STT(),             │
│     llm=openai.LLM(model="gpt-4"),  │
│     tts=elevenlabs.TTS(voice="...")  │
│ )                                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Initial Greeting                     │
│                                      │
│ await assistant.say(                 │
│   "Hi! This is calling from ABC..."  │
│ )                                    │
└──────────────┬───────────────────────┘
               │
               │ TTS → Audio → LiveKit → Customer
               ▼

Customer hears: "Hi! This is calling..."
               │
               │ Customer responds
               ▼

┌──────────────────────────────────────┐
│ Voice Activity Detection (VAD)       │
│                                      │
│ Silero VAD monitors audio stream:    │
│ ├─ Detects when customer starts     │
│ ├─ Detects when customer stops      │
│ └─ Triggers STT when speech ends    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Speech-to-Text (STT)                 │
│                                      │
│ Deepgram converts audio to text:     │
│ Audio → "Yes, I'm interested"        │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Large Language Model (LLM)           │
│                                      │
│ OpenAI GPT-4 processes:              │
│                                      │
│ Context:                             │
│ - System: "You're a sales agent"    │
│ - History: [previous messages]      │
│ - User: "Yes, I'm interested"       │
│                                      │
│ GPT-4 generates:                     │
│ → "Great! Let me tell you about..." │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Text-to-Speech (TTS)                 │
│                                      │
│ ElevenLabs converts to speech:       │
│ "Great! Let me tell you about..."   │
│ → High-quality voice audio           │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ LiveKit Room                         │
│ Streams audio to customer            │
└──────────────┬───────────────────────┘
               │
               ▼
Customer hears: "Great! Let me tell you..."
               │
               │
               └─┐
                 │ Loop continues:
                 │ Customer speaks →
                 │ VAD → STT → LLM → TTS →
                 │ Customer hears →
                 │ Customer speaks...
                 │
                 └─ Until call ends

┌──────────────────────────────────────┐
│ Full Conversation Example:           │
│                                      │
│ Agent: "Hi! This is calling from..." │
│ Customer: "Hello?"                   │
│ Agent: "I'm calling about..."        │
│ Customer: "Yes, I'm interested"      │
│ Agent: "Great! Let me explain..."    │
│ Customer: "Sounds good"              │
│ Agent: "Would you like to..."        │
│ Customer: "Yes, please"              │
│ Agent: "Perfect! I'll send you..."   │
│ Customer: "Thank you"                │
│ Agent: "You're welcome! Goodbye"     │
│ [Call ends]                          │
└──────────────────────────────────────┘
```

---

## 7. Database State Flow

### 💾 Database State Changes During Campaign

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE STATE FLOW                            │
└─────────────────────────────────────────────────────────────────┘

INITIAL STATE (Campaign Created, Leads Added)
┌────────────────────────────────────────────────────────────────┐
│ campaigns table:                                                │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "cmgg...2hc"                                         │   │
│ │ name: "Q4 Sales Campaign"                                │   │
│ │ status: "draft"              ← Not started yet           │   │
│ │ maxConcurrent: 3                                         │   │
│ │ totalCalls: 0                                            │   │
│ │ successfulCalls: 0                                       │   │
│ │ failedCalls: 0                                           │   │
│ │ startedAt: null                                          │   │
│ │ completedAt: null                                        │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ leads table:                                                    │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "lead_abc123" | status: "pending" | attempts: 0     │   │
│ │ phoneNumber: "+919529117230" | name: "John"             │   │
│ └──────────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "lead_def456" | status: "pending" | attempts: 0     │   │
│ │ phoneNumber: "+918329823146" | name: "Jane"             │   │
│ └──────────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "lead_ghi789" | status: "pending" | attempts: 0     │   │
│ │ phoneNumber: "+918390288495" | name: "Bob"              │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ call_logs table:                                                │
│ [Empty]                                                         │
└────────────────────────────────────────────────────────────────┘

                              │
                              │ POST /campaigns/:id/start
                              ▼

STATE 1: Campaign Started
┌────────────────────────────────────────────────────────────────┐
│ campaigns:                                                      │
│ status: "active"             ← Changed                          │
│ startedAt: "2025-10-07T20:00:00Z"  ← Timestamp set             │
└────────────────────────────────────────────────────────────────┘

                              │
                              │ First call starts
                              ▼

STATE 2: First Call in Progress
┌────────────────────────────────────────────────────────────────┐
│ leads:                                                          │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "lead_abc123"                                        │   │
│ │ status: "calling"            ← Changed from "pending"    │   │
│ │ attempts: 1                  ← Incremented               │   │
│ │ lastCallAt: "2025-10-07T..."  ← Timestamp set            │   │
│ └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘

                              │
                              │ After 2 seconds delay
                              ▼

STATE 3: Multiple Calls Active
┌────────────────────────────────────────────────────────────────┐
│ leads:                                                          │
│ ┌────────────────────────────────────────────┐                 │
│ │ lead_abc123: status="calling", attempts=1 │                 │
│ └────────────────────────────────────────────┘                 │
│ ┌────────────────────────────────────────────┐                 │
│ │ lead_def456: status="calling", attempts=1 │                 │
│ └────────────────────────────────────────────┘                 │
│ ┌────────────────────────────────────────────┐                 │
│ │ lead_ghi789: status="calling", attempts=1 │                 │
│ └────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────┘

                              │
                              │ First call completes
                              ▼

STATE 4: First Call Completed
┌────────────────────────────────────────────────────────────────┐
│ campaigns:                                                      │
│ totalCalls: 1                ← Incremented                      │
│ successfulCalls: 1           ← Incremented                      │
│                                                                 │
│ leads:                                                          │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "lead_abc123"                                        │   │
│ │ status: "completed"          ← Changed from "calling"    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ call_logs:                   ← NEW ENTRY                        │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ id: "log_xyz1"                                           │   │
│ │ campaignId: "cmgg...2hc"                                 │   │
│ │ leadId: "lead_abc123"                                    │   │
│ │ phoneNumber: "+919529117230"                             │   │
│ │ status: "completed"                                      │   │
│ │ roomName: "outbound-call-6879343e"                       │   │
│ │ dispatchId: "AD_5dk9NxVZ9kjo"                            │   │
│ │ duration: 7201                                           │   │
│ │ createdAt: "2025-10-07T..."                              │   │
│ └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘

                              │
                              │ More calls complete...
                              ▼

FINAL STATE: Campaign Completed
┌────────────────────────────────────────────────────────────────┐
│ campaigns:                                                      │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ status: "completed"          ← Changed from "active"     │   │
│ │ totalCalls: 3                                            │   │
│ │ successfulCalls: 3                                       │   │
│ │ failedCalls: 0                                           │   │
│ │ startedAt: "2025-10-07T20:00:00Z"                        │   │
│ │ completedAt: "2025-10-07T20:00:18Z"  ← Timestamp set     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ leads: (all completed)                                          │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ lead_abc123: status="completed", attempts=1              │   │
│ │ lead_def456: status="completed", attempts=1              │   │
│ │ lead_ghi789: status="completed", attempts=1              │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ call_logs: (3 entries)                                          │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ log_xyz1: John's call - duration: 7201ms - completed     │   │
│ │ log_xyz2: Jane's call - duration: 9121ms - completed     │   │
│ │ log_xyz3: Bob's call  - duration: 7768ms - completed     │   │
│ └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘

✅ CAMPAIGN COMPLETED
   Duration: 18 seconds
   Success Rate: 100% (3/3)
```

---

## 8. Complete End-to-End Flow

### 🎯 Full System Flow (All Pieces Together)

```
┌─────────────────────────────────────────────────────────────────┐
│            COMPLETE END-TO-END CAMPAIGN FLOW                     │
│         (From Setup to Finished Call)                            │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
PHASE 1: ONE-TIME SETUP
═══════════════════════════════════════════════════════════════════

[Twilio] ←→ [SIP Trunk] ←→ [LiveKit]
   ↓           ↓              ↓
Config in .env.local:
• TWILIO_ACCOUNT_SID
• LIVEKIT_OUTBOUND_TRUNK_ID
• LIVEKIT_API_KEY/SECRET

[Python Worker Running]     [Express Server Running]
voice_agent.py dev         npm run dev
Port: N/A (worker)         Port: 3000

═══════════════════════════════════════════════════════════════════
PHASE 2: CAMPAIGN SETUP
═══════════════════════════════════════════════════════════════════

User/UI
  ↓
  POST /api/v1/campaigns
  {"name": "Q4 Sales", "maxConcurrent": 3}
  ↓
[Express API] → [Prisma] → [SQLite]
  ↓
Campaign Created:
ID: cmgg...2hc
Status: draft
  ↓
  POST /api/v1/campaigns/cmgg...2hc/leads/bulk
  [Lead1: John, Lead2: Jane, Lead3: Bob]
  ↓
[Database]
├─ campaigns: 1 campaign (draft)
└─ leads: 3 leads (pending)

═══════════════════════════════════════════════════════════════════
PHASE 3: CAMPAIGN START
═══════════════════════════════════════════════════════════════════

User/UI
  ↓
  POST /api/v1/campaigns/cmgg...2hc/start
  ↓
[Campaign Controller]
├─ Update campaign.status = "active"
├─ Create CampaignQueue instance
├─ Setup event listeners
├─ Add leads to queue
└─ Start queue.start()
  ↓
[CampaignQueue Processing Loop Starts]

═══════════════════════════════════════════════════════════════════
PHASE 4: CALL EXECUTION (Time: 0s)
═══════════════════════════════════════════════════════════════════

CampaignQueue
  ↓
Pending: [Lead1, Lead2, Lead3]
Active:  []
Slots:   0/3
  ↓
START LEAD 1: John (+919529117230)
  ↓
[PythonExecutor]
  ↓
spawn("python test_outbound.py +919529117230")
  ↓
┌────────────────────────────────────────────────┐
│ Python Process 1                                │
│ ├─ Generate room: outbound-call-aaa111         │
│ ├─ Dispatch agent to room                      │
│ │  → LiveKit creates room                      │
│ │  → voice_agent.py joins room                 │
│ ├─ Create SIP call                             │
│ │  → LiveKit → Twilio → John's phone          │
│ └─ Phone rings! 📱                             │
└────────────────────────────────────────────────┘
  ↓
Update DB: lead1.status = "calling"
  ↓
Wait 2 seconds (callDelay)

═══════════════════════════════════════════════════════════════════
PHASE 5: CONCURRENT CALLS (Time: 2s)
═══════════════════════════════════════════════════════════════════

START LEAD 2: Jane (+918329823146)
  ↓
[Python Process 2]
  ↓
Room: outbound-call-bbb222
Jane's phone rings! 📱
  ↓
Update DB: lead2.status = "calling"
  ↓
Wait 2 seconds

═══════════════════════════════════════════════════════════════════
PHASE 6: MAX CONCURRENT REACHED (Time: 4s)
═══════════════════════════════════════════════════════════════════

START LEAD 3: Bob (+918390288495)
  ↓
[Python Process 3]
  ↓
Room: outbound-call-ccc333
Bob's phone rings! 📱
  ↓
Update DB: lead3.status = "calling"
  ↓
Active: [Lead1, Lead2, Lead3]
Slots: 3/3 ← MAX REACHED
  ↓
⏸️ QUEUE PAUSED - Waiting for slot to free up

═══════════════════════════════════════════════════════════════════
PHASE 7: LIVE CONVERSATIONS (Time: 5s - 15s)
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ Call 1: John (In Progress)                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ John answers → "Hello?"                             │ │
│ │ ↓ (Audio → Twilio → LiveKit → voice_agent.py)       │ │
│ │ VAD detects speech end                              │ │
│ │ ↓                                                    │ │
│ │ STT: "Hello?" (Deepgram)                            │ │
│ │ ↓                                                    │ │
│ │ LLM processes (GPT-4)                               │ │
│ │ ↓                                                    │ │
│ │ Response: "Hi John! Calling from ABC..."           │ │
│ │ ↓                                                    │ │
│ │ TTS: Audio (ElevenLabs)                             │ │
│ │ ↓                                                    │ │
│ │ LiveKit → Twilio → John hears response 🔊          │ │
│ │ ↓                                                    │ │
│ │ [Conversation continues...]                         │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Call 2: Jane (In Progress - Similar flow)               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Call 3: Bob (In Progress - Similar flow)                │
└─────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
PHASE 8: FIRST CALL COMPLETES (Time: 11s)
═══════════════════════════════════════════════════════════════════

John hangs up
  ↓
[Phone] → [Twilio] → SIP BYE → [LiveKit]
  ↓
[voice_agent.py detects disconnect]
  ↓
[Python Process 1 exits with code 0]
  ↓
[PythonExecutor captures]:
{
  success: true,
  roomName: "outbound-call-aaa111",
  dispatchId: "AD_xxx",
  duration: 7201
}
  ↓
[CampaignQueue Event: 'call_completed']
  ↓
Database Updates:
├─ UPDATE leads
│   SET status='completed', lastCallAt=NOW()
│   WHERE id='lead1'
├─ INSERT call_logs
│   (leadId, status='completed', duration=7201, ...)
└─ UPDATE campaigns
    SET successfulCalls=1, totalCalls=1
  ↓
Remove from activeLeads
Add to completedLeads
  ↓
Active: [Lead2, Lead3]
Slots: 2/3 ← SLOT AVAILABLE!
  ↓
✅ No more pending leads, wait for others to finish

═══════════════════════════════════════════════════════════════════
PHASE 9: REMAINING CALLS COMPLETE (Time: 15s - 18s)
═══════════════════════════════════════════════════════════════════

Time: 15s → Jane's call completes
  ↓ (Same flow as above)
Active: [Lead3]
Completed: [Lead1, Lead2]

Time: 18s → Bob's call completes
  ↓ (Same flow as above)
Active: []
Completed: [Lead1, Lead2, Lead3]
  ↓
[CampaignQueue Event: 'campaign_completed']

═══════════════════════════════════════════════════════════════════
PHASE 10: CAMPAIGN COMPLETION
═══════════════════════════════════════════════════════════════════

Database Updates:
└─ UPDATE campaigns
    SET status='completed',
        completedAt=NOW(),
        totalCalls=3,
        successfulCalls=3,
        failedCalls=0
  ↓
Remove from activeCampaigns Map
  ↓
┌──────────────────────────────────────────────┐
│ FINAL STATE                                  │
│                                              │
│ Campaign: cmgg...2hc                         │
│ Status: completed                            │
│ Duration: 18 seconds                         │
│                                              │
│ Results:                                     │
│ ├─ Total: 3                                  │
│ ├─ Success: 3 (100%)                         │
│ └─ Failed: 0 (0%)                            │
│                                              │
│ Call Details:                                │
│ ├─ John: 7.2s (completed)                    │
│ ├─ Jane: 9.1s (completed)                    │
│ └─ Bob:  7.8s (completed)                    │
└──────────────────────────────────────────────┘

✅ CAMPAIGN COMPLETED SUCCESSFULLY!
```

---

## Summary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUICK REFERENCE                              │
└─────────────────────────────────────────────────────────────────┘

Setup:    Twilio ←→ LiveKit SIP Trunk (one-time)
          voice_agent.py running (background worker)
          Express API running (port 3000)

Create:   POST /campaigns → Database (draft)
          POST /campaigns/:id/leads → Database (pending)

Start:    POST /campaigns/:id/start
          → CampaignQueue created
          → Processes leads with concurrency control

Execute:  For each lead:
          ├─ Spawn Python → test_outbound.py
          ├─ Dispatch agent → LiveKit room
          ├─ Create SIP call → Twilio → PSTN → Phone
          ├─ AI conversation → voice_agent.py
          │  ├─ STT (speech → text)
          │  ├─ LLM (text → response)
          │  └─ TTS (response → speech)
          ├─ Call completes
          └─ Update database

Finish:   Campaign status = completed
          All call logs saved
          Statistics updated

Monitor:  GET /campaigns/:id/stats (real-time)
          Database: campaigns, leads, call_logs
```

---

**🎉 That's the complete flow from setup to finished campaign!**

Every call goes through this entire pipeline, orchestrated by your backend API, managed by the CampaignQueue service, executed via Python, routed through LiveKit's SIP trunk to Twilio, and handled by your AI agent in real-time.
