<?php
/**
 * ดึงใบรับรอง CA ของ AD เพื่อใช้กับ LDAPS
 *
 *     php tools/fetch_ad_ca.php [--host=R06-DC01.pwa.local] [--user=somchai] [--out=certs]
 *
 * 1. อ่านใบรับรองที่ DC ใช้กับ LDAPS (port 636)
 * 2. login ด้วยบัญชี AD ของคุณ แล้วอ่านใบรับรอง CA ที่ AD เผยแพร่ไว้
 *    (CN=Public Key Services,CN=Services,CN=Configuration,...)
 * 3. หา CA ที่ออกใบรับรองให้ DC ไล่ขึ้นไปจนถึง root แล้วบันทึกเป็นไฟล์ .crt (PEM)
 * 4. ทดสอบเชื่อมต่อ LDAPS แบบตรวจใบรับรองจริงด้วยไฟล์ที่ได้
 *
 * ต้องใช้ PHP CLI ที่มี extension ldap และ openssl
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const DEFAULT_HOST = 'R06-DC01.pwa.local';

$config = (require __DIR__ . '/../config.php')['ldap'];
$opts = getopt('', ['host:', 'user:', 'out:', 'help']);

if (isset($opts['help'])) {
    echo "ใช้: php tools/fetch_ad_ca.php [--host=" . DEFAULT_HOST . "] [--user=ชื่อผู้ใช้] [--out=certs]\n";
    exit(0);
}

$host = $opts['host'] ?? DEFAULT_HOST;
$outDir = $opts['out'] ?? __DIR__ . '/../certs';

foreach (['ldap', 'openssl'] as $ext) {
    if (!extension_loaded($ext)) {
        fail("PHP CLI ยังไม่มี extension $ext (sudo apt install php-$ext)");
    }
}

// ---------------------------------------------------------------- 1. ใบรับรองของ DC

step("อ่านใบรับรองของ $host:636");
$chain = server_chain($host, null);
if ($chain === null) {
    fail("เชื่อมต่อ $host:636 ไม่ได้ ตรวจชื่อเครื่อง/DNS และ firewall");
}
$leaf = $chain[0];
$leafInfo = openssl_x509_parse($leaf);
$san = $leafInfo['extensions']['subjectAltName'] ?? '-';
info("ออกโดย  : " . dn_string($leafInfo['issuer']));
info("ชื่อเครื่อง: $san");
info("หมดอายุ  : " . date('Y-m-d', $leafInfo['validTo_time_t']));
if (!str_contains(strtolower($san), 'dns:' . strtolower($host))) {
    warn("ใบรับรองไม่ได้ออกให้ชื่อ $host ให้ใช้ --host= เป็นชื่อในบรรทัด 'ชื่อเครื่อง' ด้านบน");
}

// ---------------------------------------------------------------- 2. อ่าน CA จาก AD

step('login เพื่ออ่านใบรับรอง CA จาก AD');
$user = $opts['user'] ?? prompt('ชื่อผู้ใช้ AD: ');
$pass = prompt('รหัสผ่าน: ', hidden: true);
if ($user === '' || $pass === '') {
    fail('ต้องกรอกชื่อผู้ใช้และรหัสผ่าน');
}

// ยังไม่มี CA จึงยังตรวจใบรับรองไม่ได้ แต่การเชื่อมต่อถูกเข้ารหัสแล้ว
// (ความถูกต้องของ CA ที่ได้มา ยืนยันด้วย thumbprint ในขั้นที่ 3)
ldap_set_option(null, LDAP_OPT_X_TLS_REQUIRE_CERT, LDAP_OPT_X_TLS_NEVER);
$ldap = ldap_connect("ldaps://$host:636");
ldap_set_option($ldap, LDAP_OPT_PROTOCOL_VERSION, 3);
ldap_set_option($ldap, LDAP_OPT_REFERRALS, 0);
ldap_set_option($ldap, LDAP_OPT_NETWORK_TIMEOUT, $config['timeout']);

$user = preg_replace('/^.*\\\\|@.*$/', '', $user);
if (!@ldap_bind($ldap, $config['domain'] . '\\' . $user, $pass)) {
    fail('login ไม่สำเร็จ: ' . ldap_error($ldap));
}
unset($pass);

$pkiDn = 'CN=Public Key Services,CN=Services,CN=Configuration,' . $config['base_dn'];
$result = @ldap_search($ldap, $pkiDn, '(objectClass=certificationAuthority)', ['cACertificate']);
if ($result === false) {
    fail("อ่าน $pkiDn ไม่ได้: " . ldap_error($ldap));
}

$cas = [];   // sha256 => PEM
for ($e = ldap_first_entry($ldap, $result); $e !== false; $e = ldap_next_entry($ldap, $e)) {
    $values = @ldap_get_values_len($ldap, $e, 'cACertificate') ?: ['count' => 0];
    for ($i = 0; $i < $values['count']; $i++) {
        $pem = "-----BEGIN CERTIFICATE-----\n" . chunk_split(base64_encode($values[$i]), 64, "\n") . "-----END CERTIFICATE-----\n";
        if (openssl_x509_parse($pem) !== false) {
            $cas[openssl_x509_fingerprint($pem, 'sha256')] = $pem;
        }
    }
}
ldap_unbind($ldap);
info('พบใบรับรอง CA ใน AD ' . count($cas) . ' ใบ');

// ---------------------------------------------------------------- 3. ไล่ chain จาก DC ถึง root

step('หา CA ที่ออกใบรับรองให้ DC');
$path = [];
$current = $leaf;
while (true) {
    $issuer = find_issuer($current, $cas);
    if ($issuer === null) {
        if ($path === []) {
            fail('ไม่พบ CA ที่ออกใบรับรองให้ DC ใน AD ต้องขอไฟล์ CA จากทีม AD');
        }
        warn('ไม่พบ CA ชั้นบนของ "' . cn($path[array_key_last($path)]) . '" ใน AD ต้องขอไฟล์ root CA จากทีม AD เพิ่ม');
        break;
    }
    $path[] = $issuer;
    if (is_self_signed($issuer) || count($path) > 5) {
        break;
    }
    $current = $issuer;
}

if (!is_dir($outDir) && !mkdir($outDir, 0755, true)) {
    fail("สร้างโฟลเดอร์ $outDir ไม่ได้");
}
$outDir = realpath($outDir);
$bundle = '';
foreach ($path as $i => $pem) {
    $info = openssl_x509_parse($pem);
    $file = $outDir . '/' . preg_replace('/[^A-Za-z0-9._-]+/', '_', cn($pem)) . '.crt';
    file_put_contents($file, $pem);
    $bundle .= $pem;

    echo "\n";
    info(($i + 1) . '. ' . cn($pem) . (is_self_signed($pem) ? '  (root CA)' : '  (intermediate CA)'));
    info('   ไฟล์        : ' . $file);
    info('   หมดอายุ     : ' . date('Y-m-d', $info['validTo_time_t']));
    info('   Thumbprint  : ' . strtoupper(openssl_x509_fingerprint($pem, 'sha1')) . '  (SHA-1 แบบที่ Windows แสดง)');
    info('   SHA-256     : ' . strtoupper(openssl_x509_fingerprint($pem, 'sha256')));
}
$bundleFile = $outDir . '/pwa-ad-ca-bundle.pem';
file_put_contents($bundleFile, $bundle);

// ---------------------------------------------------------------- 4. ทดสอบตรวจใบรับรองจริง

step("ทดสอบเชื่อมต่อ $host:636 แบบตรวจใบรับรอง");
if (server_chain($host, $bundleFile) !== null) {
    info('✓ ผ่าน: ใบรับรองของ DC ตรวจสอบได้ด้วย CA ที่ดึงมา และชื่อเครื่องตรงกัน');
} else {
    warn('✗ ไม่ผ่าน: ' . (error_get_last()['message'] ?? 'ไม่ทราบสาเหตุ'));
}

echo <<<TXT

ขั้นต่อไป (Ubuntu)
  1. เทียบ Thumbprint ด้านบนกับใบรับรองบนเครื่อง Windows ใน domain
     (certlm.msc > Trusted Root Certification Authorities > ดับเบิลคลิก > Details > Thumbprint)
     ต้องตรงกันทุกตัวอักษร ถ้าไม่ตรง ห้ามใช้ไฟล์นี้ และแจ้งทีม AD
  2. ติดตั้งลงเครื่อง web server:
       sudo cp {$outDir}/*.crt /usr/local/share/ca-certificates/
       sudo update-ca-certificates
  3. ตรวจว่า /etc/ldap/ldap.conf มีบรรทัดนี้ (ถ้าไม่มีให้เพิ่ม):
       TLS_CACERT /etc/ssl/certs/ca-certificates.crt
  4. แก้ config.php: 'server' => 'ldaps://{$host}'
  5. restart web server (PHP อ่านค่า CA ตอนเริ่มเท่านั้น):
       sudo systemctl restart apache2      # หรือ php8.x-fpm

TXT;

// ---------------------------------------------------------------- helpers

/** ใบรับรองที่ server ส่งมา (PEM[]) หรือ null; $cafile = null คือไม่ตรวจ */
function server_chain(string $host, ?string $cafile): ?array
{
    $ssl = $cafile === null
        ? ['verify_peer' => false, 'verify_peer_name' => false]
        : ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host, 'cafile' => $cafile];
    $ctx = stream_context_create(['ssl' => $ssl + ['capture_peer_cert_chain' => true]]);
    $s = @stream_socket_client("ssl://$host:636", $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $ctx);
    if ($s === false) {
        return null;
    }
    $certs = stream_context_get_params($s)['options']['ssl']['peer_certificate_chain'] ?? [];
    fclose($s);
    return array_map(function ($c) { openssl_x509_export($c, $pem); return $pem; }, $certs) ?: null;
}

function find_issuer(string $cert, array $cas): ?string
{
    $issuer = openssl_x509_parse($cert)['issuer'];
    foreach ($cas as $pem) {
        // ชื่อตรงกันและลายเซ็นถูกต้อง (CA ที่ต่ออายุอาจมีชื่อซ้ำ)
        if (openssl_x509_parse($pem)['subject'] == $issuer && openssl_x509_verify($cert, $pem) === 1) {
            return $pem;
        }
    }
    return null;
}

function is_self_signed(string $pem): bool
{
    $i = openssl_x509_parse($pem);
    return $i['subject'] == $i['issuer'] && openssl_x509_verify($pem, $pem) === 1;
}

function cn(string $pem): string
{
    $subject = openssl_x509_parse($pem)['subject'];
    $cn = $subject['CN'] ?? 'ca';
    return is_array($cn) ? end($cn) : $cn;
}

function dn_string(array $dn): string
{
    $parts = [];
    foreach ($dn as $k => $v) {
        foreach ((array) $v as $x) {
            $parts[] = "$k=$x";
        }
    }
    return implode(', ', $parts);
}

function prompt(string $label, bool $hidden = false): string
{
    fwrite(STDOUT, $label);
    $tty = $hidden && stream_isatty(STDIN);
    if ($tty) {
        shell_exec('stty -echo');
        register_shutdown_function(fn() => shell_exec('stty echo'));
    }
    $value = rtrim((string) fgets(STDIN), "\r\n");
    if ($tty) {
        shell_exec('stty echo');
        fwrite(STDOUT, "\n");
    }
    return trim($value) === '' ? '' : ($hidden ? $value : trim($value));
}

function step(string $s): void { echo "\n== $s\n"; }
function info(string $s): void { echo "   $s\n"; }
function warn(string $s): void { fwrite(STDERR, "   ! $s\n"); }
function fail(string $s): never { fwrite(STDERR, "\n   ✗ $s\n"); exit(1); }
