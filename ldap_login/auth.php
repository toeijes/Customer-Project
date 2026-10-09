<?php
/**
 * ระบบ login ด้วย Active Directory
 *
 * ใช้ในหน้าที่ต้องล็อกอิน:
 *     require __DIR__ . '/auth.php';
 *     $user = require_login();          // ยังไม่ login -> พาไป login.php?next=<หน้านี้>
 *     require_group('Admins');          // (ไม่บังคับ) ต้องเป็นสมาชิกกลุ่มนี้
 */
declare(strict_types=1);

const AUTH_BAD_CREDENTIALS = 1;

// ขาด mbstring แล้วหน้าเว็บจะหยุดกลางคันแบบไม่มีข้อความ (display_errors ปิด) จึงแจ้งไว้ก่อน
if (!extension_loaded('mbstring')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('PHP ยังไม่ได้เปิดใช้ mbstring extension (ติดตั้ง php' . PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION
        . '-mbstring แล้ว restart web server)');
}

function config(?string $key = null): mixed
{
    static $config;
    $config ??= require __DIR__ . '/config.php';
    return $key === null ? $config : ($config[$key] ?? null);
}

function h(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

// ---------------------------------------------------------------- URL / redirect

/** path ของโฟลเดอร์ระบบ login บนเว็บ เช่น '' หรือ '/ldap_login' */
function base_path(): string
{
    static $base;
    if ($base !== null) {
        return $base;
    }
    if (config('base_path') !== null) {
        return $base = rtrim(config('base_path'), '/');
    }
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
    $dir = str_replace('\\', '/', __DIR__);
    $root = str_replace('\\', '/', $root);
    return $base = ($root !== '' && str_starts_with($dir, $root)) ? rtrim(substr($dir, strlen($root)), '/') : '';
}

/** แปลง path ใน config เป็น URL: 'home.php' -> '/ldap_login/home.php', '/x' และ 'https://..' ใช้ตามเดิม */
function url(string $path): string
{
    if (preg_match('#^(https?:)?//#i', $path) || str_starts_with($path, '/')) {
        return $path;
    }
    return base_path() . '/' . $path;
}

/** รับเฉพาะ path ภายในเว็บนี้ (กัน open redirect ไปเว็บอื่น) */
function safe_next(?string $next): ?string
{
    if ($next === null || $next === '' || $next[0] !== '/') {
        return null;
    }
    if (str_starts_with($next, '//') || str_contains($next, '\\') || preg_match('/[\x00-\x1F]/', $next)) {
        return null;
    }
    return $next;
}

function redirect(string $location): never
{
    header('Location: ' . $location);
    exit;
}

// ---------------------------------------------------------------- Session

function auth_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
    ini_set('session.use_strict_mode', '1');
    session_name(config('session')['name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function csrf_token(): string
{
    auth_session_start();
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}

function csrf_valid(?string $token): bool
{
    return is_string($token) && hash_equals(csrf_token(), $token);
}

/** ข้อความแจ้งเตือนครั้งเดียว (แสดงบนหน้า login) */
function flash(?string $message = null): ?string
{
    auth_session_start();
    if ($message !== null) {
        $_SESSION['flash'] = $message;
        return null;
    }
    $message = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $message;
}

// ---------------------------------------------------------------- ผู้ใช้ที่ login อยู่

/** คืนข้อมูลผู้ใช้ที่ login อยู่ หรือ null (หมดเวลาจะถูก logout อัตโนมัติ) */
function current_user(): ?array
{
    auth_session_start();
    $auth = $_SESSION['auth'] ?? null;
    if ($auth === null) {
        return null;
    }

    $now = time();
    $limits = config('session');
    if ($now - $auth['last_seen'] > $limits['idle_timeout'] || $now - $auth['login_at'] > $limits['max_lifetime']) {
        logout_user('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
        return null;
    }

    $_SESSION['auth']['last_seen'] = $now;
    return $_SESSION['auth'];
}

function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        $next = safe_next($_SERVER['REQUEST_URI'] ?? null);
        redirect(url('login.php') . ($next ? '?next=' . rawurlencode($next) : ''));
    }
    return $user;
}

/** ผู้ใช้เป็นสมาชิกกลุ่มใดกลุ่มหนึ่งหรือไม่ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
function has_group(array $user, string ...$groups): bool
{
    $mine = array_map('mb_strtolower', $user['groups']);
    foreach ($groups as $group) {
        if (in_array(mb_strtolower($group), $mine, true)) {
            return true;
        }
    }
    return false;
}

/** หยุดด้วย 403 ถ้าไม่ได้อยู่ในกลุ่มใดเลย */
function require_group(string ...$groups): array
{
    $user = require_login();
    if (!has_group($user, ...$groups)) {
        http_response_code(403);
        $css = h(url('assets/style.css'));
        $back = h(url(config('redirect_after_login')));
        echo <<<HTML
            <!doctype html><html lang="th"><head><meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>ไม่มีสิทธิ์เข้าถึง</title><link rel="stylesheet" href="{$css}"></head>
            <body class="center"><main class="card"><div class="brand"><div class="logo">⛔</div>
            <h1>ไม่มีสิทธิ์เข้าถึง</h1><p class="muted">บัญชีของคุณไม่ได้อยู่ในกลุ่มที่ได้รับอนุญาตให้เปิดหน้านี้</p></div>
            <a class="btn btn--secondary" href="{$back}">กลับหน้าหลัก</a></main></body></html>
            HTML;
        exit;
    }
    return $user;
}

function login_user(array $user): void
{
    auth_session_start();
    session_regenerate_id(true);
    $now = time();
    $_SESSION['auth'] = $user + ['login_at' => $now, 'last_seen' => $now];

    $hook = config('on_login');
    if (is_callable($hook)) {
        // hook ล้มเหลว (เช่น DB ล่ม) ไม่ควรขวางการ login หรือโชว์ error ให้ผู้ใช้เห็น
        try {
            $hook($_SESSION['auth']);
        } catch (Throwable $e) {
            error_log('on_login hook failed: ' . $e->getMessage());
        }
    }
}

function logout_user(?string $message = null): void
{
    auth_session_start();
    $_SESSION = [];
    session_regenerate_id(true);
    if ($message !== null) {
        flash($message);
    }
}

// ---------------------------------------------------------------- Active Directory

/**
 * ยืนยันตัวตนกับ AD แล้วคืนข้อมูลผู้ใช้ที่จะเก็บใน session
 * ล้มเหลวจะโยน RuntimeException (code AUTH_BAD_CREDENTIALS = รหัสผิด)
 */
function ad_authenticate(string $username, string $password): array
{
    $cfg = config('ldap');

    if (!function_exists('ldap_connect')) {
        throw new RuntimeException('PHP ยังไม่ได้เปิดใช้ ldap extension (ติดตั้ง php-ldap)');
    }
    if ($username === '' || $password === '') {
        // รหัสผ่านว่างจะกลายเป็น anonymous bind ซึ่ง AD อาจยอมให้ผ่าน
        throw new RuntimeException('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    }

    $ldap = ldap_connect($cfg['server']);
    if ($ldap === false) {
        throw new RuntimeException('รูปแบบ LDAP URI ไม่ถูกต้อง');
    }
    ldap_set_option($ldap, LDAP_OPT_PROTOCOL_VERSION, 3);
    ldap_set_option($ldap, LDAP_OPT_REFERRALS, 0);
    ldap_set_option($ldap, LDAP_OPT_NETWORK_TIMEOUT, $cfg['timeout']);

    try {
        if ($cfg['start_tls'] && !@ldap_start_tls($ldap)) {
            throw new RuntimeException('STARTTLS ล้มเหลว: ' . ldap_error($ldap));
        }

        if (!@ldap_bind($ldap, $cfg['domain'] . '\\' . $username, $password)) {
            if (ldap_errno($ldap) === -1) { // LDAP_SERVER_DOWN
                throw new RuntimeException('เชื่อมต่อเซิร์ฟเวอร์ยืนยันตัวตนไม่ได้ กรุณาลองใหม่ภายหลัง');
            }
            throw new RuntimeException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', AUTH_BAD_CREDENTIALS);
        }

        $attrs = ['samaccountname', 'displayname', 'givenname', 'sn', 'mail', 'title',
                  'department', 'company', 'telephonenumber', 'distinguishedname', 'memberof'];
        $filter = '(&(objectCategory=person)(sAMAccountName=' . ldap_escape($username, '', LDAP_ESCAPE_FILTER) . '))';
        $result = @ldap_search($ldap, $cfg['base_dn'], $filter, $attrs);
        $entries = $result ? ldap_get_entries($ldap, $result) : ['count' => 0];
        if ($entries['count'] !== 1) {
            throw new RuntimeException('ไม่พบข้อมูลบัญชีผู้ใช้ในระบบ');
        }
        $e = $entries[0];
        $get = fn(string $a): string => $e[$a][0] ?? '';

        $dn = $e['dn'];
        $groups = $cfg['nested_groups']
            ? ad_nested_groups($ldap, $cfg['base_dn'], $dn)
            : array_map('dn_to_cn', array_filter($e['memberof'] ?? [], 'is_int', ARRAY_FILTER_USE_KEY));
        sort($groups, SORT_NATURAL | SORT_FLAG_CASE);

        $name = $get('displayname') ?: trim($get('givenname') . ' ' . $get('sn'));
        return [
            'username'   => $get('samaccountname') ?: $username,
            'name'       => $name ?: $username,
            'first_name' => $get('givenname'),
            'last_name'  => $get('sn'),
            'email'      => $get('mail'),
            'title'      => $get('title'),
            'department' => $get('department'),
            'company'    => $get('company'),
            'phone'      => $get('telephonenumber'),
            'dn'         => $dn,
            'groups'     => $groups,
        ];
    } finally {
        ldap_unbind($ldap);
    }
}

/** กลุ่มทั้งหมดรวมกลุ่มซ้อน (LDAP_MATCHING_RULE_IN_CHAIN) */
function ad_nested_groups($ldap, string $baseDn, string $userDn): array
{
    $filter = '(&(objectClass=group)(member:1.2.840.113556.1.4.1941:='
        . ldap_escape($userDn, '', LDAP_ESCAPE_FILTER) . '))';
    $result = @ldap_search($ldap, $baseDn, $filter, ['cn']);
    if ($result === false) {
        return [];
    }
    $entries = ldap_get_entries($ldap, $result);
    $groups = [];
    for ($i = 0; $i < $entries['count']; $i++) {
        $groups[] = $entries[$i]['cn'][0];
    }
    return $groups;
}

/** 'CN=IT Staff,OU=Groups,DC=PWA,DC=local' -> 'IT Staff' */
function dn_to_cn(string $dn): string
{
    return preg_match('/^CN=((?:\\\\.|[^,])+)/i', $dn, $m) ? stripslashes($m[1]) : $dn;
}

// ---------------------------------------------------------------- กัน login ผิดซ้ำ ๆ (นับต่อ IP)

function throttle_file(): string
{
    return sys_get_temp_dir() . '/pwa_auth_' . sha1($_SERVER['REMOTE_ADDR'] ?? 'cli');
}

/** วินาทีที่ยังต้องรอ (0 = login ได้) */
function throttle_wait(): int
{
    $data = @json_decode((string) @file_get_contents(throttle_file()), true);
    if (!is_array($data) || $data['count'] < config('throttle')['max_attempts']) {
        return 0;
    }
    return max(0, $data['last'] + config('throttle')['lockout'] - time());
}

function throttle_hit(): void
{
    $file = throttle_file();
    $data = @json_decode((string) @file_get_contents($file), true);
    // ครบเวลารอแล้วให้เริ่มนับใหม่
    if (!is_array($data) || time() - $data['last'] > config('throttle')['lockout']) {
        $data = ['count' => 0];
    }
    $data['count']++;
    $data['last'] = time();
    file_put_contents($file, json_encode($data), LOCK_EX);
}

function throttle_clear(): void
{
    @unlink(throttle_file());
}
