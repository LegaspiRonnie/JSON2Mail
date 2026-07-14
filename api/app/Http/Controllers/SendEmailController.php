<?php

namespace App\Http\Controllers;

use App\Http\Requests\SendEmailRequest;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

class SendEmailController extends Controller
{
    /**
     * Validation already happened (FormRequest) by the time we're here, so this
     * method only orchestrates: call the service, translate outcomes to JSON.
     * Failures are report()ed to the log but never leak SMTP details to clients.
     */
    public function __invoke(SendEmailRequest $request, EmailService $emailService): JsonResponse
    {
        try {
            $emailService->send($request->validated(), $request->file('attachment'));
        } catch (TransportExceptionInterface $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'The mail server could not send your email. Please try again later.',
            ], 502);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong while sending the email.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Email sent successfully to '.$request->validated('receiver').'.',
        ]);
    }
}