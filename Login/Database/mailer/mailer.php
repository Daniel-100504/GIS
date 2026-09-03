<?php

require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

function sendResetPasswordEmail($toEmail, $toName, $resetLink) {
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
    $mail->Subject = 'AquaGuard Password Reset';
    $mail->Body = "
        <p>Hello " . htmlspecialchars($toName ?: '') . ",</p>
        <p>An administrator approved your password reset request for your AquaGuard account.</p>
        <p><a href=\"{$resetLink}\">Click here to set a new password</a></p>
        <p>This link will expire in 30 minutes. If you didn't request this, you can ignore this email.</p>
    ";
    $mail->AltBody = "An administrator approved your password reset request. Open this link to set a new password: {$resetLink} (expires in 30 minutes)";

    $mail->send();
}
