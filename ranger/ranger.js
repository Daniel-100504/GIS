(function () {
  const canvas = document.getElementById('gisCanvas');
  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gridSpacing = 48;
    ctx.strokeStyle = 'rgba(20, 107, 82, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const cx = canvas.width * 0.8;
    const cy = canvas.height * 0.2;
    ctx.strokeStyle = 'rgba(20, 107, 82, 0.04)';
    for (let r = 60; r < 260; r += 45) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }

  window.addEventListener('resize', resize);
  resize();

  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();

(function bindSignoutConfirm() {
  const overlay     = document.getElementById('signoutOverlay');
  const signOutBtn  = document.getElementById('btnSignOut');
  const closeBtn    = document.getElementById('btnCloseSignout');
  const cancelBtn   = document.getElementById('btnCancelSignout');
  const confirmBtn  = document.getElementById('btnConfirmSignout');
  if (!overlay || !signOutBtn || !confirmBtn) return;

  function openSignoutConfirm() { overlay.classList.add('open'); }
  function closeSignoutConfirm() { overlay.classList.remove('open'); }

  signOutBtn.addEventListener('click', openSignoutConfirm);
  if (closeBtn) closeBtn.addEventListener('click', closeSignoutConfirm);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSignoutConfirm);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSignoutConfirm();
  });
  confirmBtn.addEventListener('click', () => {
    window.location.href = '../Login/Login.html';
  });
})();

function switchView(viewName, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  if (btn) btn.classList.add('active');

  const titles = { dashboard: 'Dashboard', submit: 'Submit Field Data', history: 'Submission History' };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';
}