<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AquaGuard – Mangrove Monitoring System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=2" />
</head>
<body>

  <div class="auth-layout">

    <aside class="brand-panel">
      <canvas id="gisCanvas" aria-hidden="true"></canvas>

      <div class="brand-panel-content">
        <div class="brand-top">
          <img src="../assets/calatagan-seal.png" width="44" height="44" alt="Calatagan Seal" class="brand-seal">
          <div class="brand-text">
            <h1 class="brand-title">AquaGuard</h1>
            <p class="brand-sub">Mangrove Monitoring System</p>
          </div>
        </div>

        <div class="brand-mid">
          <h2 class="brand-headline">Protecting Calatagan&rsquo;s<br>Mangrove Reserve</h2>
          <p class="brand-copy">Real-time satellite monitoring, ranger field reports, and habitat analytics for DENR&#8209;MENRO Batangas.</p>

          <div class="brand-coords">
            <div class="brand-coord">
              <span class="brand-coord-value">13.8317&deg; N</span>
              <span class="brand-coord-label">Latitude</span>
            </div>
            <div class="brand-coord-divider"></div>
            <div class="brand-coord">
              <span class="brand-coord-value">120.6400&deg; E</span>
              <span class="brand-coord-label">Longitude</span>
            </div>
          </div>
        </div>

        <p class="brand-footer">DENR&#8209;MENRO Batangas &middot; Calatagan Mangrove Reserve</p>
      </div>
    </aside>

    <main class="form-panel">
      <div class="form-card">

        <div class="form-card-head">
          <h2 class="form-title">Welcome back</h2>
          <p class="form-subtitle">Sign in to access the monitoring dashboard.</p>
        </div>

        <div class="form-body">
          <div class="field-group">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              placeholder="Enter your username"
              autocomplete="username"
            />
          </div>

          <div class="field-group">
            <label for="password">Password</label>
            <div class="password-wrapper">
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                autocomplete="current-password"
              />
              <button class="toggle-pw" type="button" id="togglePw" aria-label="Toggle password visibility">
                <svg id="eyeIcon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="form-row-end">
            <button type="button" class="forgot-link" id="btnForgotPassword">Forgot password?</button>
          </div>

          <button class="btn-signin" id="btnSignIn" type="button">
            <span class="btn-text">Sign In</span>
            <span class="btn-arrow">→</span>
          </button>

          <div id="errorMsg" class="error-msg" role="alert" aria-live="polite"></div>
        </div>

      </div>
    </main>

  </div>

  <div class="auth-overlay" id="forgotOverlay">
    <div class="auth-modal">
      <button class="auth-modal-close" id="btnCloseForgot" aria-label="Close">&times;</button>

      <div id="forgotFormView">
        <h2 class="auth-modal-title">Forgot your password?</h2>
        <p class="auth-modal-text">Enter your username. An admin will be notified and can reset your password for you.</p>
        <form id="forgotForm" class="form-body">
          <div class="field-group">
            <label for="forgotUsername">Username</label>
            <input type="text" id="forgotUsername" placeholder="Enter your username" autocomplete="username" required>
          </div>
          <button type="submit" class="btn-signin">
            <span class="btn-text">Send Request</span>
          </button>
          <div id="forgotErrorMsg" class="error-msg" role="alert" aria-live="polite"></div>
        </form>
      </div>

      <div id="forgotSentView" hidden>
        <h2 class="auth-modal-title">Request sent</h2>
        <p class="auth-modal-text">If that account exists, an admin has been notified and will reset your password soon.</p>
        <button type="button" class="btn-signin" id="btnForgotDone">
          <span class="btn-text">Done</span>
        </button>
      </div>
    </div>
  </div>

  <script src="script.js?v=3"></script>
  <script>
    (function () {
      const canvas = document.getElementById('gisCanvas');
      const ctx = canvas.getContext('2d');
      const panel = canvas.parentElement;

      function resize() {
        canvas.width = panel.clientWidth;
        canvas.height = panel.clientHeight;
        draw();
      }

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gridSpacing = 44;
        ctx.strokeStyle = 'rgba(61,220,132,0.08)';
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

        const cx = canvas.width * 0.65, cy = canvas.height * 0.28;
        ctx.strokeStyle = 'rgba(61,220,132,0.07)';
        for (let r = 50; r < 340; r += 42) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        const dots = [
          [0.18, 0.22], [0.75, 0.62], [0.4, 0.85], [0.62, 0.15], [0.28, 0.7], [0.85, 0.35]
        ];
        ctx.fillStyle = 'rgba(61,220,132,0.22)';
        dots.forEach(([fx, fy]) => {
          ctx.beginPath();
          ctx.arc(fx * canvas.width, fy * canvas.height, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(61,220,132,0.12)';
          ctx.lineWidth = 1;
          const px = fx * canvas.width, py = fy * canvas.height;
          ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
        });
      }

      window.addEventListener('resize', resize);
      resize();
    })();
  </script>
</body>
</html>
