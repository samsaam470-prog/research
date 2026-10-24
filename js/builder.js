let currentInterviewId = null;
let currentStatus = 'draft';
let currentPublicId = null;
let branchQuestionText = 'How do you operate as?';
let questions = []; // each has branch_side: 'agency' | 'freelancer'

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  // Attach all button handlers FIRST, before any network call.
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    window.location.href = 'index.html';
  });

  document.getElementById('save-btn').addEventListener('click', saveInterview);
  document.getElementById('publish-btn').addEventListener('click', publishInterview);
  document.getElementById('preview-btn').addEventListener('click', () => {
    if (currentPublicId) {
      window.open(`interview.html?id=${currentPublicId}`, '_blank');
    }
  });

  document.getElementById('md-upload-btn').addEventListener('click', parseMdUpload);

  document.querySelectorAll('[data-add-side]').forEach(btn => {
    btn.addEventListener('click', () => addQuestion(btn.dataset.addSide));
  });

  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) {
    currentInterviewId = editId;
    loadInterview(editId);
  } else {
    renderAll();
  }
});

function renderAll() {
  renderBranchQuestion();
  renderColumn('agency');
  renderColumn('freelancer');
}

function renderBranchQuestion() {
  const input = document.getElementById('branch-question-text');
  input.value = branchQuestionText;
  input.oninput = (e) => { branchQuestionText = e.target.value; };
}

function renderColumn(side) {
  const container = document.getElementById(`questions-${side}`);
  const sideQuestions = questions.filter(q => q.branch_side === side);

  if (sideQuestions.length === 0) {
    container.innerHTML = `<p class="empty">No ${side} questions yet. Click + Add.</p>`;
    return;
  }

  container.innerHTML = sideQuestions.map((q) => {
    const globalIdx = questions.indexOf(q);
    return renderQuestionCard(q, globalIdx);
  }).join('');

  sideQuestions.forEach((q) => {
    const gi = questions.indexOf(q);
    document.getElementById(`q-text-${gi}`).addEventListener('input', (e) => {
      questions[gi].question_text = e.target.value;
    });
    document.getElementById(`q-type-${gi}`).addEventListener('change', (e) => {
      questions[gi].question_type = e.target.value;
      renderColumn(side);
    });
    document.getElementById(`q-page-${gi}`).addEventListener('change', (e) => {
      questions[gi].page_number = parseInt(e.target.value);
    });
    document.getElementById(`q-order-${gi}`).addEventListener('change', (e) => {
      questions[gi].display_order = parseInt(e.target.value);
    });
    document.getElementById(`q-required-${gi}`).addEventListener('change', (e) => {
      questions[gi].is_required = e.target.checked;
    });
    document.getElementById(`q-instructions-${gi}`).addEventListener('input', (e) => {
      questions[gi].instructions = e.target.value;
    });
    document.getElementById(`q-why-${gi}`).addEventListener('input', (e) => {
      questions[gi].why_asking = e.target.value;
    });
    document.getElementById(`q-delete-${gi}`).addEventListener('click', () => {
      questions.splice(gi, 1);
      renderAll();
    });

    // Option updates
    (q.options || []).forEach((opt, oIdx) => {
      const labelEl = document.getElementById(`opt-label-${gi}-${oIdx}`);
      const codeEl = document.getElementById(`opt-code-${gi}-${oIdx}`);
      const otherEl = document.getElementById(`opt-other-${gi}-${oIdx}`);
      if (labelEl) labelEl.addEventListener('input', (e) => { questions[gi].options[oIdx].label = e.target.value; });
      if (codeEl) codeEl.addEventListener('input', (e) => { questions[gi].options[oIdx].code = e.target.value; });
      if (otherEl) otherEl.addEventListener('change', (e) => {
        questions[gi].options[oIdx].is_other = e.target.checked;
        if (e.target.checked && questions[gi].question_type === 'single_choice') {
          questions[gi].question_type = 'multiple_choice_other';
          renderColumn(side);
        }
      });
    });

    document.getElementById(`add-opt-${gi}`).addEventListener('click', () => {
      addOption(gi, side);
    });

    (q.options || []).forEach((opt, oIdx) => {
      document.getElementById(`del-opt-${gi}-${oIdx}`)?.addEventListener('click', () => {
        questions[gi].options.splice(oIdx, 1);
        renderColumn(side);
      });
    });
  });
}

function renderQuestionCard(q, idx) {
  const isChoice = ['single_choice', 'multiple_choice', 'multiple_choice_other', 'dropdown'].includes(q.question_type);
  const hasOther = (q.options || []).some(o => o.is_other);

  const pageOptions = [];
  for (let p = 3; p <= 15; p++) {
    pageOptions.push(`<option value="${p}" ${q.page_number === p ? 'selected' : ''}>Page ${p}</option>`);
  }

  const sideQuestions = questions.filter(x => x.branch_side === q.branch_side);
  const orderIndex = sideQuestions.indexOf(q);

  return `
    <div class="question-card">
      <div class="header">
        <h3>${q.branch_side === 'agency' ? 'Agency' : 'Freelancer'} · Q${idx + 1}</h3>
        <button class="danger small" id="q-delete-${idx}">Delete</button>
      </div>

      <div class="field">
        <label>Question text</label>
        <input id="q-text-${idx}" type="text" value="${escapeAttr(q.question_text)}" placeholder="Enter the question...">
      </div>

      <div class="grid grid-2">
        <div class="field">
          <label>Type</label>
          <select id="q-type-${idx}">
            <option value="single_choice" ${q.question_type === 'single_choice' ? 'selected' : ''}>Single choice</option>
            <option value="multiple_choice" ${q.question_type === 'multiple_choice' ? 'selected' : ''}>Multiple choice</option>
            <option value="multiple_choice_other" ${q.question_type === 'multiple_choice_other' ? 'selected' : ''}>Multiple choice + Other</option>
            <option value="dropdown" ${q.question_type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
            <option value="short_text" ${q.question_type === 'short_text' ? 'selected' : ''}>Short text</option>
            <option value="long_text" ${q.question_type === 'long_text' ? 'selected' : ''}>Long text</option>
          </select>
        </div>
        <div class="field">
          <label>Page</label>
          <select id="q-page-${idx}">${pageOptions.join('')}</select>
        </div>
      </div>

      <div class="field">
        <label>Display order within page</label>
        <input id="q-order-${idx}" type="number" min="0" value="${q.display_order ?? 0}">
      </div>

      <div class="field">
        <label>Instruction (optional — shown in white box)</label>
        <input id="q-instructions-${idx}" type="text" value="${escapeAttr(q.instructions || '')}" placeholder="e.g. Pick the one that fits best">
      </div>

      <div class="field">
        <label>Why we're asking (optional — shown in white box)</label>
        <input id="q-why-${idx}" type="text" value="${escapeAttr(q.why_asking || '')}" placeholder="e.g. We want to understand your experience">
      </div>

      <div class="field inline-group">
        <label>
          <input id="q-required-${idx}" type="checkbox" ${q.is_required ? 'checked' : ''}>
          Required
        </label>
      </div>

      ${isChoice ? renderOptions(q, idx, hasOther) : ''}
    </div>
  `;
}

function renderOptions(q, qIdx, hasOther) {
  return `
    <div class="field">
      <label>Options</label>
      ${(q.options || []).map((opt, oIdx) => `
        <div class="option-row">
          <input id="opt-label-${qIdx}-${oIdx}" type="text" value="${escapeAttr(opt.label)}" placeholder="Label" style="flex: 2;">
          <input id="opt-code-${qIdx}-${oIdx}" type="text" value="${escapeAttr(opt.code)}" placeholder="Code" style="flex: 1; max-width: 80px;">
          <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; white-space: nowrap; font-weight: normal;">
            <input id="opt-other-${qIdx}-${oIdx}" type="checkbox" ${opt.is_other ? 'checked' : ''} style="width: auto; margin: 0;">
            Other
          </label>
          <button class="danger small" id="del-opt-${qIdx}-${oIdx}">×</button>
        </div>
      `).join('')}
      <button class="secondary small" id="add-opt-${qIdx}">+ Add Option</button>
    </div>
  `;
}

function addQuestion(side) {
  questions.push({
    question_text: '',
    question_type: 'single_choice',
    instructions: '',
    why_asking: '',
    is_required: true,
    page_number: 3,
    display_order: 0,
    answer_display_preference: 'full',
    branch_side: side,
    options: [
      { label: '', code: 'a', display_order: 0, is_other: false },
      { label: '', code: 'b', display_order: 1, is_other: false },
    ],
  });
  renderColumn(side);
}

function addOption(qIdx, side) {
  const q = questions[qIdx];
  const nextCode = String.fromCharCode(97 + q.options.length);
  q.options.push({ label: '', code: nextCode, display_order: q.options.length, is_other: false });
  renderColumn(side);
}

async function saveInterview() {
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!title) { showToast('Title is required'); return; }
  if (questions.length === 0) { showToast('Add at least one question'); return; }

  for (const q of questions) {
    if (!q.question_text.trim()) { showToast('Every question needs text'); return; }
  }

  // Build the full question list: branch question (page 2) + user questions
  const fullQuestions = [];

  // Branch question (page 2, both sides)
  fullQuestions.push({
    question_text: branchQuestionText || 'How do you operate as?',
    question_type: 'single_choice',
    instructions: null,
    why_asking: null,
    is_required: true,
    display_order: 0,
    page_number: 2,
    answer_display_preference: 'full',
    branch_side: 'both',
    options: [
      { label: 'Agency', code: 'agency', display_order: 0, branch_target: 'agency', is_other: false },
      { label: 'Freelancer', code: 'freelancer', display_order: 1, branch_target: 'freelancer', is_other: false },
    ],
  });

  // User questions (pages 3+)
  for (const q of questions) {
    fullQuestions.push({
      question_text: q.question_text,
      question_type: q.question_type,
      instructions: q.instructions || null,
      why_asking: q.why_asking || null,
      is_required: q.is_required,
      display_order: q.display_order,
      page_number: q.page_number,
      answer_display_preference: q.answer_display_preference,
      branch_side: q.branch_side,
      options: q.options.map(o => ({
        label: o.label,
        code: o.code,
        display_order: o.display_order,
        is_other: !!o.is_other,
      })),
    });
  }

  const payload = {
    title,
    description: description || null,
    questions: fullQuestions,
  };

  try {
    let data;
    if (currentInterviewId) {
      data = await apiJson(`/api/interviews/${currentInterviewId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      data = await apiJson('/api/interviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (data.interview_id) {
      currentInterviewId = data.interview_id;
      showToast('Saved. Interview ID: ' + data.interview_id, 'success');
      window.history.replaceState(null, '', 'builder.html?edit=' + data.interview_id);
    } else if (data.error) {
      showToast('Save failed: ' + (data.details ? 'validation error' : data.error));
    }
  } catch (err) {
    showToast('Save failed.');
  }
}

async function publishInterview() {
  if (!currentInterviewId) {
    await saveInterview();
    if (!currentInterviewId) return;
  }
  try {
    const data = await apiJson(`/api/interviews/${currentInterviewId}/publish`, { method: 'POST' });
    if (data.public_id) {
      currentPublicId = data.public_id;
      const publicUrl = new URL(`interview.html?id=${data.public_id}`, window.location.href).href;
      const resultEl = document.getElementById('publish-result');
      resultEl.innerHTML = `
        <p class="success">Interview published.</p>
        <p style="margin-top: 0.5rem;">Public link:</p>
        <p><a href="${publicUrl}" target="_blank" style="color: var(--primary); word-break: break-all;">${publicUrl}</a></p>
        <button class="secondary small" onclick="navigator.clipboard.writeText('${publicUrl}')">Copy link</button>
      `;
      resultEl.classList.remove('hidden');

      const previewBtn = document.getElementById('preview-btn');
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview (open in new tab)';
    } else if (data.error) {
      showToast('Publish failed: ' + data.error);
    }
  } catch (err) {
    showToast('Publish failed.');
  }
}

async function loadInterview(id) {
  try {
    const data = await apiJson(`/api/interviews/${id}`);
    if (!data.interview) { showToast('Interview not found'); return; }

    document.getElementById('title').value = data.interview.title || '';
    document.getElementById('description').value = data.interview.description || '';
    currentStatus = data.interview.status;
    currentPublicId = data.interview.public_id;

    // Extract branch question text (page 2)
    const allQuestions = data.interview.questions || [];
    const branchQ = allQuestions.find(q => q.page_number === 2);
    if (branchQ) branchQuestionText = branchQ.question_text;

    // Only user questions (page 3+)
    questions = allQuestions
      .filter(q => q.page_number >= 3)
      .map(q => ({
        question_text: q.question_text,
        question_type: q.question_type,
        instructions: q.instructions || '',
        why_asking: q.why_asking || '',
        is_required: q.is_required === 1 || q.is_required === true,
        page_number: q.page_number || 3,
        display_order: q.display_order || 0,
        answer_display_preference: q.answer_display_preference || 'full',
        branch_side: q.branch_side === 'agency' ? 'agency' : 'freelancer',
        options: (q.options || []).map(o => ({
          label: o.label,
          code: o.code,
          display_order: o.display_order,
          is_other: o.is_other === 1 || o.is_other === true,
        })),
      }));

    if (data.interview.status === 'published' && data.interview.public_id) {
      const publicUrl = new URL(`interview.html?id=${data.interview.public_id}`, window.location.href).href;
      const resultEl = document.getElementById('publish-result');
      resultEl.innerHTML = `
        <p class="success">This interview is published. Editing will create a new version.</p>
        <p style="margin-top: 0.5rem;">Public link:</p>
        <p><a href="${publicUrl}" target="_blank" style="color: var(--primary); word-break: break-all;">${publicUrl}</a></p>
      `;
      resultEl.classList.remove('hidden');

      const previewBtn = document.getElementById('preview-btn');
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview (open in new tab)';
    }

    renderAll();
  } catch (err) {
    showToast('Failed to load interview.');
  }
}

function parseMdUpload() {
  const fileInput = document.getElementById('md-file');
  const file = fileInput.files[0];
  if (!file) { showToast('Choose a .md file first'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = parseMarkdown(e.target.result);
      if (parsed.length === 0) {
        showToast('No questions found in file');
        return;
      }

      // Add to both columns by default? No — let user decide.
      // Default: add to the agency column, user can copy to freelancer manually.
      const side = confirm('Add questions to Agency column? (Cancel = Freelancer)') ? 'agency' : 'freelancer';
      for (const q of parsed) {
        questions.push({
          question_text: q.question_text,
          question_type: q.options.length > 0 ? 'multiple_choice' : 'short_text',
          instructions: '',
          why_asking: '',
          is_required: true,
          page_number: 3,
          display_order: 0,
          answer_display_preference: 'full',
          branch_side: side,
          options: q.options.map((label, i) => {
            const isOther = /other/i.test(label);
            return {
              label,
              code: String.fromCharCode(97 + i),
              display_order: i,
              is_other: isOther,
            };
          }),
        });
      }
      renderAll();
      showToast(`Added ${parsed.length} questions to ${side} column`, 'success');
    } catch (err) {
      showToast('Parse failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function parseMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const questions = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Question: "1: text" or "1. text" or "1) text"
    const qMatch = line.match(/^(\d+)[:.)]\s*(.+)$/);
    if (qMatch) {
      if (current) questions.push(current);
      current = { question_text: qMatch[2].trim(), options: [] };
      continue;
    }

    // Option: "a: text" or "a. text" or "a) text"
    const oMatch = line.match(/^([a-z])[:.)]\s*(.+)$/i);
    if (oMatch && current) {
      current.options.push(oMatch[2].trim());
      continue;
    }
  }
  if (current) questions.push(current);
  return questions;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
