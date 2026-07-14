const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

// Fixed port so anything pointing at the local API (dev SPA, the hosted web
// app, curl) has a stable target.
const PORT = 8999;

// Packaged: extraResources land in <install>/resources. Dev (`npm start`):
// PHP lives in desktop/resources and the Laravel app is the sibling api/ dir.
const RES = app.isPackaged ? process.resourcesPath : __dirname;
const PHP_DIR = path.join(RES, app.isPackaged ? 'php' : 'resources/php');
const PHP_EXE = path.join(PHP_DIR, 'php.exe');
const APP_DIR = app.isPackaged ? path.join(RES, 'app') : path.join(__dirname, '..', 'api');
const ROUTER = app.isPackaged
    ? path.join(APP_DIR, 'router.php')
    : path.join(__dirname, 'resources', 'router.php');

let phpServer = null;
let mainWindow = null;
let quitting = false;

// The port is fixed, so refuse to start when something else owns it —
// spawning PHP anyway would just crash with a bind error.
function assertPortFree(port) {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.once('error', () => reject(new Error(
            `Port ${port} is already in use.\nClose the other program (or a previous copy of this app) and try again.`
        )));
        srv.listen(port, '127.0.0.1', () => srv.close(() => resolve()));
    });
}

function waitForServer(port, timeoutMs = 30000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
        (function probe() {
            const sock = net.connect(port, '127.0.0.1');
            sock.once('connect', () => { sock.destroy(); resolve(); });
            sock.once('error', () => {
                sock.destroy();
                if (Date.now() - started > timeoutMs) {
                    reject(new Error('PHP server did not start within 30s'));
                } else {
                    setTimeout(probe, 250);
                }
            });
        })();
    });
}

// Packaging filters and NSIS both drop empty directories, so the writable
// tree Laravel expects must be (re)created at every launch.
function ensureStorageDirs() {
    [
        'storage/framework/sessions',
        'storage/framework/views',
        'storage/framework/cache/data',
        'storage/logs',
        'storage/app/private',
        'storage/app/public',
        'bootstrap/cache',
    ].forEach((dir) => fs.mkdirSync(path.join(APP_DIR, dir), { recursive: true }));
}

function startPhp(port) {
    // php -S with Laravel's router is what `php artisan serve` runs under the
    // hood — invoking it directly means one process to manage instead of two.
    // -d overrides use absolute paths: php.ini's relative extension_dir would
    // resolve against cwd (the Laravel app dir), not against php.exe.
    phpServer = spawn(PHP_EXE, [
        '-c', PHP_DIR,
        '-d', `extension_dir=${path.join(PHP_DIR, 'ext')}`,
        '-d', `curl.cainfo=${path.join(PHP_DIR, 'cacert.pem')}`,
        '-d', `openssl.cafile=${path.join(PHP_DIR, 'cacert.pem')}`,
        '-S', `127.0.0.1:${port}`,
        '-t', 'public',
        ROUTER,
    ], { cwd: APP_DIR, windowsHide: true });

    phpServer.on('exit', (code) => {
        phpServer = null;
        if (!quitting) {
            dialog.showErrorBox('Json2Mail API', `The local PHP server stopped unexpectedly (code ${code}).`);
            app.quit();
        }
    });
}

// Status-only window: the app has no UI of its own — it just hosts the API.
function statusPage(port) {
    const html = `<!doctype html><meta charset="utf-8"><title>Json2Mail API</title>
<body style="font-family:system-ui;background:#111827;color:#e5e7eb;display:flex;flex-direction:column;justify-content:center;align-items:center;height:92vh;margin:0">
<h2 style="margin:0 0 8px">Json2Mail API is running</h2>
<p style="margin:0 0 4px;font-size:15px">Serving at <code style="color:#6ee7b7">http://127.0.0.1:${port}</code></p>
<p style="margin:0;color:#9ca3af;font-size:13px">Close this window to stop the server.</p>
</body>`;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function boot() {
    if (!fs.existsSync(PHP_EXE)) {
        dialog.showErrorBox('Json2Mail API', `Bundled PHP runtime not found:\n${PHP_EXE}`);
        app.quit();
        return;
    }

    try {
        await assertPortFree(PORT);
    } catch (err) {
        dialog.showErrorBox('Json2Mail API', err.message);
        app.quit();
        return;
    }

    ensureStorageDirs();
    startPhp(PORT);

    try {
        await waitForServer(PORT);
    } catch (err) {
        dialog.showErrorBox('Json2Mail API', err.message);
        app.quit();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 440,
        height: 260,
        resizable: false,
        autoHideMenuBar: true,
        title: 'Json2Mail API',
        webPreferences: { contextIsolation: true },
    });
    mainWindow.loadURL(statusPage(PORT));
}

// Single instance: focus the existing window instead of fighting over the port.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(boot);

    app.on('window-all-closed', () => app.quit());

    app.on('will-quit', () => {
        quitting = true;
        if (phpServer) phpServer.kill();
    });
}
