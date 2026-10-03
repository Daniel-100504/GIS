<?php

// PHP's own session.gc_maxlifetime default (1440s = 24 minutes) is how long
// a session FILE is allowed to sit idle on the server before garbage
// collection is free to delete it — a completely separate mechanism from
// this app's own 15-minute client-side idle-logout warning. A tab left idle
// (especially backgrounded, where browsers throttle JS timers so that
// 15-minute warning can fire much later than 15 real minutes) could have its
// session file quietly deleted server-side first. Refreshing afterward then
// dropped straight to the login page with no "you were signed out" message,
// since there was nothing left to log out of. Keeping this comfortably
// longer than the client timer means that visible warning is always what
// ends an idle session first, not a silent server-side expiry.
ini_set('session.gc_maxlifetime', 14400);
session_start();
