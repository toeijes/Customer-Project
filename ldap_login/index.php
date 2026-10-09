<?php
declare(strict_types=1);

require __DIR__ . '/auth.php';

redirect(url(current_user() ? config('redirect_after_login') : 'login.php'));
