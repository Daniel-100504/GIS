<?php

// $actorOverride lets a caller log an action on behalf of someone with no
// logged-in session of their own — a ranger or MENRO officer setting their
// own password via an emailed reset link, for instance, never has a session
// the normal $_SESSION['user'] lookup could read from.
function logAudit($pdo, $action, $actorOverride = null) {
    $actor = $actorOverride ?? ($_SESSION['user'] ?? null);
    $stmt = $pdo->prepare(
        "INSERT INTO audit_log (actor_username, actor_role, action)
         VALUES (:actorUsername, :actorRole, :action)"
    );
    $stmt->execute([
        'actorUsername' => $actor['username'] ?? 'unknown',
        'actorRole'     => $actor['role'] ?? 'unknown',
        'action'        => $action,
    ]);
}
