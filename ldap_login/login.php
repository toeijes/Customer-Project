<?php
declare(strict_types=1);

require __DIR__ . '/auth.php';

$next = safe_next($_GET['next'] ?? $_POST['next'] ?? null);
$destination = $next ?? url(config('redirect_after_login'));

if (current_user() !== null) {
    redirect($destination);
}

$error = null;
$username = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    // ตัด DOMAIN\ หรือ @domain ออก ถ้าผู้ใช้พิมพ์มา
    if (str_contains($username, '\\')) {
        $username = substr($username, strrpos($username, '\\') + 1);
    } elseif (str_contains($username, '@')) {
        $username = strstr($username, '@', true);
    }

    if (!csrf_valid($_POST['csrf'] ?? null)) {
        $error = 'หน้านี้เปิดค้างไว้นานเกินไป กรุณาลองใหม่อีกครั้ง';
    } elseif (($wait = throttle_wait()) > 0) {
        $error = "ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ {$wait} วินาที";
    } else {
        try {
            $user = ad_authenticate($username, $password);

            $allowed = config('allowed_groups');
            if ($allowed && !has_group($user, ...$allowed)) {
                throw new RuntimeException('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ');
            }

            throttle_clear();
            login_user($user);
            redirect($destination);
        } catch (RuntimeException $e) {
            if ($e->getCode() === AUTH_BAD_CREDENTIALS) {
                throttle_hit();
            }
            $error = $e->getMessage();
        }
    }
}

$notice = flash();
$domain = config('ldap')['domain'];
?>
<!doctype html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>เข้าสู่ระบบ · <?= h(config('app_name')) ?></title>
    <link rel="stylesheet" href="<?= h(url('assets/style.css')) ?>">
</head>
<body class="center">
<main class="card">
    <div class="brand">
        <div class="logo">🔐</div>
        <h1><?= h(config('app_name')) ?></h1>
        <p class="muted">เข้าสู่ระบบด้วยบัญชี Active Directory</p>
    </div>

    <?php if ($error): ?>
        <div class="status status--error" role="alert"><?= h($error) ?></div>
    <?php elseif ($notice): ?>
        <div class="status status--info" role="status"><?= h($notice) ?></div>
    <?php endif; ?>

    <form method="post" action="<?= h(url('login.php')) ?>">
        <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
        <?php if ($next): ?>
            <input type="hidden" name="next" value="<?= h($next) ?>">
        <?php endif; ?>

        <label for="username">ชื่อผู้ใช้</label>
        <div class="input-prefix">
            <span><?= h($domain) ?>\</span>
            <input id="username" name="username" type="text" value="<?= h($username) ?>"
                   autocomplete="username" required <?= $username === '' ? 'autofocus' : '' ?>>
        </div>

        <label for="password">รหัสผ่าน</label>
        <div class="input-password">
            <input id="password" name="password" type="password" autocomplete="current-password" required
                   <?= $username !== '' ? 'autofocus' : '' ?>>
            <button type="button" class="toggle" aria-label="แสดงรหัสผ่าน"
                    onclick="const p=document.getElementById('password');p.type=p.type==='password'?'text':'password';this.textContent=p.type==='password'?'แสดง':'ซ่อน'">แสดง</button>
        </div>

        <button type="submit" class="btn">เข้าสู่ระบบ</button>
    </form>
</main>
</body>
</html>
