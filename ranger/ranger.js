(function () {

  // GIS canvas background — same as login
  const canvas = document.getElementById('gisCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gridSpacing = 48;
    ctx.strokeStyle = 'rgba(61,220,132,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    const cx = canvas.width * 0.8, cy = canvas.height * 0.2;
    ctx.strokeStyle = 'rgba(61,220,132,0.04)';
    for (let r = 60; r < 260; r += 45) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // Set current date in topbar
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

})();

// View switcher
function switchView(viewName, btn) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target view
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  // Activate nav button
  if (btn) btn.classList.add('active');

  // Update topbar title
  const titles = { dashboard: 'Dashboard', submit: 'Submit Field Data', history: 'Submission History' };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';
}
