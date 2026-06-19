#!/bin/bash
# สคริปต์สำหรับรันอัปเดตคำนวณสถิติยอดผู้ใช้น้ำของโครงการประจำวันตอนตี 2
# สคริปต์นี้จะถูกเรียกทำงานผ่านระบบ Cron Job ของเครื่อง Server

echo "=== START CRON METRICS UPDATE: $(date) ==="

# ย้ายไปยังโฟลเดอร์โครงการที่มี docker-compose.yml
cd /opt/Customer-Project

# สั่งรันอัปเดตคำนวณข้อมูลสถิติใหม่ภายใน Docker Container (ใช้ -T เพื่อระบุว่าเป็น Non-interactive)
docker compose exec -T backend node update_data.js

echo "=== END CRON METRICS UPDATE: $(date) ==="
echo ""
