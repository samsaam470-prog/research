let interview = null;
let currentPage = 1;
let totalPages = 1;
const answers = {};

document.addEventListener('DOMContentLoaded', async () => {
  const publicId = new URLSearchParams(window.location.search).get('id');
  if (!publicId) {
    showMessage('Interview not found', 'No interview ID in the URL.');
    return;
  }

  try {
    const res = await fetch(API_BASE + '/api/public/interviews/' + publicId);
    const data = await res.json();

    if (res.status === 410) {
      showMessage('Interview closed', 'This interview is no longer accepting responses.');
      return;
    }
    if (!res.ok) {
      showMessage('Interview not found', data.error || 'This interview does not exist or is not available.');
      return;
    }

    interview = data.interview;
    const pages = new Set(interview.questions.map(q => q.page_number || 1));
    totalPages = Math.max(...pages);

    document.getElementById('interview-title').textContent = interview.title;
    document.getElementById('interview-desc').textContent = interview.description || '';
    renderPage();
  } catch (err) {
    showMessage('Error', 'Failed to load interview. Please try again later.');
  }
});

function renderPage() {
  const container = document.getElementById('form-container');
  const pageQuestions = interview.questions.filter(q => (q.page_number || 1) === currentPage);

  let html = '';

  if (currentPage === 1) {
    html += `
      <div class="question-block" data-question-id="__name__" data-type="text">
        <span class="q-label">Your name<span class="required-star">*</span></span>
        <input type="text" placeholder="Your name">
      </div>
      <div class="question-block" data-question-id="__email__" data-type="text">
        <span class="q-label">Your email<span class="required-star">*</span></span>
        <input type="email" placeholder="you@example.com">
      </div>
    `;
  }

  html += pageQuestions.map(q => renderQuestion(q)).join('') + renderActions();
  container.innerHTML = html;

  document.querySelectorAll('[data-question-id]').forEach(el => {
    const qid = el.dataset.questionId;
    const type = el.dataset.type;

    if (type === 'text') {
      const input = el.querySelector('input, textarea');
      if (input) {
        input.addEventListener('input', (e) => {
          answers[qid] = { text_answer: e.target.value };
        });
      }
    } else if (type === 'single') {
      const select = el.querySelector('select');
      if (select) {
        select.addEventListener('change', (e) => {
          answers[qid] = { selected_option_ids: [e.target.value] };
        });
      } else {
        el.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            if (e.target.checked) answers[qid] = { selected_option_ids: [e.target.value] };
          });
        });
      }
    } else if (type === 'multi') {
      el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const selected = Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
          answers[qid] = { selected_option_ids: selected };
        });
      });
    }

    const otherInput = el.querySelector('.other-input');
    if (otherInput) {
      otherInput.addEventListener('input', (e) => {
        if (!answers[qid]) answers[qid] = { selected_option_ids: [] };
        answers[qid].other_text = e.target.value;
      });
    }
  });

  renderProgress();

  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(); window.scrollTo(0, 0); }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    if (validatePage()) { currentPage++; renderPage(); window.scrollTo(0, 0); }
  });

  document.getElementById('submit-btn')?.addEventListener('click', submitInterview);
}

function renderQuestion(q) {
  const isRequired = q.is_required === 1 || q.is_required === true;
  const star = isRequired ? '<span class="required-star">*</span>' : '';

  let inputHtml = '';
  const type = q.question_type;

  if (type === 'short_text') {
    inputHtml = `<input type="text" placeholder="Your answer">`;
  } else if (type === 'long_text') {
    inputHtml = `<textarea rows="4" placeholder="Your answer"></textarea>`;
  } else if (type === 'dropdown') {
    inputHtml = `<select>
      <option value="">Select...</option>
      ${q.options.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('')}
    </select>`;
  } else if (type === 'single_choice') {
    inputHtml = q.options.map(o => `
      <label class="option-label">
        <input type="radio" name="q-${q.id}" value="${o.id}">
        ${escapeHtml(o.label)}
      </label>
    `).join('');
  } else if (type === 'multiple_choice' || type === 'multiple_choice_other') {
    inputHtml = q.options.map(o => `
      <label class="option-label">
        <input type="checkbox" value="${o.id}">
        ${escapeHtml(o.label)}
      </label>
    `).join('');
    if (type === 'multiple_choice_other') {
      inputHtml += `<input type="text" class="other-input" placeholder="Other (please specify)" style="margin-top: 0.5rem;">`;
    }
  }

  const dataType = (type === 'short_text' || type === 'long_text') ? 'text'
    : (type === 'single_choice' || type === 'dropdown') ? 'single'
    : 'multi';

  return `
    <div class="question-block" data-question-id="${q.id}" data-type="${dataType}">
      <span class="q-label">${escapeHtml(q.question_text)}${star}</span>
      ${q.instructions ? `<div class="q-instructions">${escapeHtml(q.instructions)}</div>` : ''}
      ${inputHtml}
    </div>
  `;
}

function renderActions() {
  const buttons = [];
  if (currentPage > 1) buttons.push('<button class="secondary" id="prev-btn">← Back</button>');
  else buttons.push('<span></span>');

  if (currentPage < totalPages) {
    buttons.push('<button id="next-btn">Next →</button>');
  } else {
    buttons.push('<button id="submit-btn">Submit</button>');
  }

  return `<div class="actions">${buttons.join('')}</div>`;
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
  const pageQuestions = interview.questions.filter(q => (q.page_number || 1) === currentPage);
  for (const q of pageQuestions) {
    const isRequired = q.is_required === 1 || q.is_required === true;
    if (!isRequired) continue;
    const a = answers[q.id];
    const hasChoice = a && a.selected_option_ids && a.selected_option_ids.length > 0;
    const hasText = a && a.text_answer && a.text_answer.trim();
    if (!hasChoice && !hasText) {
      showToast('Please answer all required questions on this page.');
      return false;
    }
  }
  return true;
}

async function submitInterview() {
  if (!validatePage()) return;

  const name = answers['__name__'].text_answer.trim();
  const email = answers['__email__'].text_answer.trim();

  const answerList = [];
  for (const q of interview.questions) {
    const a = answers[q.id];
    if (a) {
      answerList.push({
        question_id: q.id,
        selected_option_ids: a.selected_option_ids || [],
        text_answer: a.text_answer || null,
        other_text: a.other_text || null,
      });
    }
  }

  const payload = {
    participant_name: name,
    participant_email: email,
    answers: answerList,
  };

  try {
    const res = await fetch(`${API_BASE}/api/public/interviews/${interview.public_id}/submissions`, {
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
