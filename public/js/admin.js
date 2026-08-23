/**
 * Admin Dashboard & Management Script - Phase 3 Complete
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuthGuard('ADMIN');
  if (!user) return;

  renderUserProfileUI(user);

  const pageId = document.body.dataset.page;

  if (pageId === 'admin-dashboard') {
    loadAdminDashboard();
  } else if (pageId === 'admin-complaints') {
    loadAdminComplaints();
  } else if (pageId === 'admin-overdue') {
    loadAdminOverdueComplaints();
  } else if (pageId === 'admin-notices') {
    loadAdminNotices();
  } else if (pageId === 'admin-settings') {
    loadAdminSettings();
  }
});

// Load Admin Dashboard Metrics & Visual Charts
async function loadAdminDashboard() {
  const statsRes = await apiFetch('/complaints/stats');
  if (statsRes && statsRes.success) {
    const s = statsRes.stats;
    document.getElementById('stat-total').textContent = s.total;
    document.getElementById('stat-open').textContent = s.open;
    document.getElementById('stat-progress').textContent = s.in_progress;
    document.getElementById('stat-resolved').textContent = s.resolved;
    document.getElementById('stat-overdue').textContent = s.overdue;

    // Render Visual Status Distribution Bar Chart
    const chartContainer = document.getElementById('status-chart-container');
    if (chartContainer) {
      const total = s.total || 1; // avoid divide by zero
      const openPct = Math.round((s.open / total) * 100);
      const progPct = Math.round((s.in_progress / total) * 100);
      const resPct = Math.round((s.resolved / total) * 100);

      chartContainer.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:4px;">
            <span>Open Tickets</span>
            <span>${s.open} (${openPct}%)</span>
          </div>
          <div style="background:#e2e8f0; border-radius:6px; height:12px; overflow:hidden;">
            <div style="background:#d97706; width:${openPct}%; height:100%; border-radius:6px; transition:width 0.5s;"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:4px;">
            <span>In Progress</span>
            <span>${s.in_progress} (${progPct}%)</span>
          </div>
          <div style="background:#e2e8f0; border-radius:6px; height:12px; overflow:hidden;">
            <div style="background:#4f46e5; width:${progPct}%; height:100%; border-radius:6px; transition:width 0.5s;"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:4px;">
            <span>Resolved</span>
            <span>${s.resolved} (${resPct}%)</span>
          </div>
          <div style="background:#e2e8f0; border-radius:6px; height:12px; overflow:hidden;">
            <div style="background:#059669; width:${resPct}%; height:100%; border-radius:6px; transition:width 0.5s;"></div>
          </div>
        </div>
      `;
    }

    // Render Category Breakdown Grid
    const catContainer = document.getElementById('category-breakdown-container');
    if (catContainer && s.by_category) {
      const entries = Object.entries(s.by_category);
      if (entries.length === 0) {
        catContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No complaints have been raised yet.</p>`;
      } else {
        catContainer.innerHTML = entries.map(([cat, count]) => `
          <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${cat}</span>
            <span class="badge badge-low" style="font-size: 0.85rem;">${count}</span>
          </div>
        `).join('');
      }
    }
  }

  // Load Overdue Complaints Table Preview
  const overdueRes = await apiFetch('/complaints?overdue=true');
  if (overdueRes && overdueRes.success) {
    const tbody = document.getElementById('recent-overdue-tbody');
    if (tbody) {
      if (overdueRes.complaints.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Great! There are currently no overdue complaints.</td></tr>`;
      } else {
        tbody.innerHTML = overdueRes.complaints.slice(0, 5).map(c => `
          <tr class="overdue-row">
            <td><a href="/complaint-detail.html?id=${c.id}" style="font-weight:700; color: #dc2626; text-decoration: none;">${c.complaint_number}</a></td>
            <td>${c.flat_number} (${c.resident_name})</td>
            <td>${c.category}</td>
            <td>${getPriorityBadgeHtml(c.priority)}</td>
            <td>${getStatusBadgeHtml(c.status, true)}</td>
            <td>${formatDate(c.created_at)}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="openUpdateModal(${c.id}, '${c.status}', '${c.priority}')">Update</button>
            </td>
          </tr>
        `).join('');
      }
    }
  }
}

// Load All Complaints (Manage Complaints)
async function loadAdminComplaints() {
  const statusFilter = document.getElementById('filter-status');
  const categoryFilter = document.getElementById('filter-category');
  const searchInput = document.getElementById('filter-search');

  async function fetchAndRender() {
    let query = '?';
    if (statusFilter && statusFilter.value) query += `status=${encodeURIComponent(statusFilter.value)}&`;
    if (categoryFilter && categoryFilter.value) query += `category=${encodeURIComponent(categoryFilter.value)}&`;
    if (searchInput && searchInput.value) query += `search=${encodeURIComponent(searchInput.value)}&`;

    const res = await apiFetch(`/complaints${query}`);
    const tbody = document.getElementById('admin-complaints-tbody');
    if (!tbody) return;

    if (res && res.success) {
      if (res.complaints.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No complaints have been raised yet.</td></tr>`;
      } else {
        tbody.innerHTML = res.complaints.map(c => `
          <tr class="${c.is_overdue ? 'overdue-row' : ''}">
            <td><strong>${c.complaint_number}</strong></td>
            <td>${c.flat_number} (${c.resident_name})</td>
            <td>${c.category}</td>
            <td>${c.description.substring(0, 40)}${c.description.length > 40 ? '...' : ''}</td>
            <td>${getPriorityBadgeHtml(c.priority)}</td>
            <td>${getStatusBadgeHtml(c.status, c.is_overdue)}</td>
            <td>${formatDate(c.created_at)}</td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-primary btn-sm" onclick="openUpdateModal(${c.id}, '${c.status}', '${c.priority}')">Update</button>
                <a href="/complaint-detail.html?id=${c.id}" class="btn btn-secondary btn-sm">Details</a>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  if (statusFilter) statusFilter.addEventListener('change', fetchAndRender);
  if (categoryFilter) categoryFilter.addEventListener('change', fetchAndRender);
  if (searchInput) searchInput.addEventListener('input', fetchAndRender);

  fetchAndRender();
}

// Load Overdue Complaints View
async function loadAdminOverdueComplaints() {
  const res = await apiFetch('/complaints?overdue=true');
  const tbody = document.getElementById('overdue-complaints-tbody');
  const thresholdHeader = document.getElementById('threshold-info-header');

  if (res && res.success) {
    if (thresholdHeader) {
      thresholdHeader.textContent = `Displaying unresolved complaints older than ${res.thresholdDays} days (Configured Threshold).`;
    }

    if (!tbody) return;

    if (res.complaints.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Great! There are currently no overdue complaints.</td></tr>`;
    } else {
      tbody.innerHTML = res.complaints.map(c => `
        <tr class="overdue-row">
          <td><strong>${c.complaint_number}</strong></td>
          <td>${c.flat_number} (${c.resident_name})</td>
          <td>${c.category}</td>
          <td>${c.description.substring(0, 45)}${c.description.length > 45 ? '...' : ''}</td>
          <td>${getPriorityBadgeHtml(c.priority)}</td>
          <td>${getStatusBadgeHtml(c.status, true)}</td>
          <td>${formatDate(c.created_at)}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-primary btn-sm" onclick="openUpdateModal(${c.id}, '${c.status}', '${c.priority}')">Update</button>
              <a href="/complaint-detail.html?id=${c.id}" class="btn btn-secondary btn-sm">Details</a>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

// Open Update Modal
function openUpdateModal(complaintId, currentStatus, currentPriority) {
  const modalBackdrop = document.getElementById('update-modal');
  if (!modalBackdrop) return;

  document.getElementById('update-complaint-id').value = complaintId;
  document.getElementById('update-status').value = currentStatus;
  document.getElementById('update-priority').value = currentPriority;
  document.getElementById('update-note').value = '';

  modalBackdrop.classList.remove('hidden');
}

function closeUpdateModal() {
  const modalBackdrop = document.getElementById('update-modal');
  if (modalBackdrop) modalBackdrop.classList.add('hidden');
}

// Handle Update Modal Form Submit
document.addEventListener('submit', async (e) => {
  if (e.target && e.target.id === 'update-complaint-form') {
    e.preventDefault();

    const complaintId = document.getElementById('update-complaint-id').value;
    const status = document.getElementById('update-status').value;
    const priority = document.getElementById('update-priority').value;
    const note = document.getElementById('update-note').value;

    const res = await apiFetch(`/complaints/${complaintId}/status-priority`, {
      method: 'PUT',
      body: JSON.stringify({ status, priority, note })
    });

    if (res && res.success) {
      showToast('Complaint updated successfully.', 'success');
      closeUpdateModal();
      const pageId = document.body.dataset.page;
      if (pageId === 'admin-dashboard') loadAdminDashboard();
      if (pageId === 'admin-complaints') loadAdminComplaints();
      if (pageId === 'admin-overdue') loadAdminOverdueComplaints();
    } else {
      showToast(res ? res.message : 'Failed to update complaint.', 'error');
    }
  }
});

// Admin Notice Management
async function loadAdminNotices() {
  const form = document.getElementById('create-notice-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('notice-title').value;
      const content = document.getElementById('notice-content').value;
      const is_important = document.getElementById('notice-important').checked;

      const res = await apiFetch('/notices', {
        method: 'POST',
        body: JSON.stringify({ title, content, is_important })
      });

      if (res && res.success) {
        showToast('Notice published successfully!', 'success');
        form.reset();
        loadAdminNoticesGrid();
      } else {
        showToast(res ? res.message : 'Error publishing notice.', 'error');
      }
    });
  }

  loadAdminNoticesGrid();
}

async function loadAdminNoticesGrid() {
  const res = await apiFetch('/notices');
  const container = document.getElementById('admin-notices-grid');
  if (!container) return;

  if (res && res.success) {
    if (res.notices.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted); padding: 1rem;">No society notices are currently available.</p>`;
    } else {
      container.innerHTML = res.notices.map(n => `
        <div class="notice-card ${n.is_important ? 'pinned' : ''}">
          ${n.is_important ? '<span class="pinned-tag">📌 IMPORTANT PINNED</span>' : ''}
          <h3 class="notice-title">${n.title}</h3>
          <p class="notice-content">${n.content}</p>
          <div class="notice-footer">
            <span>Posted ${formatDate(n.created_at)}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteNotice(${n.id})">Delete</button>
          </div>
        </div>
      `).join('');
    }
  }
}

async function deleteNotice(noticeId) {
  if (!confirm('Are you sure you want to delete this notice?')) return;

  const res = await apiFetch(`/notices/${noticeId}`, { method: 'DELETE' });
  if (res && res.success) {
    showToast('Notice deleted.', 'success');
    loadAdminNoticesGrid();
  } else {
    showToast('Failed to delete notice.', 'error');
  }
}

// Settings Page
async function loadAdminSettings() {
  const res = await apiFetch('/settings');
  if (res && res.success && res.settings) {
    const input = document.getElementById('setting-threshold');
    if (input) input.value = res.settings.overdue_threshold_days || '3';
  }

  const form = document.getElementById('settings-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const overdue_threshold_days = document.getElementById('setting-threshold').value;

      const updateRes = await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({ overdue_threshold_days })
      });

      if (updateRes && updateRes.success) {
        showToast('Overdue threshold settings saved successfully!', 'success');
      } else {
        showToast(updateRes ? updateRes.message : 'Failed to save settings.', 'error');
      }
    });
  }
}
