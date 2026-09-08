<?php

function logAudit($pdo, $action) {
    $actor = $_SESSION['user'] ?? null;
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
