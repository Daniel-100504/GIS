(function () {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const btnSignIn     = document.getElementById('btnSignIn');
  const togglePw      = document.getElementById('togglePw');
  const eyeIcon       = document.getElementById('eyeIcon');
  const errorMsg      = document.getElementById('errorMsg');

  const REDIRECT_BY_ROLE = {
    menro:  '../Menro/html/satellite.html',
    ranger: '../ranger/ranger.html',
    admin:  '../Admin/admin.html',
  };

  togglePw.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      passwordInput.type = 'password';
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });

  function showError(msg) {
    errorMsg.textContent = msg;
  }

  function clearError() {
    errorMsg.textContent = '';
  }

  function validateFields() {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value;

    if (!user && !pass) {
      showError('Please enter your username and password.');
      return false;
    }
    if (!user) {
      showError('Username is required.');
      return false;
    }
    if (!pass) {
      showError('Password is required.');
      return false;
    }
    return true;
  }

  btnSignIn.addEventListener('click', handleSignIn);

  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !btnSignIn.disabled) handleSignIn();
    });
    input.addEventListener('input', clearError);
  });

  const LOCKOUT_KEY = 'aquaguard_login_lockout';
  let lockoutInterval = null;

  function startLockoutCountdown(lockedUntil, username) {
    clearInterval(lockoutInterval);
    btnSignIn.disabled = true;
    usernameInput.disabled = true;
    passwordInput.disabled = true;

    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ username, lockedUntil }));

    function tick() {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);

      if (remaining <= 0) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
        btnSignIn.disabled = false;
        usernameInput.disabled = false;
        passwordInput.disabled = false;
        localStorage.removeItem(LOCKOUT_KEY);
        clearError();
        return;
      }

      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
      showError(`Too many failed attempts. Try again in ${timeStr}.`);
    }

    tick();
    lockoutInterval = setInterval(tick, 1000);
  }

  function resumeLockoutIfAny() {
    const stored = localStorage.getItem(LOCKOUT_KEY);
    if (!stored) return;

    try {
      const { username, lockedUntil } = JSON.parse(stored);
      if (lockedUntil > Date.now()) {
        usernameInput.value = username;
        startLockoutCountdown(lockedUntil, username);
      } else {
        localStorage.removeItem(LOCKOUT_KEY);
      }
    } catch (err) {
      localStorage.removeItem(LOCKOUT_KEY);
    }
  }

  resumeLockoutIfAny();

  async function handleSignIn() {
    clearError();
    if (!validateFields()) return;

    const user = usernameInput.value.trim();
    const pass = passwordInput.value;

    btnSignIn.disabled = true;

    try {
      const res = await fetch('Database/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'login', username: user, password: pass }),
      });
      const data = await res.json();

      if (data.success && REDIRECT_BY_ROLE[data.role]) {
        localStorage.setItem('aquaguard_current_user', JSON.stringify({
          username: data.username,
          fullName: data.fullName,
          role: data.role,
        }));
        window.location.href = REDIRECT_BY_ROLE[data.role];
        return;
      }

      if (data.lockedSeconds) {
        startLockoutCountdown(Date.now() + data.lockedSeconds * 1000, user);
        return;
      }

      const attemptsNote = data.attemptsLeft !== undefined
        ? ` (${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} left)`
        : '';
      showError((data.error || 'Invalid username or password. Please try again.') + attemptsNote);
      btnSignIn.disabled = false;
    } catch (err) {
      showError('Could not reach the server. Please try again.');
      btnSignIn.disabled = false;
    }
  }

  const forgotOverlay   = document.getElementById('forgotOverlay');
  const btnForgotPassword = document.getElementById('btnForgotPassword');
  const btnCloseForgot  = document.getElementById('btnCloseForgot');
  const forgotForm      = document.getElementById('forgotForm');
  const forgotFormView  = document.getElementById('forgotFormView');
  const forgotSentView  = document.getElementById('forgotSentView');
  const forgotUsername  = document.getElementById('forgotUsername');
  const forgotErrorMsg  = document.getElementById('forgotErrorMsg');
  const btnForgotDone   = document.getElementById('btnForgotDone');

  function openForgotModal() {
    forgotFormView.hidden = false;
    forgotSentView.hidden = true;
    forgotUsername.value = usernameInput.value.trim();
    forgotErrorMsg.textContent = '';
    forgotOverlay.classList.add('open');
  }

  function closeForgotModal() {
    forgotOverlay.classList.remove('open');
  }

  btnForgotPassword.addEventListener('click', openForgotModal);
  btnCloseForgot.addEventListener('click', closeForgotModal);
  btnForgotDone.addEventListener('click', closeForgotModal);
  forgotOverlay.addEventListener('click', (e) => {
    if (e.target === forgotOverlay) closeForgotModal();
  });

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    forgotErrorMsg.textContent = '';

    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('Database/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'submitRequest', username: forgotUsername.value.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        forgotFormView.hidden = true;
        forgotSentView.hidden = false;
      } else {
        forgotErrorMsg.textContent = data.error || 'Something went wrong. Please try again.';
      }
    } catch (err) {
      forgotErrorMsg.textContent = 'Could not reach the server. Please try again.';
    }

    submitBtn.disabled = false;
  });
})();
