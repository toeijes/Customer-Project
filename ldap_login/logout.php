<?php
declare(strict_types=1);

require __DIR__ . '/auth.php';

// รับเฉพาะ POST ที่มี CSRF token เพื่อกันเว็บอื่นสั่ง logout ผู้ใช้
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_valid($_POST['csrf'] ?? null)) {
    logout_user('ออกจากระบบเรียบร้อยแล้ว');
    redirect(url(config('redirect_after_logout')));
}

redirect(url(config('redirect_after_login')));
