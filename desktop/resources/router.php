<?php

/**
 * Router for PHP's built-in server (the desktop app runs `php -S` directly —
 * no artisan, so one process to manage). Static files are served as-is;
 * everything else goes through Laravel's front controller.
 *
 * Paths resolve from the working directory (the Laravel app root — main.js
 * always spawns with cwd set to it), NOT from __DIR__: in dev mode this file
 * runs from desktop/resources, outside the Laravel app.
 */
$root = getcwd();
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if ($uri !== '/' && file_exists($root.'/public'.$uri)) {
    return false;
}

$_SERVER['SCRIPT_FILENAME'] = $root.'/public/index.php';

require_once $root.'/public/index.php';
