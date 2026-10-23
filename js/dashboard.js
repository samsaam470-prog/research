document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  loadSummary();
  loadInterviews();

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    window.location.href = 'index.html';
  });

  document.getElementById('interview-select').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) return;
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

    renderRecentInterviews(data.recentInterviews || []);
    renderRecentSubmissions(data.recentSubmissions || []);
  } catch (err) {
    showToast('Failed to load dashboard.');
  }
}

function renderRecentInterviews(interviews) {
  const el = document.getElementById('recent-interviews');
  if (interviews.length === 0) {
    el.innerHTML = '<p class="empty">No interviews yet.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Version</th><th>Created</th></tr></thead>
      <tbody>
        ${interviews.map(i => `
          <tr>
            <td class="mono">${i.id}</td>
            <td>${escapeHtml(i.title)}</td>
            <td><span class="badge ${i.status}">${i.status}</span></td>
            <td>v${i.version}</td>
            <td>${formatDate(i.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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

async function loadInterviews() {
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
        <button class="secondary small" onclick="downloadCsv('${exportBase}?mode=mapping', '${token}', 'mapping')">Export Mapping CSV</button>
        <button class="secondary small" onclick="downloadCsv('${exportBase}?mode=full', '${token}', 'full')">Export Full CSV</button>
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

async function downloadCsv(url, token, mode) {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
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
