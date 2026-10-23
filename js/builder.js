let questions = [];
let currentInterviewId = null;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    window.location.href = 'index.html';
  });

  document.getElementById('add-question-btn').addEventListener('click', () => {
    addQuestion();
  });

  document.getElementById('save-btn').addEventListener('click', saveInterview);
  document.getElementById('publish-btn').addEventListener('click', publishInterview);

  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) {
    currentInterviewId = editId;
    loadInterview(editId);
  } else {
    addQuestion();
  }
});

function addQuestion() {
  questions.push({
    question_text: '',
    question_type: 'single_choice',
    instructions: '',
    is_required: true,
    page_number: 1,
    display_order: questions.length,
    answer_display_preference: 'full',
    options: [
      { label: '', code: 'a', display_order: 0 },
      { label: '', code: 'b', display_order: 1 },
    ],
  });
  renderQuestions();
}

function renderQuestions() {
  const container = document.getElementById('questions-container');
  container.innerHTML = questions.map((q, idx) => renderQuestion(q, idx)).join('');

  questions.forEach((_, idx) => {
    document.getElementById(`q-text-${idx}`).addEventListener('input', (e) => {
      questions[idx].question_text = e.target.value;
    });
    document.getElementById(`q-type-${idx}`).addEventListener('change', (e) => {
      questions[idx].question_type = e.target.value;
      renderQuestions();
    });
    document.getElementById(`q-instructions-${idx}`).addEventListener('input', (e) => {
      questions[idx].instructions = e.target.value;
    });
    document.getElementById(`q-required-${idx}`).addEventListener('change', (e) => {
      questions[idx].is_required = e.target.checked;
    });
    document.getElementById(`q-page-${idx}`).addEventListener('change', (e) => {
      questions[idx].page_number = parseInt(e.target.value);
    });
    document.getElementById(`q-display-${idx}`).addEventListener('change', (e) => {
      questions[idx].answer_display_preference = e.target.value;
    });
    document.getElementById(`q-delete-${idx}`).addEventListener('click', () => {
      questions.splice(idx, 1);
      questions.forEach((q, i) => q.display_order = i);
      renderQuestions();
    });
  });
}

function renderQuestion(q, idx) {
  const isChoice = ['single_choice', 'multiple_choice', 'multiple_choice_other', 'dropdown'].includes(q.question_type);
  return `
    <div class="question-card">
      <div class="header">
        <h3>Question ${idx + 1}</h3>
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
          <label>Page number</label>
          <select id="q-page-${idx}">
            ${[1,2,3,4,5,6,7,8].map(p => `<option value="${p}" ${q.page_number === p ? 'selected' : ''}>Page ${p}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field">
        <label>Instructions (optional)</label>
        <input id="q-instructions-${idx}" type="text" value="${escapeAttr(q.instructions || '')}" placeholder="Explain why this question is being asked...">
      </div>

      <div class="grid grid-2">
        <div class="field">
          <label>Display preference</label>
          <select id="q-display-${idx}">
            <option value="full" ${q.answer_display_preference === 'full' ? 'selected' : ''}>Show Full Answer</option>
            <option value="mapping" ${q.answer_display_preference === 'mapping' ? 'selected' : ''}>Show Mapping Only</option>
          </select>
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; cursor: pointer;">
            <input id="q-required-${idx}" type="checkbox" ${q.is_required ? 'checked' : ''} style="width: auto;">
            Required
          </label>
        </div>
      </div>

      ${isChoice ? renderOptions(q, idx) : ''}
    </div>
  `;
}

function renderOptions(q, idx) {
  return `
    <div class="field">
      <label>Options</label>
      ${q.options.map((opt, oIdx) => `
        <div class="option-row">
          <input type="text" value="${escapeAttr(opt.label)}" placeholder="Label" oninput="updateOptionLabel(${idx}, ${oIdx}, this.value)" style="flex: 2;">
          <input type="text" value="${escapeAttr(opt.code)}" placeholder="Code" oninput="updateOptionCode(${idx}, ${oIdx}, this.value)" style="flex: 1; max-width: 80px;">
          <button class="danger small" onclick="removeOption(${idx}, ${oIdx})">×</button>
        </div>
      `).join('')}
      <button class="secondary small" onclick="addOption(${idx})">+ Add Option</button>
    </div>
  `;
}

function updateOptionLabel(qIdx, oIdx, val) { questions[qIdx].options[oIdx].label = val; }
function updateOptionCode(qIdx, oIdx, val) { questions[qIdx].options[oIdx].code = val; }

function addOption(qIdx) {
  const nextCode = String.fromCharCode(97 + questions[qIdx].options.length);
  questions[qIdx].options.push({ label: '', code: nextCode, display_order: questions[qIdx].options.length });
  renderQuestions();
}

function removeOption(qIdx, oIdx) {
  questions[qIdx].options.splice(oIdx, 1);
  renderQuestions();
}

async function saveInterview() {
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!title) { showToast('Title is required'); return; }
  if (questions.length === 0) { showToast('Add at least one question'); return; }

  for (const q of questions) {
    if (!q.question_text.trim()) { showToast('Every question needs text'); return; }
  }

  const payload = {
    title,
    description: description || null,
    questions: questions.map(q => ({
      question_text: q.question_text,
      question_type: q.question_type,
      instructions: q.instructions || null,
      is_required: q.is_required,
      display_order: q.display_order,
      page_number: q.page_number,
      answer_display_preference: q.answer_display_preference,
      options: q.options.map(o => ({
        label: o.label,
        code: o.code,
        display_order: o.display_order,
      })),
    })),
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
      const publicUrl = `interview.html?id=${data.public_id}`;
      const fullUrl = new URL(publicUrl, window.location.href).href;
      document.getElementById('publish-result').innerHTML = `
        <p class="success">Interview published.</p>
        <p style="margin-top: 0.5rem;">Public link:</p>
        <p><a href="${publicUrl}" target="_blank" style="color: var(--primary); word-break: break-all;">${fullUrl}</a></p>
        <button class="secondary small" onclick="navigator.clipboard.writeText('${fullUrl}')">Copy link</button>
      `;
      document.getElementById('publish-result').classList.remove('hidden');
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

    questions = (data.interview.questions || []).map(q => ({
      question_text: q.question_text,
      question_type: q.question_type,
      instructions: q.instructions || '',
      is_required: q.is_required === 1 || q.is_required === true,
      page_number: q.page_number || 1,
      display_order: q.display_order || 0,
      answer_display_preference: q.answer_display_preference || 'full',
      options: (q.options || []).map(o => ({
        label: o.label,
        code: o.code,
        display_order: o.display_order,
      })),
    }));

    if (data.interview.status === 'published' && data.interview.public_id) {
      const publicUrl = `interview.html?id=${data.interview.public_id}`;
      const fullUrl = new URL(publicUrl, window.location.href).href;
      document.getElementById('publish-result').innerHTML = `
        <p class="success">This interview is published. Editing will create a new version.</p>
        <p style="margin-top: 0.5rem;">Current public link:</p>
        <p><a href="${publicUrl}" target="_blank" style="color: var(--primary); word-break: break-all;">${fullUrl}</a></p>
      `;
      document.getElementById('publish-result').classList.remove('hidden');
    }

    renderQuestions();
  } catch (err) {
    showToast('Failed to load interview.');
  }
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
