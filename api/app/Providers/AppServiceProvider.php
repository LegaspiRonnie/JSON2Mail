<?php

namespace App\Providers;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoApiTransport;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Laravel has no built-in "brevo" transport — config/mail.php's brevo
        // mailer resolves only because we register the Symfony bridge here.
        Mail::extend('brevo', function () {
            return new BrevoApiTransport(config('services.brevo.key'));
        });
    }
}
