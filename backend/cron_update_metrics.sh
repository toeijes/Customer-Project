#!/bin/bash
# สคริปต์สำหรับรันอัปเดตคำนวณสถิติยอดผู้ใช้น้ำของโครงการประจำวันตอนตี 2
# สคริปต์นี้จะถูกเรียกทำงานผ่านระบบ Cron Job ของเครื่อง Server

echo "=== START CRON METRICS UPDATE: $(date) ==="

# ย้ายไปยังโฟลเดอร์โครงการที่มี docker-compose.yml
cd /opt/Customer-Project

# ENABLE_CRON must be explicitly enabled inside the backend container.
docker compose exec -T backend sh -c '
  if [ "$ENABLE_CRON" != "true" ]; then
    echo "ENABLE_CRON is not true: scheduled metrics update skipped."
    exit 0
  fi
  exec node update_data.js
'

echo "=== END CRON METRICS UPDATE: $(date) ==="
echo ""
