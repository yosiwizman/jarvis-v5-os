# v6.0 Monitoring Metrics & Alerts

**Version:** 6.0.0  
**Deployed:** December 6, 2025  
**Component:** Notification & Event Loop System

---

## 📊 Key Performance Indicators (KPIs)

### **1. Scheduler Health**

| Metric | Query/Check | Baseline | Alert Threshold |
|--------|-------------|----------|-----------------|
| Event Loop Uptime | Check logs for `[NotificationScheduler] Checking` every 60s | 100% | <99% |
| Event Loop Interval | Time between checks | 60s | >65s or <55s |
| Scheduler Initialization | Check startup logs | Success | Failure |
| Storage File Access | Write/read operations | Success | 2+ consecutive failures |

**How to Monitor:**
```bash
# Check event loop is running (expect output every 60s)
tail -f logs/server.log | grep "\[NotificationScheduler\] Checking"

# Verify scheduler initialized on startup
grep "\[NotificationScheduler\] Initialized" logs/server.log
```

---

### **2. Notification Volume**

| Metric | Query/Check | Expected Range | Alert Threshold |
|--------|-------------|----------------|-----------------|
| Total Events Scheduled | Count in `scheduled-events.json` | 0-100/day | >500/day (investigate spike) |
| Fired Events Count | Filter by `fired: true` | 0-100/day | >500/day |
| Pending Events | Filter by `fired: false` | 0-50 | >200 (backlog) |
| Failed Deliveries | Check error logs | 0 | >5% of total events |

**How to Monitor:**
```bash
# Count scheduled events
jq '.events | length' apps/server/data/scheduled-events.json

# Count fired events
jq '[.events[] | select(.fired == true)] | length' apps/server/data/scheduled-events.json

# Count pending events
jq '[.events[] | select(.fired == false)] | length' apps/server/data/scheduled-events.json
```

**API Query:**
```bash
curl https://localhost:3000/api/notifications/history?limit=1 | jq '.total'
```

---

### **3. SSE Connection Health**

| Metric | Query/Check | Expected | Alert Threshold |
|--------|-------------|----------|-----------------|
| Connected Clients | Check logs for client count | 1-10 | 0 (no connections) or >50 (leak) |
| Connection Errors | SSE error logs | <1/hour | >5/hour |
| Reconnection Rate | Connection drops | <1/hour/client | >3/hour/client |
| Message Delivery | Successful broadcasts | 100% | <95% |

**How to Monitor:**
```bash
# Check connected client count
grep "\[NotificationScheduler\] SSE client registered" logs/server.log | tail -5

# Check for SSE errors
grep "SSE.*error" logs/server.log
```

**Browser DevTools:**
- Open Network tab → Filter "stream"
- Connection should show `(pending)` status with `text/event-stream` type
- Check for data frames being received

---

### **4. Storage Performance**

| Metric | Query/Check | Expected | Alert Threshold |
|--------|-------------|----------|-----------------|
| File Size | `scheduled-events.json` | <1MB | >10MB (needs archival) |
| Write Latency | Time for save operation | <50ms | >200ms |
| Read Latency | Time for load operation | <100ms | >500ms |
| Corruption Incidents | JSON parse errors | 0 | Any occurrence |

**How to Monitor:**
```bash
# Check file size (Windows PowerShell)
Get-Item apps\server\data\scheduled-events.json | Select-Object Length

# Check file size (Linux/Mac)
ls -lh apps/server/data/scheduled-events.json

# Verify JSON is valid
jq . apps/server/data/scheduled-events.json > /dev/null && echo "Valid JSON" || echo "CORRUPTED"
```

---

### **5. Integration Performance**

#### **Calendar Reminders**

| Metric | Expected | Alert Threshold |
|--------|----------|-----------------|
| Sync Success Rate | >90% | <80% |
| Events Synced Per Call | 0-5 | Consistently 0 (OAuth issue) |
| Reminder Accuracy | ±1 minute | >5 minutes off |

**How to Monitor:**
```bash
curl -X POST https://localhost:3000/integrations/google-calendar/sync-reminders | jq
```

#### **Printer Alerts**

| Metric | Expected | Alert Threshold |
|--------|----------|-----------------|
| Alert Delivery Rate | 100% of completed jobs | <95% |
| Duplicate Alerts | 0 | >1 per job |

**How to Monitor:**
- Check logs after completing a 3D print job
- Verify alert appears in history API

#### **Motion Detection**

| Metric | Expected | Alert Threshold |
|--------|----------|-----------------|
| False Positive Rate | <10% | >30% |
| Cooldown Enforcement | 30s minimum between alerts | <25s |
| Missed Motion Events | <5% | >20% |

**How to Monitor:**
- Test with controlled motion
- Check alert timestamps in history

---

## 🚨 Alert Definitions

### **Critical (P0) - Immediate Action Required**

1. **Scheduler Stopped**
   - **Condition:** No event loop logs for >2 minutes
   - **Impact:** No notifications firing
   - **Action:** Restart server, check logs for crash reason

2. **Storage Corruption**
   - **Condition:** JSON parse error on startup
   - **Impact:** All scheduled events lost
   - **Action:** Restore from backup, investigate disk issues

3. **Complete SSE Failure**
   - **Condition:** All SSE connections fail for >5 minutes
   - **Impact:** No real-time notifications
   - **Action:** Check network, verify server accessible

### **High (P1) - Fix Within 24 Hours**

1. **High False Positive Rate**
   - **Condition:** >30% of motion alerts are false positives
   - **Impact:** User annoyance, alert fatigue
   - **Action:** Adjust detection threshold

2. **Storage File Growing Rapidly**
   - **Condition:** >10MB file size
   - **Impact:** Performance degradation
   - **Action:** Archive old events, implement soft-delete

3. **SSE Connection Leaks**
   - **Condition:** >50 connected clients
   - **Impact:** Memory/performance issues
   - **Action:** Check client cleanup logic

### **Medium (P2) - Fix Within 1 Week**

1. **Calendar Sync Failures**
   - **Condition:** <80% sync success rate
   - **Impact:** Missed calendar reminders
   - **Action:** Check OAuth tokens, API quotas

2. **Delayed Notifications**
   - **Condition:** Notifications firing >5 min late
   - **Impact:** Poor user experience
   - **Action:** Check server time sync, event loop performance

---

## 📈 Dashboard Queries

### **Daily Health Check (Manual)**

```bash
# 1. Check scheduler is running
grep "Event loop started" logs/server.log | tail -1

# 2. Count today's notifications
jq '[.events[] | select(.createdAt | startswith("2025-12-06"))] | length' apps/server/data/scheduled-events.json

# 3. Check SSE connections
grep "SSE client registered" logs/server.log | tail -10

# 4. Verify no errors
grep -i "error" logs/server.log | grep -i "notification" | tail -20
```

### **Weekly Metrics Report**

```bash
# Total events this week
jq '[.events[] | select(.createdAt | startswith("2025-12"))] | length' apps/server/data/scheduled-events.json

# Events by type
jq '[.events[] | .type] | group_by(.) | map({type: .[0], count: length})' apps/server/data/scheduled-events.json

# File size growth
ls -lh apps/server/data/scheduled-events.json
```

---

## 🔧 Troubleshooting Runbook

### **Issue: Notifications Not Firing**

1. Check scheduler is running:
   ```bash
   grep "Checking.*scheduled events" logs/server.log | tail -5
   ```

2. Verify event exists and is due:
   ```bash
   jq '.events[] | select(.fired == false)' apps/server/data/scheduled-events.json
   ```

3. Check system time is correct:
   ```bash
   date -u
   ```

4. Restart scheduler (if needed):
   ```bash
   npm run dev  # Server will reinitialize scheduler
   ```

### **Issue: SSE Not Connecting**

1. Check server is running:
   ```bash
   curl https://localhost:3000/api/notifications/stream
   ```

2. Verify HTTPS certificate:
   ```bash
   npm run web  # Recreates cert if needed
   ```

3. Check browser console for errors

4. Try incognito/private window (clear cache)

### **Issue: Storage File Corrupted**

1. Backup current file:
   ```bash
   cp apps/server/data/scheduled-events.json apps/server/data/scheduled-events.backup.json
   ```

2. Delete corrupted file:
   ```bash
   rm apps/server/data/scheduled-events.json
   ```

3. Restart server (will create fresh file):
   ```bash
   npm run dev
   ```

---

## 📅 Monitoring Schedule

**Daily:**
- Check scheduler event loop logs (1 minute)
- Verify file size <1MB (30 seconds)
- Spot-check SSE connections in browser (1 minute)

**Weekly:**
- Run full health check script (5 minutes)
- Review alert counts by type (5 minutes)
- Check for any error patterns (10 minutes)
- Archive old events if file >5MB (10 minutes)

**Monthly:**
- Review false positive rates for motion detection (30 minutes)
- Analyze notification volume trends (30 minutes)
- Update alert thresholds based on actual usage (1 hour)
- Plan feature enhancements based on metrics (2 hours)

---

## 🎯 Success Criteria (First Month)

- [ ] 99.9% scheduler uptime
- [ ] <1% notification delivery failures
- [ ] <10% motion detection false positives
- [ ] <100ms average history API response time
- [ ] 0 critical (P0) incidents
- [ ] <3 high (P1) incidents

---

**Last Updated:** December 6, 2025  
**Owner:** Platform Engineering Team  
**Review Cycle:** Monthly
