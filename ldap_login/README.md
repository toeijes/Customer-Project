# PWA AD Login Template

ระบบ login ด้วยบัญชี Active Directory (PWA) เขียนด้วย PHP ล้วน ไม่ใช้ framework, Composer หรือฐานข้อมูล
นำไปวางในโปรเจกต์แล้วเพิ่ม 2 บรรทัดบนหน้าที่ต้องการป้องกันก็ใช้งานได้

- Login ด้วย `ชื่อผู้ใช้` / `PWA\ชื่อผู้ใช้` / `ชื่อผู้ใช้@pwa.local`
- Login เสร็จพากลับไปหน้าที่ผู้ใช้ตั้งใจจะเปิด หรือหน้าที่ตั้งไว้ใน config
- จำกัดสิทธิ์ตามกลุ่มใน AD ได้ทั้งระบบหรือรายหน้า
- Session หมดอายุอัตโนมัติ, กัน CSRF, กัน open redirect, จำกัดจำนวนครั้งที่ใส่รหัสผิด

---

## สารบัญ

1. [ความต้องการของระบบ](#1-ความต้องการของระบบ)
2. [ติดตั้ง](#2-ติดตั้ง)
3. [ตั้งค่า (`config.php`)](#3-ตั้งค่า-configphp)
4. [ใช้งานในหน้าของคุณ](#4-ใช้งานในหน้าของคุณ)
5. [ข้อมูลผู้ใช้ (`$user`)](#5-ข้อมูลผู้ใช้-user)
6. [จำกัดสิทธิ์ตามกลุ่ม AD](#6-จำกัดสิทธิ์ตามกลุ่ม-ad)
7. [การ redirect](#7-การ-redirect)
8. [Session และการหมดเวลา](#8-session-และการหมดเวลา)
9. [บันทึก log การ login (`on_login`)](#9-บันทึก-log-การ-login-on_login)
10. [รายการฟังก์ชัน](#10-รายการฟังก์ชัน)
11. [ความปลอดภัย](#11-ความปลอดภัย)
12. [แก้ปัญหา](#12-แก้ปัญหา)

---

## 1. ความต้องการของระบบ

| รายการ | ค่า |
|---|---|
| PHP | 8.1 ขึ้นไป |
| PHP extensions | `ldap`, `mbstring` (`session` มีมาในตัว) |
| เครือข่าย | เครื่อง web server ต้องต่อ `R06-DC01.pwa.local` (192.168.60.203) port `636` ได้ และ resolve ชื่อนี้ได้ |
| CA | เครื่อง web server ต้องเชื่อ CA `pwa-HQ-DC02-CA` (ดูหัวข้อ LDAPS ในข้อ 11) |

```bash
# Ubuntu / Debian (เปลี่ยน 8.3 ให้ตรงกับเวอร์ชัน PHP)
sudo apt install php8.3-ldap php8.3-mbstring
sudo systemctl restart apache2        # หรือ php8.3-fpm

php -m | grep -E 'ldap|mbstring'      # ต้องเห็นทั้งสองตัว
getent hosts R06-DC01.pwa.local       # ต้องได้ 192.168.60.203 (ถ้าไม่ได้ เพิ่มใน /etc/hosts)
nc -zv R06-DC01.pwa.local 636         # ต้องขึ้น succeeded
```

## 2. ติดตั้ง

**โครงสร้างไฟล์**

```
ldap_login/
├── config.php      ค่าตั้งทั้งหมด  ← แก้ไฟล์นี้ไฟล์เดียว
├── auth.php        ฟังก์ชันของระบบ (ไม่ต้องแก้)
├── login.php       หน้า login
├── logout.php      ออกจากระบบ
├── home.php        หน้าตัวอย่าง ← ใช้เป็นแม่แบบ แล้วแทนด้วยหน้าจริงของคุณ
├── index.php       พาไป login.php หรือหน้าหลัก
├── tools/fetch_ad_ca.php  ดึงไฟล์ CA ของ AD สำหรับ LDAPS (รันด้วย CLI)
└── assets/style.css
```

**ขั้นตอน**

1. คัดลอกโฟลเดอร์ `ldap_login/` ไปไว้ใต้ document root เช่น `/var/www/html/ldap_login/`
2. แก้ `config.php` อย่างน้อย `app_name` และ `redirect_after_login` (ชี้ไปหน้าจริงของคุณ ไม่ใช่ `home.php`)
3. เปิด `http://<server>/ldap_login/` แล้วลอง login

ทดสอบบนเครื่องตัวเองได้ด้วย built-in server ของ PHP:

```bash
cd ldap_login
php -S localhost:8000      # เปิด http://localhost:8000
```

ตอนพัฒนาตั้ง `'debug' => true` ใน `config.php` แล้ว `home.php` จะแสดงข้อมูล `$user` ทั้งหมดให้ดูว่ามีช่องอะไรบ้าง อย่าเปิดไว้บนเครื่องจริง

**แจกจ่ายเป็นไฟล์ zip** (ไม่รวม `CLAUDE.md`, `.gitignore`, `.gitattributes` และไม่รวม `Refs/` ซึ่งไม่ได้อยู่ใน git)

```bash
git archive --format=zip --prefix=ldap_login/ -o ldap_login.zip HEAD
```

## 3. ตั้งค่า (`config.php`)

| คีย์ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `app_name` | `'PWA Portal'` | ชื่อระบบ แสดงบนหน้า login และแถบด้านบน |
| `debug` | `false` | `true` = `home.php` แสดงข้อมูล `$user` ทั้งหมด (ตอนพัฒนาเท่านั้น) |
| `ldap.server` | `'ldaps://R06-DC01.pwa.local'` | ที่อยู่ AD (LDAPS ต้องใช้ชื่อเครื่อง ไม่ใช่ IP) |
| `ldap.start_tls` | `false` | `true` = เข้ารหัสการเชื่อมต่อด้วย STARTTLS |
| `ldap.domain` | `'PWA'` | NetBIOS domain ใช้ bind แบบ `PWA\user` |
| `ldap.base_dn` | `'dc=PWA,dc=local'` | จุดเริ่มค้นหาผู้ใช้ |
| `ldap.timeout` | `5` | วินาที รอการเชื่อมต่อ AD |
| `ldap.nested_groups` | `false` | `true` = นับกลุ่มที่ซ้อนกันด้วย (ดูข้อ 6) |
| `redirect_after_login` | `'home.php'` | หน้าปลายทางหลัง login (ดูข้อ 7) |
| `redirect_after_logout` | `'login.php'` | หน้าปลายทางหลัง logout |
| `base_path` | `null` | path ของโฟลเดอร์บนเว็บ เช่น `'/ldap_login'`; `null` = หาเอง |
| `allowed_groups` | `[]` | ว่าง = ทุกคนใน AD เข้าได้, หรือระบุชื่อกลุ่มที่อนุญาต |
| `session.name` | `'PWA_AUTH'` | ชื่อ cookie ของ session |
| `session.idle_timeout` | `1800` | วินาที ไม่ได้ใช้งานเกินนี้ต้อง login ใหม่ |
| `session.max_lifetime` | `28800` | วินาที login ค้างได้นานสุด (8 ชม.) |
| `throttle.max_attempts` | `5` | ใส่รหัสผิดได้กี่ครั้ง (ต่อ IP) |
| `throttle.lockout` | `60` | วินาที ที่ต้องรอหลังผิดครบ |
| `on_login` | `null` | ฟังก์ชันที่เรียกหลัง login สำเร็จ (ดูข้อ 9) |

## 4. ใช้งานในหน้าของคุณ

### ป้องกันหน้าให้ต้อง login

```php
<?php
require __DIR__ . '/auth.php';      // ถ้าอยู่คนละโฟลเดอร์ใช้ path จริง เช่น '/var/www/html/ldap_login/auth.php'
$user = require_login();

?>
<h1>สวัสดี <?= h($user['name']) ?></h1>
<p>ฝ่าย: <?= h($user['department']) ?></p>
```

ถ้ายังไม่ login จะถูกพาไป `login.php?next=<หน้านี้>` และกลับมาที่หน้านี้เองหลัง login

### หน้าที่ไม่บังคับ login แต่อยากรู้ว่าใคร login อยู่

```php
require __DIR__ . '/auth.php';
$user = current_user();             // array หรือ null

if ($user) { echo 'สวัสดี ' . h($user['name']); }
else       { echo '<a href="' . h(url('login.php')) . '">เข้าสู่ระบบ</a>'; }
```

### ปุ่มออกจากระบบ

`logout.php` รับเฉพาะ POST ที่มี CSRF token ต้องเป็นฟอร์ม ไม่ใช่ลิงก์ธรรมดา:

```php
<form method="post" action="<?= h(url('logout.php')) ?>">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <button type="submit">ออกจากระบบ</button>
</form>
```

### กฎที่ต้องทำตาม

- แสดงค่าใด ๆ ใน HTML ให้ครอบด้วย `h()` เสมอ
- ฟอร์ม POST ทุกฟอร์มใส่ `csrf_token()` และตรวจด้วย `csrf_valid($_POST['csrf'] ?? null)`
- ลิงก์ไปไฟล์ในระบบ login ใช้ `url('ชื่อไฟล์')` เพื่อให้ path ถูกเมื่อวางในโฟลเดอร์ย่อย
- `require_login()` / `current_user()` ต้องเรียก **ก่อน** ส่ง HTML ออกไป (เพราะต้องส่ง header redirect และ cookie)

## 5. ข้อมูลผู้ใช้ (`$user`)

`require_login()` และ `current_user()` คืน array นี้ (ค่าที่ AD ไม่มีจะเป็น `''`)

| คีย์ | ตัวอย่าง | ที่มาใน AD |
|---|---|---|
| `username` | `somchai` | `sAMAccountName` |
| `name` | `สมชาย ใจดี` | `displayName` (ถ้าไม่มีใช้ ชื่อ + นามสกุล) |
| `first_name` | `สมชาย` | `givenName` |
| `last_name` | `ใจดี` | `sn` |
| `email` | `somchai@pwa.co.th` | `mail` |
| `title` | `วิศวกร 6` | `title` |
| `department` | `กองระบบสารสนเทศ` | `department` |
| `company` | `กปภ.ข.1` | `company` |
| `phone` | `1234` | `telephoneNumber` |
| `dn` | `CN=Somchai,OU=Users,DC=PWA,DC=local` | distinguished name |
| `groups` | `['IT-Staff', 'VPN-Users']` | ชื่อกลุ่ม (CN) จาก `memberOf` เรียงตามตัวอักษร |
| `login_at` | `1759823000` | Unix timestamp ตอน login |
| `last_seen` | `1759823500` | Unix timestamp ครั้งล่าสุดที่เปิดหน้า |

ข้อมูลนี้เก็บใน PHP session **ตั้งแต่ตอน login** ถ้าแก้ข้อมูลหรือกลุ่มใน AD ผู้ใช้ต้อง login ใหม่ถึงจะเห็นค่าใหม่
ระบบ**ไม่เก็บรหัสผ่าน**ไว้ที่ใดเลย

ต้องการแอตทริบิวต์เพิ่ม (เช่น `employeeID`) ให้แก้ใน `ad_authenticate()` ใน `auth.php`: เพิ่มชื่อ (ตัวพิมพ์เล็ก) ใน `$attrs` และเพิ่มคีย์ใน array ที่ `return`

## 6. จำกัดสิทธิ์ตามกลุ่ม AD

ชื่อกลุ่มคือ CN ของกลุ่ม (ไม่สนตัวพิมพ์เล็ก/ใหญ่)

**ทั้งระบบ** — คนที่ไม่อยู่ในกลุ่มจะ login ไม่ผ่าน ("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ")

```php
'allowed_groups' => ['IT-Staff', 'Admins'],   // อยู่กลุ่มใดกลุ่มหนึ่งก็พอ
```

**รายหน้า** — คนที่ไม่อยู่ในกลุ่มจะเห็นหน้า 403 "ไม่มีสิทธิ์เข้าถึง"

```php
$user = require_group('Admins');               // ใช้แทน require_login() ได้เลย
$user = require_group('Admins', 'IT-Staff');    // อยู่กลุ่มใดกลุ่มหนึ่ง
```

**เช็กเงื่อนไขเอง** — เช่น ซ่อน/แสดงเมนู

```php
<?php if (has_group($user, 'Admins')): ?>
    <a href="admin.php">จัดการระบบ</a>
<?php endif; ?>
```

**กลุ่มซ้อน:** ค่าเริ่มต้นนับเฉพาะกลุ่มที่ผู้ใช้เป็นสมาชิก**โดยตรง** ถ้าสิทธิ์ให้ผ่านกลุ่มซ้อน (ผู้ใช้อยู่ใน `IT-Team` ซึ่งอยู่ใน `Admins`) ให้ตั้ง `'nested_groups' => true` (login ช้าลงเล็กน้อย)

## 7. การ redirect

ลำดับการเลือกหน้าหลัง login:

1. `?next=` ใน URL — ระบบใส่ให้เองเมื่อผู้ใช้เปิดหน้าที่ต้อง login ก่อน
2. `redirect_after_login` ใน config

รูปแบบค่าใน `redirect_after_login` / `redirect_after_logout`:

| ค่า | ผลลัพธ์ (ระบบอยู่ที่ `/ldap_login/`) |
|---|---|
| `'home.php'` | `/ldap_login/home.php` (ไม่ขึ้นต้นด้วย `/` = อยู่ในโฟลเดอร์ระบบ login) |
| `'/app/dashboard.php'` | `/app/dashboard.php` |
| `'https://intranet.pwa.local/'` | ตามนั้น |

ค่า `next` รับเฉพาะ path ภายในเว็บเดียวกัน (ขึ้นต้นด้วย `/`) ค่าอย่าง `//evil.com` หรือ `https://...` จะถูกทิ้งและใช้ค่าจาก config แทน

ลิงก์ไปหน้า login พร้อมกำหนดปลายทางเอง:

```php
<a href="<?= h(url('login.php') . '?next=' . rawurlencode('/app/report.php')) ?>">เข้าสู่ระบบ</a>
```

## 8. Session และการหมดเวลา

- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` อัตโนมัติเมื่อเปิดผ่าน HTTPS, path `/` (ใช้ร่วมกันทุกหน้าในโดเมนเดียวกัน)
- หมดเวลาเมื่อ **ไม่ได้ใช้งานเกิน `idle_timeout`** หรือ **login มานานเกิน `max_lifetime`** อย่างใดอย่างหนึ่ง แล้วจะถูกพาไปหน้า login พร้อมข้อความ "หมดเวลาการใช้งาน"
- `idle_timeout` ของระบบนี้ต้อง**ไม่เกิน** `session.gc_maxlifetime` ของ PHP (ค่าเริ่มต้น 1440 วินาที = 24 นาที) ไม่อย่างนั้น PHP อาจลบ session ทิ้งก่อน — ถ้าตั้ง 30 นาทีให้เพิ่มใน `php.ini`: `session.gc_maxlifetime = 1800`
- ถ้ามี**หลายระบบ**บนโดเมนเดียวกันที่ใช้ template นี้แยกกัน ให้ตั้ง `session.name` ไม่ซ้ำกัน ถ้าต้องการให้ login ครั้งเดียวใช้ได้ทุกระบบ ให้ทุกระบบ `require` `auth.php` ชุดเดียวกัน

## 9. บันทึก log การ login (`on_login`)

ฟังก์ชันนี้ถูกเรียกหลัง login สำเร็จทุกครั้ง ได้รับ `$user` (ข้อ 5) เป็นพารามิเตอร์

```php
// config.php
'on_login' => function (array $user): void {
    $pdo = new PDO('mysql:host=localhost;dbname=portal;charset=utf8mb4', 'portal', 'secret');
    $stmt = $pdo->prepare('INSERT INTO login_logs (username, name, ip, login_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$user['username'], $user['name'], $_SERVER['REMOTE_ADDR'] ?? '']);
},
```

```sql
CREATE TABLE login_logs (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    username  VARCHAR(64)  NOT NULL,
    name      VARCHAR(255) NOT NULL,
    ip        VARCHAR(45)  NOT NULL,
    login_at  DATETIME     NOT NULL,
    INDEX (username), INDEX (login_at)
);
```

ถ้าฟังก์ชันนี้ error (เช่น ฐานข้อมูลล่ม) ผู้ใช้ยัง login ได้ตามปกติ และข้อผิดพลาดจะถูกบันทึกใน error log ของ PHP ขึ้นต้นด้วย `on_login hook failed:`

## 10. รายการฟังก์ชัน

ฟังก์ชันที่ใช้ในหน้าของคุณ (อยู่ใน `auth.php`)

| ฟังก์ชัน | คืนค่า | ใช้ทำอะไร |
|---|---|---|
| `require_login()` | `array` | บังคับ login คืนข้อมูลผู้ใช้ |
| `require_group(string ...$groups)` | `array` | บังคับ login + ต้องอยู่ในกลุ่มใดกลุ่มหนึ่ง ไม่อยู่ = 403 |
| `current_user()` | `?array` | ผู้ใช้ที่ login อยู่ หรือ `null` |
| `has_group(array $user, string ...$groups)` | `bool` | อยู่ในกลุ่มใดกลุ่มหนึ่งหรือไม่ |
| `h(?string $s)` | `string` | escape ค่าก่อนแสดงใน HTML |
| `csrf_token()` | `string` | token สำหรับใส่ในฟอร์ม |
| `csrf_valid(?string $token)` | `bool` | ตรวจ token ที่ส่งมากับฟอร์ม |
| `url(string $path)` | `string` | แปลง path ให้ถูกต้องตามโฟลเดอร์ที่วางระบบ |
| `config(?string $key)` | `mixed` | อ่านค่าจาก `config.php` เช่น `config('app_name')` |
| `redirect(string $location)` | `never` | redirect แล้วจบการทำงาน |
| `flash(?string $message)` | `?string` | ตั้ง/อ่านข้อความครั้งเดียว (แสดงบนหน้า login) |

ฟังก์ชันภายใน (ปกติไม่ต้องเรียกเอง): `ad_authenticate()`, `login_user()`, `logout_user()`, `auth_session_start()`, `safe_next()`, `base_path()`, `ad_nested_groups()`, `dn_to_cn()`, `throttle_wait()`, `throttle_hit()`, `throttle_clear()`

## 11. ความปลอดภัย

สิ่งที่ระบบทำให้แล้ว

- Escape ชื่อผู้ใช้ก่อนค้นหาใน LDAP (กัน LDAP injection)
- ไม่ยอมรับรหัสผ่านว่าง (AD จะถือเป็น anonymous bind ซึ่งอาจผ่าน)
- สร้าง session id ใหม่ทุกครั้งที่ login/logout (กัน session fixation)
- CSRF token ทั้งฟอร์ม login และ logout
- จำกัดการใส่รหัสผิด: ผิด 5 ครั้งต่อ IP ต้องรอ 60 วินาที (ช่วยกันบัญชี AD ถูกล็อกจากการเดารหัส)

สิ่งที่ต้องทำตอน deploy

- **เปิดเว็บผ่าน HTTPS** — ไม่อย่างนั้นรหัสผ่านวิ่งจาก browser มาเซิร์ฟเวอร์แบบไม่เข้ารหัส
- **ติดตั้ง CA ของ AD ลงเครื่อง** — ค่าเริ่มต้นเป็น LDAPS เครื่องที่ยังไม่เชื่อ CA จะ login ไม่ได้ ("เชื่อมต่อเซิร์ฟเวอร์ยืนยันตัวตนไม่ได้") ดูหัวข้อถัดไป

### ติดตั้ง CA สำหรับ LDAPS (Ubuntu)

DC ของ PWA เปิด LDAPS ที่ `R06-DC01.pwa.local:636` ใบรับรองออกโดย CA ภายใน `pwa-HQ-DC02-CA` เครื่อง web server ต้องเชื่อ CA นี้ก่อน มีสคริปต์ดึงไฟล์ CA จาก AD ให้:

```bash
php tools/fetch_ad_ca.php            # ถามชื่อผู้ใช้/รหัสผ่าน AD ของคุณ
```

สคริปต์จะ:
1. อ่านใบรับรองของ DC
2. login แล้วอ่านใบรับรอง CA ที่ AD เผยแพร่ไว้
3. ไล่หา CA จนถึง root แล้วบันทึกไว้ใน `certs/`
4. ทดสอบเชื่อมต่อ LDAPS แบบตรวจใบรับรองจริง

จากนั้นทำตามขั้นตอนที่สคริปต์แสดง:

1. **เทียบ Thumbprint** ที่สคริปต์แสดงกับใบรับรองบนเครื่อง Windows ใน domain (`certlm.msc` → Trusted Root Certification Authorities → ดับเบิลคลิก → Details → Thumbprint) ต้องตรงกัน — ตอนดึงไฟล์ยังไม่มี CA ให้ตรวจ ขั้นนี้คือการยืนยันว่าไม่ได้ไฟล์ปลอม
2. ติดตั้ง CA: `sudo cp certs/*.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`
3. ตรวจว่า `/etc/ldap/ldap.conf` มี `TLS_CACERT /etc/ssl/certs/ca-certificates.crt`
4. ตรวจ `config.php`: `'server' => 'ldaps://R06-DC01.pwa.local'` (ค่าเริ่มต้น ต้องเป็น**ชื่อเครื่อง** ไม่ใช่ IP เพราะใบรับรองออกให้ชื่อเครื่อง)
5. `sudo systemctl restart apache2` (หรือ `php8.x-fpm`) — PHP อ่านค่า CA ตอนเริ่มเท่านั้น

ใบรับรองของ DC หมดอายุ 15 พ.ค. 2027 ปกติ AD ต่ออายุเองและยังใช้ CA เดิม แต่ถ้า login ใช้ไม่ได้หลังวันนั้น ให้ตรวจเรื่องนี้ก่อน `tools/` รันได้เฉพาะ CLI (เปิดผ่านเว็บจะได้ 404)
- ผู้ใช้หลังอุปกรณ์ NAT เดียวกันใช้ IP เดียวกัน การนับรหัสผิดจะรวมกัน ถ้ามีปัญหาให้ปรับ `throttle` ใน config

## 12. แก้ปัญหา

| ข้อความ / อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| PHP ยังไม่ได้เปิดใช้ ldap extension | ไม่ได้ติดตั้ง `php-ldap` | ติดตั้งแล้ว restart web server (ข้อ 1) |
| PHP ยังไม่ได้เปิดใช้ mbstring extension | ไม่ได้ติดตั้ง `php-mbstring` ให้ PHP ตัวที่เว็บใช้ | ติดตั้งให้ตรงเวอร์ชันแล้ว restart web server (ข้อ 1) |
| ติดตั้ง extension แล้วแต่ยังขึ้น error เดิม | ติดตั้งให้ PHP คนละเวอร์ชันกับที่เว็บใช้ (เครื่องมีหลายเวอร์ชัน) | ดูเวอร์ชันที่เว็บใช้: สร้างไฟล์ `<?php echo PHP_VERSION, PHP_SAPI;` เปิดผ่านเว็บแล้วลบทิ้ง จากนั้นติดตั้ง `php<เวอร์ชัน>-ldap`/`-mbstring` |
| เชื่อมต่อเซิร์ฟเวอร์ยืนยันตัวตนไม่ได้ | ต่อ AD ไม่ได้ / ผิด IP / firewall หรือ (LDAPS) ใบรับรองตรวจไม่ผ่าน | `nc -zv R06-DC01.pwa.local 636`; ถ้าใช้ LDAPS รัน `php tools/fetch_ad_ca.php` ดูผลขั้นที่ 4 และตรวจว่า restart web server แล้ว |
| ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง | รหัสผิด, บัญชีถูกล็อก/ปิด, หรือรหัสหมดอายุ | ลอง login Windows ด้วยบัญชีเดียวกัน |
| ไม่พบข้อมูลบัญชีผู้ใช้ในระบบ | bind ผ่านแต่ค้นหาไม่เจอ | ตรวจ `ldap.base_dn` |
| บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ | ไม่อยู่ใน `allowed_groups` | ตรวจชื่อกลุ่ม (CN) หรือเปิด `nested_groups` |
| หน้านี้เปิดค้างไว้นานเกินไป | CSRF token ไม่ตรง (session หมด/cookie ถูกบล็อก) | refresh หน้า login; ตรวจว่า browser รับ cookie |
| ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ N วินาที | ใส่รหัสผิดครบกำหนด | รอ หรือ (dev) ลบไฟล์ `pwa_auth_*` ใน temp ของระบบ |
| STARTTLS ล้มเหลว | ใบรับรองไม่ตรง/ไม่น่าเชื่อถือ | ใช้ชื่อเครื่องแทน IP, ติดตั้ง CA ของ AD ลงเครื่อง |
| Login แล้วเด้งกลับหน้า login ตลอด | cookie session ไม่ถูกเก็บ | ตรวจว่า `session.save_path` เขียนได้; ถ้าเปิดผ่าน HTTP แต่ server ส่ง `HTTPS=on` ผิด cookie จะเป็น `Secure` |
| CSS ไม่ขึ้น / redirect ไป path ผิด | ใช้ Apache `Alias` หรือ symlink ทำให้หา `base_path` ไม่ถูก | ตั้ง `'base_path' => '/ldap_login'` ใน config |
| หลุดออกจากระบบเร็วกว่าที่ตั้ง | PHP ลบ session ก่อน (`gc_maxlifetime`) | ดูข้อ 8 |
