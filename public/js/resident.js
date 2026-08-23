/**
 * Resident Dashboard & Features Script - Phase 3 Complete
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuthGuard('RESIDENT');
  if (!user) return;

  renderUserProfileUI(user);

  const pageId = document.body.dataset.page;

  if (pageId === 'resident-dashboard') {
    loadResidentDashboard();
  } else if (pageId === 'raise-complaint') {
    initRaiseComplaint();
  } else if (pageId === 'my-complaints') {
    loadMyComplaints();
  } else if (pageId === 'notice-board') {
    loadNoticeBoard();
  }
});

// Load Resident Dashboard Stats & Data
async function loadResidentDashboard() {
  const statsRes = await apiFetch('/complaints/stats');
  if (statsRes && statsRes.success) {
    const s = statsRes.stats;
    document.getElementById('stat-total').textContent = s.total;
    document.getElementById('stat-open').textContent = s.open;
    document.getElementById('stat-progress').textContent = s.in_progress;
    document.getElementById('stat-resolved').textContent = s.resolved;
  }

  const cmpRes = await apiFetch('/complaints');
  if (cmpRes && cmpRes.success) {
    const tbody = document.getElementById('recent-complaints-tbody');
    if (tbody) {
      if (cmpRes.complaints.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No complaints have been raised yet.</td></tr>`;
      } else {
        const top5 = cmpRes.complaints.slice(0, 5);
        tbody.innerHTML = top5.map(c => `
          <tr>
            <td><a href="/complaint-detail.html?id=${c.id}" style="font-weight:700; color: var(--primary); text-decoration: none;">${c.complaint_number}</a></td>
            <td>${c.category}</td>
            <td>${c.description.substring(0, 45)}${c.description.length > 45 ? '...' : ''}</td>
            <td>${getPriorityBadgeHtml(c.priority)}</td>
            <td>${getStatusBadgeHtml(c.status, c.is_overdue)}</td>
            <td>${formatDate(c.created_at)}</td>
          </tr>
        `).join('');
      }
    }
  }

  const noticeRes = await apiFetch('/notices');
  if (noticeRes && noticeRes.success) {
    const container = document.getElementById('dashboard-notices-container');
    if (container) {
      if (noticeRes.notices.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No society notices are currently available.</p>`;
      } else {
        const topNotices = noticeRes.notices.slice(0, 3);
        container.innerHTML = topNotices.map(n => `
          <div class="notice-card ${n.is_important ? 'pinned' : ''}" style="padding: 1rem; margin-bottom: 0.75rem;">
            ${n.is_important ? '<span class="pinned-tag">📌 IMPORTANT</span>' : ''}
            <h4 class="notice-title" style="font-size: 0.95rem; margin-bottom: 0.25rem;">${n.title}</h4>
            <p class="notice-content" style="font-size: 0.85rem; margin-bottom: 0.5rem;">${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}</p>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(n.created_at)}</span>
          </div>
        `).join('');
      }
    }
  }
}

// Raise Complaint Form Handling
function initRaiseComplaint() {
  const form = document.getElementById('raise-complaint-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = document.getElementById('cmp-category').value;
    const description = document.getElementById('cmp-description').value;
    const photoInput = document.getElementById('cmp-photo');

    if (!category || !description) {
      showToast('Category and description are required.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('category', category);
    formData.append('description', description);

    if (photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        showToast('Invalid photo format! Only JPG, JPEG, PNG, and WEBP allowed.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo file size cannot exceed 5MB.', 'error');
        return;
      }
      formData.append('photo', file);
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const res = await apiFetch('/complaints', {
      method: 'POST',
      body: formData
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Complaint';

    if (res && res.success) {
      showToast(`Complaint registered successfully! ID: ${res.complaint.complaint_number}`, 'success');
      setTimeout(() => {
        window.location.href = res.redirect_url || `/complaint-detail.html?id=${res.complaint.id}`;
      }, 800);
    } else {
      showToast(res ? res.message : 'Failed to register complaint.', 'error');
    }
  });
}

// Load My Complaints
async function loadMyComplaints() {
  const statusFilter = document.getElementById('filter-status');
  const categoryFilter = document.getElementById('filter-category');

  async function fetchAndRender() {
    let query = '?';
    if (statusFilter && statusFilter.value) query += `status=${encodeURIComponent(statusFilter.value)}&`;
    if (categoryFilter && categoryFilter.value) query += `category=${encodeURIComponent(categoryFilter.value)}&`;

    const res = await apiFetch(`/complaints${query}`);
    const tbody = document.getElementById('my-complaints-tbody');
    if (!tbody) return;

    if (res && res.success) {
      if (res.complaints.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No complaints have been raised yet.</td></tr>`;
      } else {
        tbody.innerHTML = res.complaints.map(c => `
          <tr>
            <td><strong>${c.complaint_number}</strong></td>
            <td>${c.category}</td>
            <td>${c.description.substring(0, 50)}${c.description.length > 50 ? '...' : ''}</td>
            <td>${getPriorityBadgeHtml(c.priority)}</td>
            <td>${getStatusBadgeHtml(c.status, c.is_overdue)}</td>
            <td>${formatDate(c.created_at)}</td>
            <td>
              <a href="/complaint-detail.html?id=${c.id}" class="btn btn-secondary btn-sm">View Details</a>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  if (statusFilter) statusFilter.addEventListener('change', fetchAndRender);
  if (categoryFilter) categoryFilter.addEventListener('change', fetchAndRender);

  fetchAndRender();
}

// Notice Board (Read-only for Residents)
async function loadNoticeBoard() {
  const res = await apiFetch('/notices');
  const container = document.getElementById('notice-board-grid');
  if (!container) return;

  if (res && res.success) {
    if (res.notices.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No society notices are currently available.</p>`;
    } else {
      container.innerHTML = res.notices.map(n => `
        <div class="notice-card ${n.is_important ? 'pinned' : ''}">
          ${n.is_important ? '<span class="pinned-tag">📌 IMPORTANT PINNED</span>' : ''}
          <h3 class="notice-title">${n.title}</h3>
          <p class="notice-content">${n.content}</p>
          <div class="notice-footer">
            <span>By ${n.author_name}</span>
            <span>${formatDate(n.created_at)}</span>
          </div>
        </div>
      `).join('');
    }
  }
}
