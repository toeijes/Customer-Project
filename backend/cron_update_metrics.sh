#!/bin/bash
# สคริปต์สำหรับรันอัปเดตคำนวณสถิติยอดผู้ใช้น้ำของโครงการประจำวันตอนตี 2
# สคริปต์นี้จะถูกเรียกทำงานผ่านระบบ Cron Job ของเครื่อง Server

echo "=== START CRON METRICS UPDATE: $(date) ==="

# ย้ายไปยังโฟลเดอร์โครงการที่มี docker-compose.yml
cd /opt/Customer-Project

# The host cron scheduler is explicitly enabled independently from node-cron.
docker compose exec -T backend sh -c '
  if [ "$ENABLE_DAILY_SYNC" != "true" ]; then
    echo "ENABLE_DAILY_SYNC is not true: scheduled synchronization skipped."
    exit 0
  fi
  node sync_plan_master.js --apply && exec node update_data.js
'

echo "=== END CRON METRICS UPDATE: $(date) ==="
echo ""
