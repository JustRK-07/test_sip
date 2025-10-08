# Quick Cleanup Checklist

**⚡ Fast reference for preventing code bloat**

---

## 🔴 DELETE OR INTEGRATE NOW

```
❌ src/services/AgentAvailabilityTracker.js (159 lines, ZERO usage)
❌ Fix Winston EPIPE errors in src/utils/logger.js
```

## 🟡 DECIDE THIS WEEK

```
⚠️  Bull/Redis (5.5MB) - Use it or remove it?
⚠️  node-cron - Implement scheduler or remove?
⚠️  dispatchId field - Remove or document as active?
⚠️  Dispatch method - Rules (1s) vs Explicit (2.6s)?
```

## 🟢 REMOVE WHEN CONFIRMED UNUSED

```
📦 DB Fields:
   - CallLog.recordingUrl (needs webhook)
   - Agent.voiceId (not passed to LiveKit)
   - Agent.personality (not used)
   - Agent.systemPrompt (not used)

🗂️  Python Services (check if agent needs them):
   - services/dispatch_service.py
   - services/sip_manager.py
```

---

## 📝 MISSING FEATURES (Implement or Remove from Docs)

```
[ ] Webhook handler (Phase 7)
[ ] Campaign scheduler (Phase 8)
[ ] Analytics dashboard (Phase 9)
```

---

## ✅ BEFORE COMMITTING CODE

```bash
# Check for unused imports
grep -r "require.*AgentAvailability" src/
grep -r "require.*bull" src/
grep -r "require.*node-cron" src/

# Check package size
npm list bull redis node-cron 2>/dev/null | head -5

# Verify no TODOs older than 30 days
grep -r "TODO" src/ --exclude-dir=node_modules
```

---

## 🚀 QUICK WINS (< 30 min each)

1. Delete AgentAvailabilityTracker.js if not using multi-agent
2. Remove bull, redis, node-cron if not using queues/scheduler
3. Fix Winston EPIPE error handling
4. Add cleanup job for uploads/ directory
5. Update CURRENT-ARCHITECTURE.md to match code

---

**For full details:** See [CODE-CLEANUP-GUIDE.md](./CODE-CLEANUP-GUIDE.md)
