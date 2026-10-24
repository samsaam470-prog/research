document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  loadSummary();
  loadAllInterviews();
  loadInterviewDropdown();

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    window.location.href = 'index.html';
  });

  document.getElementById('interview-select').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) {
      document.getElementById('submissions-area').innerHTML = '<p class="empty">Select an interview to view its submissions.</p>';
      return;
    }
    await loadSubmissions(id);
  });
});

async function loadSummary() {
  try {
    const data = await apiJson('/api/dashboard/summary');
    if (!data) return;
    document.getElementById('stat-active').textContent = data.summary?.active_interviews ?? 0;
    document.getElementById('stat-draft').textContent = data.summary?.draft_interviews ?? 0;
    document.getElementById('stat-subs').textContent = data.summary?.total_submissions ?? 0;
    renderRecentSubmissions(data.recentSubmissions || []);
  } catch (err) {
    showToast('Failed to load dashboard.');
  }
}

async function loadAllInterviews() {
  const el = document.getElementById('all-interviews');
  try {
    const data = await apiJson('/api/interviews');
    if (!data.interviews || data.interviews.length === 0) {
      el.innerHTML = '<p class="empty">You don\'t have any interviews yet. <a href="builder.html">Create an interview.</a></p>';
      return;
    }

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Version</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.interviews.map(i => renderInterviewRow(i)).join('')}
        </tbody>
      </table>
    `;

    // Attach handlers
    data.interviews.forEach(i => {
      document.getElementById(`edit-${i.id}`)?.addEventListener('click', () => {
        window.location.href = `builder.html?edit=${i.id}`;
      });
      document.getElementById(`preview-${i.id}`)?.addEventListener('click', () => {
        if (i.public_id) {
          window.open(`interview.html?id=${i.public_id}`, '_blank');
        }
      });
      document.getElementById(`copy-link-${i.id}`)?.addEventListener('click', () => {
        if (i.public_id) {
          const url = new URL(`interview.html?id=${i.public_id}`, window.location.href).href;
          navigator.clipboard.writeText(url);
          showToast('Link copied', 'success');
        }
      });
      document.getElementById(`freeze-${i.id}`)?.addEventListener('click', () => freezeInterview(i.id, i.title));
      document.getElementById(`publish-${i.id}`)?.addEventListener('click', () => publishFromDashboard(i.id));
    });
  } catch (err) {
    el.innerHTML = '<p class="empty">Failed to load interviews.</p>';
  }
}

function renderInterviewRow(i) {
  const isPublished = i.status === 'published';
  const isFrozen = i.status === 'inactive';

  let previewButton = '';
  let copyButton = '';
  if (isPublished && i.public_id) {
    previewButton = `<button class="secondary small" id="preview-${i.id}">Preview</button>`;
    copyButton = `<button class="secondary small" id="copy-link-${i.id}">Copy link</button>`;
  } else if (i.status === 'draft') {
    previewButton = `<button class="secondary small" disabled title="Publish first to preview">Preview</button>`;
  }

  let statusButton = '';
  if (i.status === 'draft') {
    statusButton = `<button class="small" id="publish-${i.id}">Publish</button>`;
  } else if (i.status === 'published') {
    statusButton = `<button class="danger small" id="freeze-${i.id}">Freeze</button>`;
  }

  return `
    <tr>
      <td class="mono">${i.id}</td>
      <td>${escapeHtml(i.title)}</td>
      <td><span class="badge ${i.status}">${i.status}</span></td>
      <td>v${i.version}</td>
      <td>${formatDate(i.created_at)}</td>
      <td>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
          <button class="secondary small" id="edit-${i.id}">Edit</button>
          ${previewButton}
          ${copyButton}
          ${statusButton}
        </div>
      </td>
    </tr>
  `;
}

async function freezeInterview(id, title) {
  if (!confirm(`Freeze "${title}"? It will stop accepting submissions. All data is preserved.`)) return;
  try {
    await apiJson(`/api/interviews/${id}`, { method: 'DELETE' });
    showToast('Interview frozen.', 'success');
    loadSummary();
    loadAllInterviews();
    loadInterviewDropdown();
  } catch (err) {
    showToast('Failed to freeze interview.');
  }
}

async function publishFromDashboard(id) {
  try {
    const data = await apiJson(`/api/interviews/${id}/publish`, { method: 'POST' });
    if (data.public_id) {
      showToast('Published.', 'success');
      loadSummary();
      loadAllInterviews();
      loadInterviewDropdown();
    } else {
      showToast('Publish failed: ' + (data.error || 'unknown'));
    }
  } catch (err) {
    showToast('Publish failed.');
  }
}

function renderRecentSubmissions(submissions) {
  const el = document.getElementById('recent-submissions');
  if (submissions.length === 0) {
    el.innerHTML = '<p class="empty">No submissions yet.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Interview</th><th>Date</th></tr></thead>
      <tbody>
        ${submissions.map(s => `
          <tr>
            <td class="mono">${s.id}</td>
            <td>${escapeHtml(s.participant_name)}</td>
            <td>${escapeHtml(s.participant_email)}</td>
            <td>${escapeHtml(s.interview_title)}</td>
            <td>${formatDate(s.submitted_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadInterviewDropdown() {
  try {
    const data = await apiJson('/api/interviews');
    const select = document.getElementById('interview-select');
    if (!data.interviews || data.interviews.length === 0) {
      select.innerHTML = '<option value="">No interviews yet</option>';
      return;
    }
    select.innerHTML = '<option value="">Select an interview...</option>' +
      data.interviews.map(i =>
        `<option value="${i.id}">${escapeHtml(i.title)} (v${i.version}) — ${i.status}</option>`
      ).join('');
  } catch (err) {
    showToast('Failed to load interviews.');
  }
}

async function loadSubmissions(interviewId) {
  const el = document.getElementById('submissions-area');
  el.innerHTML = '<p class="empty">Loading submissions...</p>';
  try {
    const data = await apiJson(`/api/dashboard/interviews/${interviewId}/submissions`);
    if (!data.submissions || data.submissions.length === 0) {
      el.innerHTML = '<p class="empty">No submissions for this interview yet.</p>';
      return;
    }

    const exportBase = `${API_BASE}/api/dashboard/interviews/${interviewId}/submissions/export`;
    const token = getToken();

    el.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="secondary small" onclick="downloadCsv('${exportBase}?mode=mapping', 'mapping')">Export Mapping CSV</button>
        <button class="secondary small" onclick="downloadCsv('${exportBase}?mode=full', 'full')">Export Full CSV</button>
      </div>
      <table>
        <thead><tr><th>Submission ID</th><th>Name</th><th>Email</th><th>Date</th><th>Answers</th></tr></thead>
        <tbody>
          ${data.submissions.map(s => `
            <tr>
              <td class="mono">${s.id}</td>
              <td>${escapeHtml(s.participant_name)}</td>
              <td>${escapeHtml(s.participant_email)}</td>
              <td>${formatDate(s.submitted_at)}</td>
              <td>${(s.answers || []).length} answered</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    el.innerHTML = '<p class="empty">Failed to load submissions.</p>';
  }
}

async function downloadCsv(url, mode) {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + getToken() },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `submissions-${mode}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    showToast('Export failed.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
