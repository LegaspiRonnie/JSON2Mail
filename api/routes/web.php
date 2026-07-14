<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    // Desktop builds bake the React bundle into public/app; hosted deploys
    // don't ship it, so they keep the welcome page.
    if (file_exists(public_path('app/index.html'))) {
        return redirect('/app/index.html');
    }

    return view('welcome');
});
