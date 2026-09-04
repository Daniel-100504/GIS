<?php

function logAudit($pdo, $action, $targetRole = null, $targetUsername = null, $details = null) {
    $actor = $_SESSION['user'] ?? null;
    $stmt = $pdo->prepare(
        "INSERT INTO audit_log (actor_username, actor_role, action, target_username, target_role, details)
         VALUES (:actorUsername, :actorRole, :action, :targetUsername, :targetRole, :details)"
    );
    $stmt->execute([
        'actorUsername'  => $actor['username'] ?? 'unknown',
        'actorRole'      => $actor['role'] ?? 'unknown',
        'action'         => $action,
        'targetUsername' => $targetUsername,
        'targetRole'     => $targetRole,
        'details'        => $details,
    ]);
}
