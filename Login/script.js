(function () {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const rememberMe    = document.getElementById('rememberMe');
  const btnSignIn     = document.getElementById('btnSignIn');
  const togglePw      = document.getElementById('togglePw');
  const eyeIcon       = document.getElementById('eyeIcon');
  const errorMsg      = document.getElementById('errorMsg');
  const roleBtns      = document.querySelectorAll('.role-btn');

  let selectedRole = 'menro';

  const CREDENTIALS = {
    menro:  { username: 'menro', password: 'menro123' },
    ranger: { username: 'ranger', password: 'ranger123' },
  };

  roleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
      clearError();
    });
  });

  // Set default role (menro)
  const defaultRoleBtn = document.querySelector('[data-role="menro"]');
  if (defaultRoleBtn) {
    defaultRoleBtn.classList.add('active');
  }

togglePw.addEventListener('click', () => {

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';

    // Eye with slash (password is visible)
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;
  } else {
    passwordInput.type = 'password';

    // Normal eye (password is hidden)
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }

});

  const saved = localStorage.getItem('menro_remembered_user');
  if (saved) {
    usernameInput.value = saved;
    rememberMe.checked = true;
  }

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
      if (e.key === 'Enter') handleSignIn();
    });
    input.addEventListener('input', clearError);
  });

function handleSignIn() {
  clearError();
  if (!validateFields()) return;

  const user = usernameInput.value.trim();
  const pass = passwordInput.value;

  if (rememberMe.checked) {
    localStorage.setItem("menro_remembered_user", user);
  } else {
    localStorage.removeItem("menro_remembered_user");
  }

  setTimeout(() => {

    const creds = CREDENTIALS[selectedRole];

    let success = false;

    if (creds && user === creds.username && pass === creds.password) {
      success = true;
    }

    if (!success) {
      const accounts = JSON.parse(localStorage.getItem('gis_accounts')) || {};
      if (accounts[user] && accounts[user].password === pass) {
        success = true;
      }
    }

    if (success) {

      if (selectedRole === 'menro') {
        window.location.href = "../Menro/satellite.html";
      } else if (selectedRole === 'ranger') {
        showError("wala pa po.");
      }
      return;

    }

    showError("Invalid username or password. Please try again.");
    btnSignIn.disabled = false;
  }, 900);
}
})();

