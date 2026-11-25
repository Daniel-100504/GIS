<?php

require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

function createAquaguardMailer($toEmail, $toName) {
    $config = require __DIR__ . '/mail-config.php';

    $mail = new PHPMailer(true);

    $mail->isSMTP();
    $mail->Host       = $config['smtp_host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['smtp_username'];
    $mail->Password   = $config['smtp_password'];
    $mail->SMTPSecure = 'tls';
    $mail->Port       = $config['smtp_port'];

    $mail->setFrom($config['from_email'], $config['from_name']);
    $mail->addAddress($toEmail, $toName ?: '');
    $mail->isHTML(true);

    return $mail;
}

function sendResetPasswordEmail($toEmail, $toName, $resetLink) {
    $mail = createAquaguardMailer($toEmail, $toName);

    $safeName = htmlspecialchars($toName ?: 'there');
    $safeLink = htmlspecialchars($resetLink);

    $mail->Subject = 'AquaGuard Password Reset';
    $mail->Body = <<<HTML
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9f5;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e1ebe6;">
            <tr>
              <td style="background:#0a3128;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">AquaGuard</span><br>
                <span style="color:#8fd6b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Calatagan Mangrove Reserve</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#12211d;font-size:15px;line-height:1.6;">Hello {$safeName},</p>
                <p style="margin:0 0 24px;color:#12211d;font-size:15px;line-height:1.6;">An administrator approved your password reset request for your AquaGuard account. Click the button below to set a new password.</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:#1c7d61;">
                      <a href="{$safeLink}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Set a new password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;color:#869790;font-size:12px;line-height:1.6;">This link will expire in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
                <p style="margin:16px 0 0;color:#869790;font-size:12px;line-height:1.6;word-break:break-all;">Or paste this link into your browser:<br>{$safeLink}</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#869790;font-size:11px;">This is an automated message from AquaGuard. Please don't reply to this email.</p>
        </td>
      </tr>
    </table>
    HTML;
    $mail->AltBody = "An administrator approved your password reset request. Open this link to set a new password: {$resetLink} (expires in 30 minutes)";

    $mail->send();
}

function sendRoleChangedEmail($toEmail, $toName, $oldRoleLabel, $newRoleLabel, $loginUrl) {
    $mail = createAquaguardMailer($toEmail, $toName);

    $safeName    = htmlspecialchars($toName ?: 'there');
    $safeOldRole = htmlspecialchars($oldRoleLabel);
    $safeNewRole = htmlspecialchars($newRoleLabel);
    $safeLoginUrl = htmlspecialchars($loginUrl);

    $mail->Subject = 'Your AquaGuard account role has changed';
    $mail->Body = <<<HTML
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9f5;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e1ebe6;">
            <tr>
              <td style="background:#0a3128;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">AquaGuard</span><br>
                <span style="color:#8fd6b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Calatagan Mangrove Reserve</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#12211d;font-size:15px;line-height:1.6;">Hello {$safeName},</p>
                <p style="margin:0 0 24px;color:#12211d;font-size:15px;line-height:1.6;">An administrator changed your AquaGuard account role from <strong>{$safeOldRole}</strong> to <strong>{$safeNewRole}</strong>. Your username and password stay the same.</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:#1c7d61;">
                      <a href="{$safeLoginUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Log in to AquaGuard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#869790;font-size:11px;">This is an automated message from AquaGuard. Please don't reply to this email.</p>
        </td>
      </tr>
    </table>
    HTML;
    $mail->AltBody = "An administrator changed your AquaGuard account role from {$oldRoleLabel} to {$newRoleLabel}. Your username and password stay the same. Log in here: {$loginUrl}";

    $mail->send();
}

function sendAccountActivatedEmail($toEmail, $toName, $loginUrl) {
    $mail = createAquaguardMailer($toEmail, $toName);

    $safeName = htmlspecialchars($toName ?: 'there');
    $safeLoginUrl = htmlspecialchars($loginUrl);

    $mail->Subject = 'Your AquaGuard account is active again';
    $mail->Body = <<<HTML
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9f5;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e1ebe6;">
            <tr>
              <td style="background:#0a3128;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">AquaGuard</span><br>
                <span style="color:#8fd6b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Calatagan Mangrove Reserve</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 24px;color:#12211d;font-size:15px;line-height:1.6;">Hello {$safeName},</p>
                <p style="margin:0 0 24px;color:#12211d;font-size:15px;line-height:1.6;">An administrator reactivated your AquaGuard account. You can log in again with your usual username and password.</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:#1c7d61;">
                      <a href="{$safeLoginUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Log in to AquaGuard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#869790;font-size:11px;">This is an automated message from AquaGuard. Please don't reply to this email.</p>
        </td>
      </tr>
    </table>
    HTML;
    $mail->AltBody = "An administrator reactivated your AquaGuard account. You can log in again with your usual username and password. Log in here: {$loginUrl}";

    $mail->send();
}

// No login button here on purpose — the account can't be used to log in
// right now, so a link to the login page would just lead to a dead end.
function sendAccountDeactivatedEmail($toEmail, $toName) {
    $mail = createAquaguardMailer($toEmail, $toName);

    $safeName = htmlspecialchars($toName ?: 'there');

    $mail->Subject = 'Your AquaGuard account has been deactivated';
    $mail->Body = <<<HTML
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9f5;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e1ebe6;">
            <tr>
              <td style="background:#0a3128;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">AquaGuard</span><br>
                <span style="color:#8fd6b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Calatagan Mangrove Reserve</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#12211d;font-size:15px;line-height:1.6;">Hello {$safeName},</p>
                <p style="margin:0 0 16px;color:#12211d;font-size:15px;line-height:1.6;">An administrator deactivated your AquaGuard account. You won't be able to log in until it's reactivated. Contact an administrator if you believe this was a mistake.</p>
                <p style="margin:0;color:#12211d;font-size:15px;line-height:1.6;">Email: <a href="mailto:danielmagarao002@gmail.com" style="color:#1c7d61;">danielmagarao002@gmail.com</a><br>Phone: 09152715586</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#869790;font-size:11px;">This is an automated message from AquaGuard. Please don't reply to this email.</p>
        </td>
      </tr>
    </table>
    HTML;
    $mail->AltBody = "An administrator deactivated your AquaGuard account. You won't be able to log in until it's reactivated. Contact an administrator if you believe this was a mistake.\n\nEmail: danielmagarao002@gmail.com\nPhone: 09152715586";

    $mail->send();
}
