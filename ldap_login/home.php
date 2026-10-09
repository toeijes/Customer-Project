<?php
declare(strict_types=1);

// *** หน้าตัวอย่าง *** แสดงวิธีใช้ require_login() และข้อมูล $user
// ใช้เป็นแม่แบบสร้างหน้าของคุณ แล้วชี้ redirect_after_login ใน config.php ไปที่หน้าจริง
require __DIR__ . '/auth.php';
$user = require_login();
// require_group('IT-Staff');   // ถ้าต้องการจำกัดเฉพาะกลุ่ม

$session = config('session');
$expires = min($user['last_seen'] + $session['idle_timeout'], $user['login_at'] + $session['max_lifetime']);
?>
<!doctype html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>หน้าหลัก · <?= h(config('app_name')) ?></title>
    <link rel="stylesheet" href="<?= h(url('assets/style.css')) ?>">
</head>
<body>
<header class="topbar">
    <strong><?= h(config('app_name')) ?></strong>
    <div class="topbar__user">
        <span><?= h($user['name']) ?></span>
        <form method="post" action="<?= h(url('logout.php')) ?>">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
            <button type="submit" class="btn btn--small btn--secondary">ออกจากระบบ</button>
        </form>
    </div>
</header>

<main class="page">
    <section class="card card--wide">
        <div class="profile">
            <div class="avatar"><?= h(mb_strtoupper(mb_substr($user['name'], 0, 1))) ?></div>
            <div>
                <h1><?= h($user['name']) ?></h1>
                <p class="muted"><?= h(config('ldap')['domain'] . '\\' . $user['username']) ?></p>
            </div>
        </div>

        <dl class="info">
            <?php foreach (['email' => 'อีเมล', 'title' => 'ตำแหน่ง', 'department' => 'ฝ่าย/กอง',
                            'company' => 'หน่วยงาน', 'phone' => 'โทรศัพท์'] as $key => $label): ?>
                <?php if ($user[$key] !== ''): ?>
                    <dt><?= h($label) ?></dt><dd><?= h($user[$key]) ?></dd>
                <?php endif; ?>
            <?php endforeach; ?>
            <dt>เข้าสู่ระบบเมื่อ</dt><dd><?= date('Y-m-d H:i:s', $user['login_at']) ?></dd>
            <dt>หมดเวลา</dt><dd><?= date('Y-m-d H:i:s', $expires) ?> (ถ้าไม่มีการใช้งาน)</dd>
        </dl>

        <?php if ($user['groups']): ?>
            <details>
                <summary>กลุ่มที่เป็นสมาชิก (<?= count($user['groups']) ?>)</summary>
                <ul class="groups">
                    <?php foreach ($user['groups'] as $group): ?>
                        <li><?= h($group) ?></li>
                    <?php endforeach; ?>
                </ul>
            </details>
        <?php endif; ?>

        <?php if (config('debug')): ?>
            <details>
                <summary>ข้อมูลใน <code>$user</code> (debug)</summary>
                <pre class="code"><?= h(var_export($user, true)) ?></pre>
            </details>
        <?php endif; ?>
    </section>
</main>
</body>
</html>
