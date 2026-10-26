# Node.js security update — 26 October 2026

## ขอบเขตและข้อมูลอ้างอิง

ตรวจประกาศทางการล่าสุดในหน้า security ของ Node.js ณ 26 ตุลาคม 2026:

- [Node.js October 21 security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Node.js 24.22.1 release notes](https://nodejs.org/en/blog/release/v24.22.1)
- [รายการ security announcements](https://nodejs.org/en/blog/vulnerability)

ใช้ Node.js **24.22.1** เป็น baseline สำหรับ local, backend container, frontend builder และ CI แทน local 24.15.0 และ Docker/CI สาย 20 เดิม รุ่นนี้มีแพตช์ CVE-2026-105482, CVE-2026-105483, CVE-2026-106069 และ CVE-2026-111497 รวมทั้งรายการอื่นที่เกี่ยวข้องกับสาย 24 ในประกาศเดียวกัน

ผลนี้เป็นการตรวจ source code, dependencies, local บน Windows และ Linux containers รวมถึงการเชื่อม MySQL/LDAPS ตาม configuration ของ local ไม่ใช่การตรวจเครื่อง production และไม่รับรองว่าไม่มีช่องโหว่อื่นหรือการโจมตีเกิดขึ้นแล้ว

## การแก้ไข

- กำหนด `.node-version`, `.nvmrc`, `engines` และ `.npmrc` ให้การติดตั้งใช้ Node.js 24.x ตั้งแต่ 24.22.1; backend ตรวจ runtime ก่อนโหลดแอปและปฏิเสธรุ่นเก่า
- Docker ใช้ `node:24.22.1-alpine`; frontend เปลี่ยนเป็น `npm ci` เพื่อใช้ lockfile; build context ไม่นำเข้า `.env.*` และ log files
- อัปเดต Alpine packages ภายใน image ด้วย `apk upgrade --no-cache` หลังสแกนพบ Brotli/curl ใน Nginx image เดิม และอัปเดต npm ใน backend/build stage เป็น 11.21.1 พร้อมแพตช์เฉพาะ bundled Undici เป็น 6.29.1 (npm 11.21.1 และ 12.2.1 ยังรวม 6.29.0 ณ เวลาตรวจ) ติดตั้ง module แยกก่อนแทนที่เพื่อไม่ให้ติดตั้ง dev dependencies ของ npm เอง
- อัปเดต dependencies ตามรายการ audit โดยไม่ใช้ `--force` และคง Express 4 / Vitest 4; commit package-lock.json ทั้งสองฝั่งพร้อมโค้ด
- API ปฏิเสธ `Content-Encoding` ที่ไม่ใช่ `identity` ด้วย HTTP 415 ก่อน parse body ปิด decompression ด้วย `inflate: false` และระบุ JSON limit 100 KB เท่า default เดิม
- Browser frontend ส่ง JSON ปกติจึงใช้ได้ตามเดิม; integration ที่ส่ง gzip/deflate/br ต้องเปลี่ยนเป็นข้อมูลไม่บีบอัด การบล็อก request ไม่ได้ป้องกันเส้นทางคลาย Brotli อื่น เช่น response ฝั่ง outbound จึงต้องอัปเดต runtime ด้วย
- CI ตรวจ runtime/DNS/TLS และหยุดเมื่อ `npm audit` พบตั้งแต่ระดับ Moderate รวม dev dependencies
- แก้ lint เดิมใน InvestmentBreakEven โดยรีเซ็ต pagination เมื่อ filter เปลี่ยนก่อน render เสร็จ แทนการเรียก setState ใน effect; ไม่เปลี่ยนสูตรรายงานหรือ SQL

dependencies ที่มีแพตช์ใน lockfile:

| ส่วน | แพ็กเกจสำคัญหลังแก้ |
| --- | --- |
| Backend | express 4.22.3, body-parser 1.20.9, proxy-addr 2.0.8, qs 6.16.1, ip-address 10.7.5 |
| Frontend/build | vite 8.3.5, brace-expansion 5.0.12, undici 8.12.3, zod 4.6.7 |
| ทั้งสองฝั่ง | vitest / coverage-v8 / mocker 4.1.12, source-map-js 1.2.2 |

ประกาศผู้พัฒนาที่ใช้ตรวจเพิ่มเติม:

- [body-parser DoS และแนวทางปิด inflate](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
- [proxy-addr IP spoofing](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) — เงื่อนไขที่ประกาศระบุคือ trust subnet แบบ IPv6 บางรูปแบบ; โปรเจกต์ใช้ hop count 1 แต่ยังอัปเดตแพ็กเกจ
- [Vitest manual mock injection](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8)
- [Vitest Windows path traversal](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp)

## ผลตรวจ local

| รายการ | ก่อนแก้ | หลังแก้ |
| --- | --- | --- |
| npm audit backend รวม dev | 10 แพ็กเกจ: Critical 1, High 3, Moderate 6 | 0 |
| npm audit frontend รวม dev | 8 แพ็กเกจ: High 5, Moderate 3 | 0 |
| ติดตั้งจาก lockfile | — | `npm ci` ผ่านทั้งสองฝั่งบน Node.js 24.22.1 |
| Backend tests | 54 ผ่าน | 59 ผ่าน รวม request บีบอัดและ JSON เกินขนาด |
| Frontend tests | 14 ผ่าน | 14 ผ่าน |
| Frontend lint / production build | — | ผ่าน; build มีคำเตือน bundle ใหญ่กว่า 500 KB |
| Runtime security checks | — | baseline, DNS NUL rejection, TLS non-canonical IPv4 rejection และ valid DNS identity ผ่าน |

ตัวเลข audit เป็นจำนวนแพ็กเกจที่ npm จัดเป็น vulnerable ไม่ใช่จำนวน CVE ที่ไม่ซ้ำ ผลเป็นสถานะของ registry ณ เวลาตรวจ ไม่ครอบคลุมช่องโหว่ใน OS/Nginx/container base image

Runtime regression checks ใช้ชื่อและ certificate metadata สำหรับทดสอบโดยไม่เชื่อมต่อบริการภายนอก ไม่ได้ยิง exploit Brotli/RCE ส่วน LDAP unit tests ใช้ client จำลอง ผลตรวจ live handshake อยู่ด้านล่าง

เริ่ม Docker Engine และทดสอบ container แล้วตามรายละเอียดด้านล่าง ไม่รัน migration, data rebuild หรือ cron และไม่แก้ schema/สูตร/refresh rules

## ผลทดสอบ container และการเชื่อมต่อจริงเพิ่มเติม

ใช้ Compose project แยกชื่อ `customer-security-smoke` เปิด frontend เฉพาะ `127.0.0.1` บนพอร์ตชั่วคราว บังคับ SAFE_LOCAL_MODE=true, ENABLE_SCHEMA_INIT=false, ENABLE_CRON=false และ ENABLE_DAILY_SYNC=false โดยไม่เปลี่ยน `.env` เดิม เนื่องจากฐานข้อมูล local อยู่ที่ 127.0.0.1 จึงใช้ `host.docker.internal` เฉพาะ stack ทดสอบเพื่อเข้าถึงฐานข้อมูลบน host

| รายการตรวจจริง | ผล |
| --- | --- |
| Docker pull/build backend และ frontend | ผ่านบน Linux/amd64 |
| Node.js ภายใน backend | 24.22.1 |
| หน้าเว็บและ production JavaScript ผ่าน Nginx | HTTP 200 |
| Nginx proxy ไป API โดยไม่มี session | HTTP 401 พร้อม security headers |
| API รับ br/gzip/deflate/encoding ซ้อน | HTTP 415 |
| JSON ใหญ่กว่า 100 KB | HTTP 413 |
| POST จาก Origin ที่ไม่อนุญาต | HTTP 403 |
| Login JSON ว่างและ rate limit | HTTP 400 แล้ว 429; ใช้ limit 2 เฉพาะ stack ทดสอบ |
| MySQL จาก Windows และ backend container | เชื่อมต่อ MySQL 8.4.3 ผ่าน ตรวจ SELECT 1 และ metadata ใน START TRANSACTION READ ONLY แล้ว ROLLBACK |
| ตารางที่ตรวจพบในฐานข้อมูลที่ configuration ระบุ | users, roles, user_roles, pwa_branches, projects, plan_master, project_monthly_usage, project_usage_summary |
| LDAPS จาก Windows และ backend container | TLS authorized=true; certificate หมดอายุ 7 ตุลาคม 2027 |
| Negative LDAPS handshake จาก Windows | hostname ไม่ตรง certificate ถูกปฏิเสธด้วย ERR_TLS_CERT_ALTNAME_INVALID |
| Runtime DNS/TLS regression ภายใน container | ผ่าน |

การตรวจ MySQL เป็นการตรวจการเชื่อมต่อและการมีตารางตามรายการ ไม่ใช่การตรวจครบทุก column, constraint, index หรือความถูกต้องของข้อมูลรายงาน ไม่ได้ส่ง credentials ไปยัง AD หรือทดสอบ login ด้วยบัญชีจริง และไม่ได้ทดสอบ workflow เขียนข้อมูล

## การสแกน container images

Docker Scout ต้องล็อกอิน จึงใช้ Trivy สแกนไฟล์ image ที่ export ในเครื่อง โดยไม่ push image ไป registry และไม่กรอง CVE ทิ้ง ใช้เฉพาะ vulnerability scanner ระดับ HIGH/CRITICAL; ไม่ใช่ secret/configuration scan หรือการยืนยันว่าไม่มีช่องโหว่ระดับอื่น

ผลก่อนอัปเดต OS/npm เพิ่มเติม:

- Backend: High 5 findings ใน dependencies ของ bundled npm ได้แก่ brace-expansion, http-cache-semantics และ undici
- Frontend: High 3 findings ได้แก่ CVE-2026-111497 ใน brotli-libs 1.2.0-r1 และ CVE-2026-92392 ใน curl/libcurl 8.22.0-r0

แก้ frontend เป็น brotli-libs 1.2.1-r0 และ curl/libcurl 8.23.0-r0; แก้ npm เป็น 11.21.1 และ bundled Undici เป็น 6.29.1 อ้างอิง [curl advisory](https://curl.se/docs/CVE-2026-92392.html) และ [Undici security release](https://github.com/nodejs/undici/releases/tag/v6.29.1)

ผลสแกนฉบับสุดท้าย ณ 26 ตุลาคม 2026 โดยไม่มี ignore list:

| Image | HIGH | CRITICAL | รายงาน local |
| --- | --- | --- | --- |
| Backend | 0 | 0 | [.tools/backend-image-audit-final.json](.tools/backend-image-audit-final.json) |
| Frontend | 0 | 0 | [.tools/frontend-image-audit-final.json](.tools/frontend-image-audit-final.json) |

Image IDs ที่สแกนและทดสอบ:

```text
backend:  sha256:ba4ec08103f06fec737a2f961afa45725ef9ece65f8b9cebff9a6b3f4d9a1532
frontend: sha256:1446c92a28963f65812d1393183be9a753ee7a15e68d159560a4a238f105be86
```

Trivy image digest: `sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c` ใช้ฐานข้อมูล CVE ที่ดาวน์โหลดในวันตรวจ Backend scan สุดท้ายใช้ `--exit-code 1` และจบด้วย exit code 0; frontend runtime image มี image ID เดิมกับผลสแกน 0 และถูกทดสอบ HTTP ซ้ำหลัง build สุดท้าย

ตรวจ runtime/DNS/TLS, MySQL READ ONLY และ LDAPS ใน backend image สุดท้ายผ่าน พร้อมทดสอบ HTTP ทุกกรณีในตารางซ้ำหลัง recreate และรัน unit tests ซ้ำได้ backend 59 / frontend 14 ผ่าน ปิด container และ network ของ stack ทดสอบเมื่อเสร็จ ไม่หยุดบริการเดิมหรือ Docker Desktop

Raw JSON reports และสคริปต์ทดสอบประกอบอยู่ใน `.tools/` (git ignored) สำหรับตรวจใน local ไม่ใช่ไฟล์ที่ต้อง deploy ผล 0 นี้จำกัดตาม scanner/ระดับ severity/ฐานข้อมูลในเวลาตรวจ

## เปิดใช้บน Windows local

ติดตั้ง runtime แบบ portable ไว้ใน `.tools/` ซึ่ง git ignore แล้ว ตรวจ SHA256 ของ ZIP เทียบกับ SHASUMS256.txt จาก HTTPS ของ nodejs.org ก่อนแตกไฟล์ การติดตั้ง Node.js ส่วนกลางยังเป็น 24.15.0 และ process ที่เปิดค้างต้องปิดแล้วเริ่มใหม่

จาก root โปรเจกต์ เปิด shell ใหม่พร้อม runtime ที่มีแพตช์:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -Command ". ./scripts/use-local-node.ps1"
```

ใช้คำสั่งต่อไปนี้ภายใน shell ใหม่นั้น (`ExecutionPolicy` ใช้เฉพาะ process นี้ ไม่เปลี่ยนนโยบายเครื่อง):

```powershell
node --version
node scripts/verify-node-security.cjs
npm.cmd --prefix backend ci
npm.cmd --prefix backend test
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
```

เปิด backend โดยใช้ `.env` ของ local ที่ตรวจแล้ว ตั้ง SAFE_LOCAL_MODE=true, ENABLE_SCHEMA_INIT=false และ ENABLE_CRON=false หากใช้ข้อมูลอ้างอิงที่ต้องการอ่านอย่างเดียว:

```powershell
$env:SAFE_LOCAL_MODE = 'true'
$env:ENABLE_SCHEMA_INIT = 'false'
$env:ENABLE_CRON = 'false'
npm.cmd --prefix backend run dev
```

เปิด frontend ใน shell ที่ใช้ runtime ใหม่อีกหน้าต่างด้วย `npm.cmd --prefix frontend run dev` หากต้องทดสอบงานเขียนข้อมูลให้ใช้ฐานข้อมูลทดสอบแยกและตรวจปลายทางก่อนปิด safe mode

## ขั้นตอนนำขึ้นเครื่องจริง (ยังไม่ได้ดำเนินการ)

1. ตรวจ diff/CI และตรวจประกาศใหม่ก่อน deploy เก็บ commit และ image ID ของ backend/frontend เดิมไว้เพื่อ rollback พร้อมสำรอง configuration ในที่ปลอดภัย ตรวจว่า environment ไม่เปิด schema initialization/cron โดยไม่ตั้งใจ
2. เริ่ม Docker Engine บน local หรือ staging แล้ว build/test image ก่อนใช้งานจริง:

```sh
docker compose build --pull --no-cache backend frontend
docker compose run --rm --no-deps backend node --version
```

3. เมื่อผ่าน staging แล้วนำ source รวม Dockerfiles, package manifests, lockfiles และ `.npmrc` ขึ้นเครื่องจริง จากนั้น build และ recreate service ในช่วงเวลาที่กำหนด:

```sh
docker compose build --pull --no-cache backend frontend
docker compose up -d --no-build backend frontend
docker compose exec -T backend node --version
docker compose ps
docker compose logs --tail=100 backend frontend
```

4. ต้องได้ Node.js 24.22.1 ใน backend ที่รันจริง ทดสอบหน้าเว็บ/login/logout, สิทธิ์ admin/ผู้ใช้ทั่วไป, API รายงาน และงาน import ที่ใช้จริง ผ่าน HTTPS ตรวจ LDAP CA/hostname และ cookie โดยไม่ปิด certificate validation ตรวจการปฏิเสธ request บีบอัดเป็น 415 และ request ไม่มีสิทธิ์เป็น 401/403
5. ถ้ารันนอก Docker ต้องติดตั้ง Node.js 24.22.1 หรือแพตช์ใหม่กว่าในสาย 24, ใช้ `npm ci --omit=dev` สำหรับ backend และ restart ทุก service/process ให้ชี้ runtime ใหม่ รวม scheduled jobs ที่เรียก node; upload source อย่างเดียวไม่เปลี่ยน runtime
6. ถ้าต้อง rollback ให้ชี้ Compose override ไปยัง image ID/tag เดิมที่บันทึกไว้และ recreate service พร้อมย้อน code/config ที่เกี่ยวข้อง หลีกเลี่ยง rebuild tag เก่าที่ไม่ระบุ image เดิม การกลับ runtime เก่าทำให้ความเสี่ยงกลับมา ควรจำกัดการเข้าถึงระหว่างแก้ปัญหา ไม่มี database migration ในชุดนี้

ให้ตรวจ npm audit และ security announcements ซ้ำก่อน deploy แต่ละครั้ง เพราะผลเป็นข้อมูล ณ วันตรวจ ไม่ใช่การรับรองความปลอดภัยถาวร
