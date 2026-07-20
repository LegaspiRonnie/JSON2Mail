<?php

use App\Http\Controllers\SendEmailController;
use Illuminate\Support\Facades\Route;

// Why throttle:5,1 — this endpoint sends real email; without a per-IP limit it is
// a free relay for spam. 5/min is generous for a human, useless for abuse.
Route::post('/send-email', SendEmailController::class)
    ->middleware('throttle:5,1');

Route::get('/test', function () {
    return 'health is up';
});

// The configured sender is safe to show as a convenience default. Never
// expose MAIL_PASSWORD or any other credential to the browser.
Route::get('/mail-settings', function () {
    return response()->json([
        'sender' => config('mail.from.address') ?: config('mail.mailers.smtp.username'),
    ]);
});
