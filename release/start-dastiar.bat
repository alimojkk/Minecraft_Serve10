@echo off
chcp 65001 >nul
title دستیار — Dastiar
color 0B

echo ============================================
echo    دستیار هوش مصنوعی شخصی — راه‌اندازی
echo ============================================
echo.

REM ---------- بررسی نصب بودن Node.js ----------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] Node.js روی سیستم نصب نیست!
    echo لطفاً Node.js نسخه ۱۸ به بالا را از https://nodejs.org نصب کنید و دوباره اجرا کنید.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node -v') do echo [OK] Node.js نسخه %%v نصب است.
echo.

REM ---------- نصب وابستگی‌ها (فقط بار اول) ----------
if not exist "node_modules" (
    echo [۱/۳] در حال نصب وابستگی‌ها... (ممکن است چند دقیقه طول بکشد)
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] نصب وابستگی‌ها ناموفق بود. اینترنت را بررسی کنید.
        pause
        exit /b 1
    )
) else (
    echo [۱/۳] وابستگی‌ها از قبل نصب شده‌اند.
)
echo.

REM ---------- همگام‌سازی دیتابیس ----------
echo [۲/۳] در حال آماده‌سازی دیتابیس محلی...
call npm run db:sync
if %errorlevel% neq 0 (
    echo [خطا] آماده‌سازی دیتابیس ناموفق بود.
    pause
    exit /b 1
)
echo.

REM ---------- ساخت و اجرا ----------
echo [۳/۳] در حال ساخت و اجرای برنامه...
if not exist ".next\BUILD_ID" (
    call npm run build
    if %errorlevel% neq 0 (
        echo [خطا] ساخت برنامه ناموفق بود.
        pause
        exit /b 1
    )
)

REM باز کردن مرورگر پس از چند ثانیه
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3784"

echo.
echo ✅ برنامه در حال اجراست: http://localhost:3784
echo    برای بستن، این پنجره را ببندید یا Ctrl+C بزنید.
echo.
call npm run start
pause
