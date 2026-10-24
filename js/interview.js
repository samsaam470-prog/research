let interview = null;
let publicId = null;
let branch = null; // 'agency' | 'freelancer' | null
let currentPage = 1;
let totalPages = 1;
let allQuestions = []; // cached from initial fetch (pages 1 & 2)
const answers = {};

document.addEventListener('DOMContentLoaded', async () => {
  publicId = new URLSearchParams(window.location.search).get('id');
  if (!publicId) {
    showMessage('Interview not found', 'No interview ID in the URL.');
    return;
  }
  await fetchInterview();
});

async function fetchInterview() {
  try {
    const url = API_BASE + '/api/public/interviews/' + publicId + (branch ? '?branch=' + branch : '');
    const res = await fetch(url);
    const data = await res.json();

    if (res.status === 410) {
      showMessage('Interview closed', 'This interview is no longer accepting responses.');
      return;
    }
    if (!res.ok) {
      showMessage('Interview not found', data.error || 'This interview is not available.');
      return;
    }

    interview = data.interview;
    allQuestions = interview.questions || [];
    const pages = new Set(allQuestions.map(q => q.page_number || 1));
    totalPages = Math.max(...pages);
    renderPage();
  } catch (err) {
    showMessage('Error', 'Failed to load interview. Please try again later.');
  }
}

function renderPage() {
  const container = document.getElementById('form-container');
  const pageQuestions = allQuestions.filter(q => (q.page_number || 1) === currentPage);

  // Progress bar: hidden on pages 1 and 2, visible on 3+
  const progressEl = document.getElementById('progress');
  if (currentPage >= 3) {
    progressEl.classList.remove('hidden');
    renderProgress();
  } else {
    progressEl.classList.add('hidden');
  }

  document.getElementById('interview-title').textContent = interview.title;
  document.getElementById('interview-desc').textContent = interview.description || '';

  let html = '';

  if (currentPage === 1) {
    html += `
      <div class="question-block" data-question-id="__name__" data-type="text">
        <span class="q-label">Your name<span class="required-star">*</span></span>
        <input type="text" placeholder="Your name" id="input-name">
      </div>
      <div class="question-block" data-question-id="__email__" data-type="text">
        <span class="q-label">Your email<span class="required-star">*</span></span>
        <input type="email" placeholder="you@example.com" id="input-email">
      </div>
    `;
  }

  html += pageQuestions.map(q => renderQuestion(q)).join('');

  // Actions
  const buttons = [];
  if (currentPage > 1) {
    buttons.push('<button class="secondary" id="prev-btn">Back</button>');
  } else {
    buttons.push('<span></span>');
  }

  if (currentPage < totalPages) {
    buttons.push('<button id="next-btn">Continue</button>');
  } else {
    buttons.push('<button id="submit-btn">Submit</button>');
  }

  html += `<div class="actions">${buttons.join('')}</div>`;
  container.innerHTML = html;

  attachHandlers();
  renderProgress();
}

function renderQuestion(q) {
  const isRequired = q.is_required === 1 || q.is_required === true;
  const star = isRequired ? '<span class="required-star">*</span>' : '';
  const hasInfo = q.instructions || q.why_asking;

  const infoIcon = hasInfo ? `
    <button type="button" class="info-icon" data-info-id="${q.id}" title="Show info">i</button>
    <div class="info-box hidden" id="info-${q.id}">
      ${q.why_asking ? `<div class="info-section"><strong>Why we're asking:</strong><br>${escapeHtml(q.why_asking)}</div>` : ''}
      ${q.instructions ? `<div class="info-section"><strong>Instruction:</strong><br>${escapeHtml(q.instructions)}</div>` : ''}
    </div>
  ` : '';

  let inputHtml = '';
  const type = q.question_type;
  const hasOther = (q.options || []).some(o => o.is_other === 1 || o.is_other === true);

  if (type === 'short_text') {
    inputHtml = `<input type="text" placeholder="Your answer" data-text-q="${q.id}">`;
  } else if (type === 'long_text') {
    inputHtml = `<textarea rows="4" placeholder="Your answer" data-text-q="${q.id}"></textarea>`;
  } else if (type === 'dropdown') {
    inputHtml = `<select data-single-q="${q.id}">
      <option value="">Select...</option>
      ${q.options.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('')}
    </select>`;
  } else if (type === 'single_choice') {
    inputHtml = q.options.map(o => `
      <label class="option-label">
        <input type="radio" name="q-${q.id}" value="${o.id}" data-single-q="${q.id}">
        ${escapeHtml(o.label)}
      </label>
    `).join('');
  } else if (type === 'multiple_choice' || type === 'multiple_choice_other') {
    inputHtml = q.options.filter(o => !(o.is_other === 1 || o.is_other === true)).map(o => `
      <label class="option-label">
        <input type="checkbox" value="${o.id}" data-multi-q="${q.id}">
        ${escapeHtml(o.label)}
      </label>
    `).join('');
    if (hasOther) {
      inputHtml += `<input type="text" class="other-input" placeholder="Other — please specify" data-other-q="${q.id}">`;
    }
  }

  return `
    <div class="question-block" data-qblock-id="${q.id}">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span class="q-label">${escapeHtml(q.question_text)}${star}</span>
        ${infoIcon}
      </div>
      ${inputHtml}
    </div>
  `;
}

function attachHandlers() {
  // Name / Email inputs on page 1
  if (currentPage === 1) {
    document.getElementById('input-name')?.addEventListener('input', e => {
      answers['__name__'] = { text_answer: e.target.value };
    });
    document.getElementById('input-email')?.addEventListener('input', e => {
      answers['__email__'] = { text_answer: e.target.value };
    });
  }

  // Text questions
  document.querySelectorAll('[data-text-q]').forEach(el => {
    el.addEventListener('input', e => {
      const qid = el.dataset.textQ;
      answers[qid] = { text_answer: e.target.value };
    });
  });

  // Single choice (radio)
  document.querySelectorAll('[data-single-q]').forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      el.addEventListener('change', e => {
        const qid = el.dataset.singleQ;
        if (e.target.value) answers[qid] = { selected_option_ids: [e.target.value] };
        else delete answers[qid];
      });
    } else {
      el.addEventListener('change', e => {
        if (e.target.checked) {
          const qid = el.dataset.singleQ;
          answers[qid] = { selected_option_ids: [e.target.value] };
        }
      });
    }
  });

  // Multiple choice (checkbox)
  const multiGroups = {};
  document.querySelectorAll('[data-multi-q]').forEach(el => {
    const qid = el.dataset.multiQ;
    if (!multiGroups[qid]) multiGroups[qid] = [];
    multiGroups[qid].push(el);
  });
  for (const qid in multiGroups) {
    multiGroups[qid].forEach(cb => {
      cb.addEventListener('change', () => {
        const selected = multiGroups[qid].filter(c => c.checked).map(c => c.value);
        if (!answers[qid]) answers[qid] = {};
        answers[qid].selected_option_ids = selected;
      });
    });
  }

  // Other inputs
  document.querySelectorAll('[data-other-q]').forEach(el => {
    el.addEventListener('input', e => {
      const qid = el.dataset.otherQ;
      if (!answers[qid]) answers[qid] = { selected_option_ids: [] };
      answers[qid].other_text = e.target.value;
    });
  });

  // Info icons
  document.querySelectorAll('[data-info-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.infoId;
      const box = document.getElementById(`info-${id}`);
      const isHidden = box.classList.contains('hidden');
      // Close all other boxes
      document.querySelectorAll('.info-box').forEach(b => b.classList.add('hidden'));
      if (isHidden) box.classList.remove('hidden');
    });
  });

  // Click outside closes info boxes
  document.addEventListener('click', () => {
    document.querySelectorAll('.info-box').forEach(b => b.classList.add('hidden'));
  });

  // Navigation buttons
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage();
      window.scrollTo(0, 0);
    }
  });

  document.getElementById('next-btn')?.addEventListener('click', async () => {
    if (!validatePage()) return;

    // Special case: page 2 — branch selection auto-advances
    if (currentPage === 2) {
      const branchQ = allQuestions.find(q => q.page_number === 2);
      if (branchQ) {
        const ans = answers[branchQ.id];
        if (!ans || !ans.selected_option_ids || ans.selected_option_ids.length === 0) {
          showToast('Please choose Agency or Freelancer.');
          return;
        }
        // Determine branch from the selected option's code
        const selectedId = ans.selected_option_ids[0];
        const selectedOption = branchQ.options.find(o => o.id === selectedId);
        if (selectedOption) {
          branch = selectedOption.code === 'agency' ? 'agency' : 'freelancer';
          await fetchInterview(); // re-fetch with branch filter
        }
      }
    }

    if (currentPage < totalPages) {
      currentPage++;
      renderPage();
      window.scrollTo(0, 0);
    }
  });

  document.getElementById('submit-btn')?.addEventListener('click', submitInterview);

  // Page 2 auto-advance on option click
  if (currentPage === 2) {
    document.querySelectorAll('[data-single-q]').forEach(el => {
      el.addEventListener('change', async e => {
        if (e.target.checked) {
          // Wait a tick for answers to be set
          setTimeout(async () => {
            const branchQ = allQuestions.find(q => q.page_number === 2);
            if (!branchQ) return;
            const ans = answers[branchQ.id];
            if (!ans || !ans.selected_option_ids || !ans.selected_option_ids.length) return;
            const selectedId = ans.selected_option_ids[0];
            const selectedOption = branchQ.options.find(o => o.id === selectedId);
            if (selectedOption) {
              branch = selectedOption.code === 'agency' ? 'agency' : 'freelancer';
              await fetchInterview();
              currentPage++;
              renderPage();
              window.scrollTo(0, 0);
            }
          }, 50);
        }
      });
    });
  }
}

function renderProgress() {
  const el = document.getElementById('progress');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const step = document.createElement('div');
    step.className = 'progress-step' + (i === currentPage ? ' active' : i < currentPage ? ' done' : '');
    el.appendChild(step);
  }
}

function validatePage() {
  if (currentPage === 1) {
    const name = answers['__name__']?.text_answer?.trim();
    const email = answers['__email__']?.text_answer?.trim();
    if (!name || !email) {
      showToast('Name and email are required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email.');
      return false;
    }
  }

  if (currentPage === 2) {
    const branchQ = allQuestions.find(q => q.page_number === 2);
    if (branchQ) {
      const ans = answers[branchQ.id];
      if (!ans || !ans.selected_option_ids || ans.selected_option_ids.length === 0) {
        showToast('Please choose Agency or Freelancer.');
        return false;
      }
    }
  }

  if (currentPage >= 3) {
    const pageQuestions = allQuestions.filter(q => (q.page_number || 1) === currentPage);
    for (const q of pageQuestions) {
      const isRequired = q.is_required === 1 || q.is_required === true;
      if (!isRequired) continue;
      const a = answers[q.id];
      const hasChoice = a && a.selected_option_ids && a.selected_option_ids.length > 0;
      const hasText = a && a.text_answer && a.text_answer.trim();
      const hasOther = a && a.other_text && a.other_text.trim();
      if (!hasChoice && !hasText && !hasOther) {
        showToast('Please answer all required questions on this page.');
        return false;
      }
    }
  }

  return true;
}

async function submitInterview() {
  if (!validatePage()) return;

  if (!branch) {
    showToast('Please choose Agency or Freelancer on page 2.');
    return;
  }

  const name = answers['__name__']?.text_answer?.trim();
  const email = answers['__email__']?.text_answer?.trim();

  const answerList = [];
  for (const qid in answers) {
    if (qid === '__name__' || qid === '__email__') continue;
    const a = answers[qid];
    if (a && (a.selected_option_ids?.length || a.text_answer || a.other_text)) {
      answerList.push({
        question_id: qid,
        selected_option_ids: a.selected_option_ids || [],
        text_answer: a.text_answer || null,
        other_text: a.other_text || null,
      });
    }
  }

  const payload = {
    participant_name: name,
    participant_email: email,
    branch,
    answers: answerList,
  };

  try {
    const res = await fetch(`${API_BASE}/api/public/interviews/${publicId}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      window.location.href = 'thanks.html';
    } else {
      showToast(data.error || 'Submission failed.');
    }
  } catch (err) {
    showToast('Network error. Please try again.');
  }
}

function showMessage(title, body) {
  document.body.innerHTML = `
    <div class="container">
      <div class="card" style="max-width: 500px; margin: 5rem auto; text-align: center;">
        <h2>${title}</h2>
        <p style="color: var(--muted); margin-top: 1rem;">${body}</p>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
