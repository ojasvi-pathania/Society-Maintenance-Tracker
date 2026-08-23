/**
 * Common Application Utilities & Helper Functions
 */

const API_BASE = '/api';

// Toast Notification System
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Get Logged In User from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

// Get Auth Token
function getAuthToken() {
  return localStorage.getItem('token');
}

// Enforce Role Route Guard
function checkAuthGuard(requiredRole = null) {
  const token = getAuthToken();
  const user = getCurrentUser();

  if (!token || !user) {
    window.location.href = '/login.html';
    return false;
  }

  if (requiredRole && user.role !== requiredRole) {
    showToast('Access denied for your user role.', 'error');
    if (user.role === 'ADMIN') {
      window.location.href = '/admin-dashboard.html';
    } else {
      window.location.href = '/resident-dashboard.html';
    }
    return false;
  }

  return user;
}

// Common API Fetch Wrapper
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = options.headers || {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return null;
    }

    return data;
  } catch (err) {
    console.error(`API Fetch Error [${endpoint}]:`, err);
    showToast('Network error. Please check server connection.', 'error');
    return { success: false, message: 'Network connection failed.' };
  }
}

// Render User Sidebar & Header Profile Info
function renderUserProfileUI(user) {
  if (!user) return;
  const userNameEl = document.getElementById('ui-user-name');
  const userFlatEl = document.getElementById('ui-user-flat');
  const userAvatarEl = document.getElementById('ui-user-avatar');

  if (userNameEl) userNameEl.textContent = user.name;
  if (userFlatEl) userFlatEl.textContent = user.role === 'ADMIN' ? 'Society Administrator' : `Flat: ${user.flat_number}`;
  if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
}

// Format Date string
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Badge Helpers
function getStatusBadgeHtml(status, isOverdue = false) {
  let badgeClass = 'badge-open';
  if (status === 'In Progress') badgeClass = 'badge-progress';
  if (status === 'Resolved') badgeClass = 'badge-resolved';

  let html = `<span class="badge ${badgeClass}">${status}</span>`;
  if (isOverdue && status !== 'Resolved') {
    html += ` <span class="badge badge-overdue">OVERDUE</span>`;
  }
  return html;
}

function getPriorityBadgeHtml(priority) {
  let badgeClass = 'badge-low';
  if (priority === 'Medium') badgeClass = 'badge-medium';
  if (priority === 'High') badgeClass = 'badge-high';
  return `<span class="badge ${badgeClass}">${priority}</span>`;
}

// Logout Handler
function handleLogout() {
  apiFetch('/auth/logout', { method: 'POST' });
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showToast('Logged out successfully', 'success');
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 500);
}
