<?php
// ตั้งค่าระบบ login (แก้ให้ตรงกับสภาพแวดล้อมจริง)
return [
    'app_name' => 'PWA Portal',

    // true = home.php แสดงข้อมูล $user ทั้งหมด (ใช้ตอนพัฒนาเท่านั้น)
    'debug' => false,

    // ---- Active Directory ----
    'ldap' => [
        // LDAPS ต้องใช้ชื่อเครื่อง (ไม่ใช่ IP) และเครื่องต้องเชื่อ CA ของ AD ก่อน ดู README หัวข้อ LDAPS
        'server'    => 'ldaps://R06-DC01.pwa.local',
        'start_tls' => false,                   // true = เข้ารหัสด้วย STARTTLS บน ldap://
        'domain'    => 'PWA',                   // NetBIOS domain สำหรับ bind แบบ DOMAIN\user
        'base_dn'   => 'dc=PWA,dc=local',
        'timeout'   => 5,                       // วินาที
        // true = นับกลุ่มที่ซ้อนกันด้วย (ค้นหาช้ากว่า), false = เฉพาะกลุ่มที่เป็นสมาชิกโดยตรง
        'nested_groups' => false,
    ],

    // ---- Redirect ----
    // path ที่ไม่ขึ้นต้นด้วย / จะถือว่าอยู่ในโฟลเดอร์เดียวกับระบบ login
    // ใส่ path เต็ม ('/app/index.php') หรือ URL ('https://...') ก็ได้
    'redirect_after_login'  => 'home.php',
    'redirect_after_logout' => 'login.php',

    // path ของโฟลเดอร์ระบบ login บนเว็บ เช่น '/ldap_login'; null = หาอัตโนมัติ
    'base_path' => null,

    // ---- สิทธิ์ ----
    // ว่าง = ทุกคนใน AD เข้าได้, หรือระบุชื่อกลุ่ม (CN) เช่น ['IT-Staff', 'Admins']
    'allowed_groups' => [],

    // ---- Session ----
    'session' => [
        'name'         => 'PWA_AUTH',
        'idle_timeout' => 30 * 60,      // ไม่ได้ใช้งานเกินนี้ (วินาที) ต้อง login ใหม่
        'max_lifetime' => 8 * 60 * 60,  // login ไว้ได้นานสุด (วินาที)
    ],

    // ---- กัน login ผิดซ้ำ ๆ (นับต่อ IP) ----
    'throttle' => [
        'max_attempts' => 5,
        'lockout'      => 60,           // วินาที
    ],

    // เรียกหลัง login สำเร็จ เช่น บันทึก log ลงฐานข้อมูล; null = ไม่ทำอะไร
    // 'on_login' => function (array $user): void { /* ... */ },
    'on_login' => null,
];
