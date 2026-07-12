(function () {
  // ── Element refs ──────────────────────────────
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const rememberMe    = document.getElementById('rememberMe');
  const btnSignIn     = document.getElementById('btnSignIn');
  const togglePw      = document.getElementById('togglePw');
  const eyeIcon       = document.getElementById('eyeIcon');
  const errorMsg      = document.getElementById('errorMsg');
  const roleBtns      = document.querySelectorAll('.role-btn');

  // ── State ─────────────────────────────────────
  let selectedRole = 'menro'; // default

  // ── Role selection ────────────────────────────
  roleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
      clearError();
    });
  });

  // ── Password toggle ───────────────────────────
  togglePw.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    eyeIcon.innerHTML = isHidden
      ? `<!-- eye-off -->
         <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8
                  a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
                  a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
      : `<!-- eye-open -->
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>`;
  });

  // ── Restore remembered username ───────────────
  const saved = localStorage.getItem('menro_remembered_user');
  if (saved) {
    usernameInput.value = saved;
    rememberMe.checked = true;
  }

  // ── Validation helpers ────────────────────────
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

  // ── Sign in handler ───────────────────────────
  btnSignIn.addEventListener('click', handleSignIn);

  // Allow Enter key to submit
  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSignIn();
    });
    input.addEventListener('input', clearError);
  });

  function handleSignIn() {
    clearError();
    if (!validateFields()) return;

    const user = usernameInput.value.trim();

    // Remember me
    if (rememberMe.checked) {
      localStorage.setItem('menro_remembered_user', user);
    } else {
      localStorage.removeItem('menro_remembered_user');
    }

    // TODO: Replace with real auth API call
    // Placeholder: simulate a login attempt
    btnSignIn.disabled = true;
    btnSignIn.textContent = 'Signing in…';

    setTimeout(() => {
      // Example: accept any non-empty input for now
      // Replace this block with your actual auth logic
      const success = true;

      if (success) {
        // Redirect to dashboard
        window.location.href = 'satellite.html';
      } else {
        showError('Invalid username or password. Please try again.');
        btnSignIn.disabled = false;
        btnSignIn.textContent = 'Sign In';
      }
    }, 900);
  }
})();