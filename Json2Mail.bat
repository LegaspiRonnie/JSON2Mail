@echo off
rem Json2Mail API launcher — serves the Laravel API on http://127.0.0.1:8999
rem using the PHP installed on this machine. Close the window to stop.
cd /d "%~dp0api"
php artisan serve --port=8999
