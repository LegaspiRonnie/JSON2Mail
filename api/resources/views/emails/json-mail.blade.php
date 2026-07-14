{{--
  Why table-based layout + inline styles: email clients (Gmail, Outlook) strip
  <style> blocks and ignore flexbox/grid. Tables with inline CSS are the only
  reliably-rendered layout technique in email — this is deliberate, not legacy.

  Why {{ $emailMessage }} (escaped) piped through nl2br: the message is user
  input. Blade's {{ }} escapes any markup; nl2br then restores the user's
  line breaks as <br> tags. Order matters — escape first, THEN add markup.
--}}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ $emailSubject }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f8;">

  <!-- Outer wrapper: full-width background -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6f8; padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Card: max 600px is the email-safe standard width -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e3e7ee;">

          <!-- Header band -->
          <tr>
            <td style="background-color:#1e3a8a; padding:24px 32px;">
              <span style="font-family:Arial, Helvetica, sans-serif; font-size:20px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                From: Ronnie Legaspi 
                
              </span>
            </td>
          </tr>

          <!-- Subject line -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:22px; line-height:1.3; color:#1c2333;">
                {{ $emailSubject }}
              </h1>
            </td>
          </tr>

          <!-- Message body -->
          <tr>
            <td style="padding:16px 32px 28px;">
              <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.7; color:#3a4356;">
                {!! nl2br(e($emailMessage)) !!}
              </p>
            </td>
          </tr>

          @if ($attachmentName)
          <!-- Attachment chip -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#eef2fb; border:1px solid #d5def5; border-radius:8px;">
                <tr>
                  <td style="padding:10px 16px; font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#1e3a8a;">
                    &#128206;&nbsp; Attached: <strong>{{ $attachmentName }}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          @endif

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fc; border-top:1px solid #e3e7ee; padding:18px 32px;">
              <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; color:#8a93a6;">
                Sent via <strong style="color:#1e3a8a;">Ronnie's json2mail</strong> — JSON in, email out.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>