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