<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer/mailer.php';

header('Content-Type: application/json');

$tableByRole = [
    'menro'  => 'menro_accounts',
    'ranger' => 'ranger_accounts',
];

$allRoleTables = $tableByRole + ['admin' => 'admin_accounts'];

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function requireValidRoleAndId($tableByRole, $role, $id) {
    if (!isset($tableByRole[$role]) || !ctype_digit((string) $id)) {
        respond(['success' => false, 'error' => 'Invalid role or account id.'], 400);
    }
    return $tableByRole[$role];
}

function usernameTakenElsewhere($pdo, $tables, $username) {
    foreach ($tables as $table) {
        $stmt = $pdo->prepare("SELECT 1 FROM {$table} WHERE username = :username");
        $stmt->execute(['username' => $username]);
        if ($stmt->fetch()) return true;
    }
    return false;
}

function findValidResetRequest($pdo, $token) {
    $stmt = $pdo->prepare(
        "SELECT * FROM password_reset_requests
         WHERE token = :token AND status = 'pending' AND token_expires_at > NOW()"
    );
    $stmt->execute(['token' => $token]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
    $pdo = getDbConnection();

    if ($action === 'login') {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($username === '' || $password === '') {
            respond(['success' => false, 'error' => 'Missing username or password.'], 400);
        }

        foreach ($allRoleTables as $role => $table) {
            $stmt = $pdo->prepare("SELECT id, username, password_hash, full_name FROM {$table} WHERE username = :username");
            $stmt->execute(['username' => $username]);
            $account = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($account && password_verify($password, $account['password_hash'])) {
                respond([
                    'success'  => true,
                    'role'     => $role,
                    'username' => $account['username'],
                    'fullName' => $account['full_name'],
                ]);
            }
        }

        respond(['success' => false, 'error' => 'Invalid username or password.']);
    }

    if ($action === 'list') {
        $result = [];
        foreach ($tableByRole as $role => $table) {
            $stmt = $pdo->query("SELECT id, username, full_name, email, created_at FROM {$table} ORDER BY created_at DESC");
            $result[$role] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        respond(['success' => true, 'accounts' => $result]);
    }

    if ($action === 'create') {
        $role     = $_POST['role'] ?? '';
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $fullName = trim($_POST['fullName'] ?? '') ?: null;
        $email    = trim($_POST['email'] ?? '') ?: null;

        if (!isset($tableByRole[$role])) {
            respond(['success' => false, 'error' => 'Invalid role.'], 400);
        }
        if ($username === '' || $password === '') {
            respond(['success' => false, 'error' => 'Username and password are required.'], 400);
        }
        if (usernameTakenElsewhere($pdo, $allRoleTables, $username)) {
            respond(['success' => false, 'error' => 'That username is already taken.'], 409);
        }

        $table = $tableByRole[$role];
        $hash = password_hash($password, PASSWORD_DEFAULT);

        try {
            $stmt = $pdo->prepare("INSERT INTO {$table} (username, password_hash, full_name, email) VALUES (:username, :hash, :fullName, :email)");
            $stmt->execute(['username' => $username, 'hash' => $hash, 'fullName' => $fullName, 'email' => $email]);
            respond(['success' => true, 'id' => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            respond(['success' => false, 'error' => 'That username is already taken.'], 409);
        }
    }

    if ($action === 'update') {
        $role     = $_POST['role'] ?? '';
        $id       = $_POST['id'] ?? '';
        $username = trim($_POST['username'] ?? '');
        $fullName = trim($_POST['fullName'] ?? '') ?: null;
        $email    = trim($_POST['email'] ?? '') ?: null;

        $table = requireValidRoleAndId($tableByRole, $role, $id);
        if ($username === '') {
            respond(['success' => false, 'error' => 'Username is required.'], 400);
        }

        $stmt = $pdo->prepare("SELECT username FROM {$table} WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$current) {
            respond(['success' => false, 'error' => 'Account not found.'], 404);
        }

        if ($current['username'] !== $username && usernameTakenElsewhere($pdo, $allRoleTables, $username)) {
            respond(['success' => false, 'error' => 'That username is already taken.'], 409);
        }

        try {
            $stmt = $pdo->prepare(
                "UPDATE {$table} SET username = :username, full_name = :fullName, email = :email WHERE id = :id"
            );
            $stmt->execute(['username' => $username, 'fullName' => $fullName, 'email' => $email, 'id' => $id]);
            respond(['success' => true]);
        } catch (PDOException $e) {
            respond(['success' => false, 'error' => 'That username is already taken.'], 409);
        }
    }

    if ($action === 'resetPassword') {
        $role      = $_POST['role'] ?? '';
        $id        = $_POST['id'] ?? '';
        $password  = $_POST['password'] ?? '';
        $requestId = $_POST['requestId'] ?? null;

        $table = requireValidRoleAndId($tableByRole, $role, $id);
        if ($password === '') {
            respond(['success' => false, 'error' => 'Password is required.'], 400);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("UPDATE {$table} SET password_hash = :hash WHERE id = :id");
        $stmt->execute(['hash' => $hash, 'id' => $id]);

        if ($requestId !== null && ctype_digit((string) $requestId)) {
            $stmt = $pdo->prepare("UPDATE password_reset_requests SET status = 'resolved', resolved_at = NOW() WHERE id = :id");
            $stmt->execute(['id' => $requestId]);
        }

        respond(['success' => true]);
    }

    if ($action === 'delete') {
        $role = $_POST['role'] ?? '';
        $id   = $_POST['id'] ?? '';

        $table = requireValidRoleAndId($tableByRole, $role, $id);
        $stmt = $pdo->prepare("DELETE FROM {$table} WHERE id = :id");
        $stmt->execute(['id' => $id]);
        respond(['success' => true]);
    }

    if ($action === 'listResetRequests') {
        $stmt = $pdo->query(
            "SELECT id, username, role, account_id, requested_at FROM password_reset_requests
             WHERE status = 'pending' ORDER BY requested_at ASC"
        );
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($requests as &$req) {
            $req['email'] = null;
            $req['fullName'] = null;
            if (isset($tableByRole[$req['role']])) {
                $table = $tableByRole[$req['role']];
                $accStmt = $pdo->prepare("SELECT email, full_name FROM {$table} WHERE id = :id");
                $accStmt->execute(['id' => $req['account_id']]);
                $acc = $accStmt->fetch(PDO::FETCH_ASSOC);
                if ($acc) {
                    $req['email'] = $acc['email'];
                    $req['fullName'] = $acc['full_name'];
                }
            }
        }
        unset($req);

        respond(['success' => true, 'requests' => $requests]);
    }

    if ($action === 'approveResetRequest') {
        $requestId = $_POST['requestId'] ?? '';

        if (!ctype_digit((string) $requestId)) {
            respond(['success' => false, 'error' => 'Invalid request id.'], 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM password_reset_requests WHERE id = :id AND status = 'pending'");
        $stmt->execute(['id' => $requestId]);
        $request = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$request || !isset($tableByRole[$request['role']])) {
            respond(['success' => false, 'error' => 'Request not found.'], 404);
        }

        $table = $tableByRole[$request['role']];
        $accStmt = $pdo->prepare("SELECT email, full_name FROM {$table} WHERE id = :id");
        $accStmt->execute(['id' => $request['account_id']]);
        $account = $accStmt->fetch(PDO::FETCH_ASSOC);

        if (!$account || !$account['email']) {
            respond(['success' => false, 'error' => 'This account has no email on file.'], 400);
        }

        $token = bin2hex(random_bytes(32));

        $stmt = $pdo->prepare(
            "UPDATE password_reset_requests SET token = :token, token_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = :id"
        );
        $stmt->execute(['token' => $token, 'id' => $requestId]);

        $resetLink = 'http://' . $_SERVER['HTTP_HOST'] . '/GIS/Login/reset-password.html?token=' . $token;

        try {
            sendResetPasswordEmail($account['email'], $account['full_name'], $resetLink);
        } catch (Exception $e) {
            respond(['success' => false, 'error' => 'Couldn\'t send the email. Please try again.'], 500);
        }

        respond(['success' => true]);
    }

    if ($action === 'dismissResetRequest') {
        $id = $_POST['id'] ?? '';

        if (!ctype_digit((string) $id)) {
            respond(['success' => false, 'error' => 'Invalid request id.'], 400);
        }

        $stmt = $pdo->prepare("UPDATE password_reset_requests SET status = 'resolved', resolved_at = NOW() WHERE id = :id");
        $stmt->execute(['id' => $id]);
        respond(['success' => true]);
    }

    if ($action === 'submitRequest') {
        $username = trim($_POST['username'] ?? '');
        if ($username === '') {
            respond(['success' => false, 'error' => 'Please enter your username.'], 400);
        }

        $role = null;
        $accountId = null;

        foreach ($tableByRole as $roleName => $table) {
            $stmt = $pdo->prepare("SELECT id FROM {$table} WHERE username = :username");
            $stmt->execute(['username' => $username]);
            $account = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($account) {
                $role = $roleName;
                $accountId = $account['id'];
                break;
            }
        }

        if ($role === null) {
            respond(['success' => false, 'error' => 'No account found with that username.']);
        }

        $stmt = $pdo->prepare(
            "INSERT INTO password_reset_requests (username, role, account_id) VALUES (:username, :role, :accountId)"
        );
        $stmt->execute(['username' => $username, 'role' => $role, 'accountId' => $accountId]);

        respond(['success' => true]);
    }

    if ($action === 'validateToken') {
        $token = $_GET['token'] ?? '';
        if ($token === '') {
            respond(['success' => false, 'error' => 'Missing token.'], 400);
        }

        $request = findValidResetRequest($pdo, $token);
        if (!$request) {
            respond(['success' => false, 'error' => 'This reset link is invalid or has expired.'], 400);
        }

        respond(['success' => true, 'username' => $request['username']]);
    }

    if ($action === 'setPassword') {
        $token    = $_POST['token'] ?? '';
        $password = $_POST['password'] ?? '';

        if ($token === '' || $password === '') {
            respond(['success' => false, 'error' => 'Missing token or password.'], 400);
        }
        if (strlen($password) < 8) {
            respond(['success' => false, 'error' => 'Password must be at least 8 characters.'], 400);
        }

        $request = findValidResetRequest($pdo, $token);
        if (!$request) {
            respond(['success' => false, 'error' => 'This reset link is invalid or has expired.'], 400);
        }
        if (!isset($tableByRole[$request['role']])) {
            respond(['success' => false, 'error' => 'This reset link is invalid or has expired.'], 400);
        }

        $table = $tableByRole[$request['role']];
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("UPDATE {$table} SET password_hash = :hash WHERE id = :id");
        $stmt->execute(['hash' => $hash, 'id' => $request['account_id']]);

        $stmt = $pdo->prepare(
            "UPDATE password_reset_requests SET status = 'resolved', resolved_at = NOW() WHERE id = :id"
        );
        $stmt->execute(['id' => $request['id']]);

        respond(['success' => true]);
    }

    respond(['success' => false, 'error' => 'Unknown action.'], 400);
} catch (PDOException $e) {
    respond(['success' => false, 'error' => 'Server error. Please try again later.'], 500);
}
