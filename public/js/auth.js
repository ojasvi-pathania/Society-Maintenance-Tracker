document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // Handle Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
      }

      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (res && res.success) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          if (res.user.role === 'ADMIN') {
            window.location.href = '/admin-dashboard.html';
          } else {
            window.location.href = '/resident-dashboard.html';
          }
        }, 600);
      } else {
        showToast(res ? res.message : 'Login failed.', 'error');
      }
    });
  }

  // Handle Registration
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const phone = document.getElementById('reg-phone').value;
      const flat_number = document.getElementById('reg-flat').value;
      const password = document.getElementById('reg-password').value;
      const confirm_password = document.getElementById('reg-confirm-password').value;

      if (password !== confirm_password) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          flat_number,
          password,
          confirm_password
        })
      });

      if (res && res.success) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));

        showToast('Registration successful! Welcome.', 'success');
        setTimeout(() => {
          window.location.href = '/resident-dashboard.html';
        }, 600);
      } else {
        showToast(res ? res.message : 'Registration failed.', 'error');
      }
    });
  }
});
