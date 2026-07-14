const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

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

// Ephemeral port: ask the OS for a free one so we never collide with WAMP,
// Vite, or another copy of the app.
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
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
            dialog.showErrorBox('Json2Mail', `The local PHP server stopped unexpectedly (code ${code}).`);
            app.quit();
        }
    });
}

async function boot() {
    if (!fs.existsSync(PHP_EXE)) {
        dialog.showErrorBox('Json2Mail', `Bundled PHP runtime not found:\n${PHP_EXE}`);
        app.quit();
        return;
    }

    const port = await getFreePort();
    ensureStorageDirs();
    startPhp(port);

    try {
        await waitForServer(port);
    } catch (err) {
        dialog.showErrorBox('Json2Mail', err.message);
        app.quit();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1000,
        height: 760,
        autoHideMenuBar: true,
        title: 'Json2Mail',
        webPreferences: { contextIsolation: true },
    });
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

// Single instance: focus the existing window instead of spawning a second PHP.
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
