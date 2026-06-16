/**
 * ИИ-тренажёр продаж — App logic
 *
 * Screens:
 *   'welcome'         → #screen-welcome          (Screen 1)
 *   'instructions'    → #screen-instructions      (Screen 2)
 *   'mode-choice'     → #screen-mode-choice       (Screen 3)
 *   'match'           → #screen-match             (Screen 4 — фильтры + результаты)
 *   'practice-setup'  → #screen-practice-setup    (Screen 5 — выбор программ + партнёра)
 *   'negotiate'       → #screen-negotiate         (Screen 6 — переговорный чат)
 */

var MATCH_API_URL     = '/api/match';
var NEGOTIATE_API_URL = '/api/negotiate';
var chatStreaming = false;

// ────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────

function goToScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });
  var target = document.getElementById('screen-' + screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ────────────────────────────────────────────────────────────────
// Mode selection (Screen 3)
// ────────────────────────────────────────────────────────────────

function selectMode(mode) {
  if (mode === 'match') {
    goToScreen('match');
    return;
  }
  if (mode === 'practice') {
    goToScreen('practice-setup');
    return;
  }
  showToast('Скоро будет доступно');
}

// ────────────────────────────────────────────────────────────────
// SCREEN 4 — Фильтры
// ────────────────────────────────────────────────────────────────

function collectFilters() {
  function checked(name) {
    return Array.from(
      document.querySelectorAll('#filter-panel input[name="' + name + '"]:checked')
    ).map(function (cb) { return cb.value; });
  }

  return {
    'Целевая аудитория': checked('audience'),
    'Трудоёмкость':      checked('hours'),
    'Ключевые слова':    checked('keywords'),
    'Стоимость':         checked('price'),
    'Формат программы':  checked('format'),
    'Тип документа':     checked('doctype'),
  };
}

function buildFilterMessage(filters) {
  var lines = [];
  Object.keys(filters).forEach(function (field) {
    var vals = filters[field];
    if (vals.length > 0) {
      lines.push('• ' + field + ': ' + vals.join(', '));
    }
  });
  if (lines.length === 0) return null;
  return 'Применить фильтры:\n' + lines.join('\n');
}

function applyFilters() {
  if (chatStreaming) return;

  var filters = collectFilters();
  var message = buildFilterMessage(filters);

  if (!message) {
    showToast('Выберите хотя бы один фильтр');
    return;
  }

  var resultsEl = document.getElementById('chat-messages');
  if (!resultsEl) return;

  resultsEl.innerHTML = '';

  setApplyDisabled(true);
  chatStreaming = true;

  var typingEl = document.createElement('div');
  typingEl.className = 'chat-typing';
  typingEl.innerHTML = '<div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div>';
  resultsEl.appendChild(typingEl);

  resultsEl.scrollTop = 0;

  var resultEl = null;

  fetch(MATCH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
  })
    .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
    .then(function (payload) {
      if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      resultEl = document.createElement('div');
      resultEl.className = 'result-block';
      resultsEl.appendChild(resultEl);

      if (!payload.ok || payload.data.error) {
        updateResult(resultEl, '⚠️ ' + (payload.data.error || 'Ошибка сервера'));
      } else {
        updateResult(resultEl, payload.data.result || '');
      }
      resultsEl.scrollTop = resultsEl.scrollHeight;
      finishResults();
    })
    .catch(function (err) {
      if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      if (!resultEl) {
        resultEl = document.createElement('div');
        resultEl.className = 'result-block';
        resultsEl.appendChild(resultEl);
      }
      updateResult(resultEl, '⚠️ Не удалось получить результат: ' + err.message);
      finishResults();
    });
}

function finishResults() {
  chatStreaming = false;
  setApplyDisabled(false);
}

function updateResult(el, text) {
  if (el) el.innerHTML = formatMarkdown(text);
}

function setApplyDisabled(disabled) {
  var btn = document.getElementById('apply-btn');
  if (btn) {
    btn.disabled = disabled;
    btn.textContent = disabled ? 'Поиск…' : 'Найти программы';
  }
}

function resetFilters() {
  document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(function (cb) {
    cb.checked = false;
  });
  showToast('Фильтры сброшены');
}

function resetAll() {
  if (chatStreaming) return;
  resetFilters();
  var resultsEl = document.getElementById('chat-messages');
  if (resultsEl) {
    resultsEl.innerHTML =
      '<div class="results-placeholder" id="results-placeholder">' +
      '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
      '<rect x="4" y="6" width="22" height="28" rx="4" stroke="#CBD5E1" stroke-width="2"/>' +
      '<path d="M9 14h12M9 19h12M9 24h7" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="31" cy="12" r="6" stroke="#CBD5E1" stroke-width="2"/>' +
      '<path d="M36 17l4 4" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>' +
      '<p>Выберите фильтры выше и нажмите<br><strong>«Найти программы»</strong></p>' +
      '</div>';
  }
}

function exitChat() {
  goToScreen('mode-choice');
}

// ────────────────────────────────────────────────────────────────
// SCREEN 5 — Practice setup
// ────────────────────────────────────────────────────────────────

function toggleProgramItem(label) {
  var cb = label.querySelector('input[type="checkbox"]');
  if (!cb) return;
  // The browser toggles the checkbox value; we just sync the visual state
  setTimeout(function () {
    if (cb.checked) {
      label.classList.add('selected');
    } else {
      label.classList.remove('selected');
    }
    updateStartNegBtn();
  }, 0);
}

function togglePartnerItem(label) {
  var radio = label.querySelector('input[type="radio"]');
  if (!radio) return;
  setTimeout(function () {
    // Clear all partner items first
    document.querySelectorAll('.partner-item').forEach(function (el) {
      el.classList.remove('selected');
    });
    if (radio.checked) {
      label.classList.add('selected');
    }
    updateStartNegBtn();
  }, 0);
}

function updateStartNegBtn() {
  var btn = document.getElementById('start-negotiate-btn');
  if (!btn) return;
  var programs = getSelectedPrograms();
  var partner = getSelectedPartner();
  btn.disabled = programs.length === 0 || !partner;
}

function getSelectedPrograms() {
  return Array.from(
    document.querySelectorAll('#program-list input[type="checkbox"]:checked')
  ).map(function (cb) { return cb.value; });
}

function getSelectedPartner() {
  var radio = document.querySelector('input[name="practice-partner"]:checked');
  return radio ? radio.value : null;
}

// ────────────────────────────────────────────────────────────────
// SCREEN 6 — Negotiation chat
// ────────────────────────────────────────────────────────────────

var negotiatePrograms = [];
var negotiatePartner  = '';
var negotiateMessages = [];   // [{role, content}]
var negStreaming       = false;
var negTurnCount      = 0;    // partner reply count

function startNegotiation() {
  var programs = getSelectedPrograms();
  var partner  = getSelectedPartner();

  if (programs.length === 0) {
    showToast('Выберите хотя бы одну программу');
    return;
  }
  if (!partner) {
    showToast('Выберите тип партнёра');
    return;
  }

  negotiatePrograms = programs;
  negotiatePartner  = partner;
  negotiateMessages = [];
  negStreaming      = false;
  negTurnCount      = 0;

  // Update header
  var subEl = document.getElementById('neg-header-sub');
  if (subEl) subEl.textContent = programs.length === 1 ? programs[0] : programs.length + ' программ(ы)';

  var badgeEl = document.getElementById('neg-partner-badge');
  if (badgeEl) badgeEl.textContent = partner;

  // Clear messages
  var messagesEl = document.getElementById('negotiate-messages');
  if (messagesEl) messagesEl.innerHTML = '';

  // Reset input
  var inputEl = document.getElementById('negotiate-input');
  if (inputEl) { inputEl.value = ''; inputEl.style.height = ''; }

  goToScreen('negotiate');

  // Kick off first AI message (partner starts)
  negRequestAI();
}

function exitNegotiate() {
  goToScreen('practice-setup');
}

function negKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendNegotiationMessage();
  }
}

function autoResizeNegInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  var sendBtn = document.getElementById('neg-send-btn');
  if (sendBtn) sendBtn.disabled = negStreaming || el.value.trim() === '';
}

function sendNegotiationMessage() {
  if (negStreaming) return;
  var inputEl = document.getElementById('negotiate-input');
  if (!inputEl) return;
  var text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  inputEl.style.height = '';
  var sendBtn = document.getElementById('neg-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Append user message to UI
  appendNegMessage('user', text);

  // Add to history
  negotiateMessages.push({ role: 'user', content: text });

  // Request AI response
  negRequestAI();
}

function negRequestAI() {
  negStreaming = true;
  var sendBtn = document.getElementById('neg-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Show typing indicator
  var messagesEl = document.getElementById('negotiate-messages');
  var typingEl = document.createElement('div');
  typingEl.className = 'neg-msg neg-msg--partner';
  typingEl.id = 'neg-typing';
  typingEl.innerHTML =
    '<div class="neg-msg-label">Партнёр</div>' +
    '<div class="chat-typing" style="margin:0">' +
    '<div class="chat-typing-dot"></div>' +
    '<div class="chat-typing-dot"></div>' +
    '<div class="chat-typing-dot"></div>' +
    '</div>';
  if (messagesEl) {
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  fetch(NEGOTIATE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: negotiateMessages,
      programs: negotiatePrograms,
      partner:  negotiatePartner,
    }),
  })
    .then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    })
    .then(function (payload) {
      // Remove typing indicator
      var t = document.getElementById('neg-typing');
      if (t && t.parentNode) t.parentNode.removeChild(t);

      if (!payload.ok || payload.data.error) {
        appendNegMessage('partner', '⚠️ ' + (payload.data.error || 'Ошибка сервера'));
      } else {
        var content = payload.data.result || '';
        // Detect feedback turn (contains score marker)
        var isFeedback = /(\d\/10|оценка|итог|обратная связь)/i.test(content);
        negTurnCount++;
        appendNegMessage('partner', content, isFeedback);
        negotiateMessages.push({ role: 'assistant', content: content });

        // If feedback delivered — disable input
        if (isFeedback) {
          negFinish(true);
          return;
        }
      }
      negFinish(false);
    })
    .catch(function (err) {
      var t = document.getElementById('neg-typing');
      if (t && t.parentNode) t.parentNode.removeChild(t);
      appendNegMessage('partner', '⚠️ Ошибка соединения: ' + err.message);
      negFinish(false);
    });
}

function negFinish(feedbackGiven) {
  negStreaming = false;
  var sendBtn = document.getElementById('neg-send-btn');
  var inputEl = document.getElementById('negotiate-input');
  if (feedbackGiven) {
    // Lock the input after feedback
    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) { inputEl.disabled = true; inputEl.placeholder = 'Тренировка завершена'; }
  } else {
    if (sendBtn) sendBtn.disabled = !inputEl || inputEl.value.trim() === '';
    if (inputEl) inputEl.focus();
  }
}

function appendNegMessage(role, text, isFeedback) {
  var messagesEl = document.getElementById('negotiate-messages');
  if (!messagesEl) return;

  var wrapper = document.createElement('div');
  wrapper.className = 'neg-msg neg-msg--' + (role === 'user' ? 'user' : 'partner') + (isFeedback ? ' neg-msg--feedback' : '');

  var label = document.createElement('div');
  label.className = 'neg-msg-label';
  label.textContent = role === 'user' ? 'Вы' : 'Партнёр';

  var bubble = document.createElement('div');
  bubble.className = 'neg-msg-bubble';
  bubble.innerHTML = formatMarkdown(text);

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ────────────────────────────────────────────────────────────────
// Markdown formatter (bold, italic, br)
// ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatLine(line) {
  var s = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(?!\*)(.+?)\*(?!\*)/g, '<em>$1</em>');
  s = s.replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

function formatMarkdown(text) {
  if (!text) return '';
  var lines = text.split('\n');
  var out = lines.map(function(line) {
    var gdMatch = line.match(/^ONE-PAGER:\s*(https:\/\/drive\.google\.com\/file\/d\/([^\/\s]+))/);
    if (gdMatch) {
      var url = gdMatch[1];
      var fileId = gdMatch[2];
      var thumb = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w900';
      return 'ONE-PAGER: <a href="' + escHtml(url) + '/view?usp=sharing" target="_blank" rel="noopener noreferrer">'
        + '<img src="' + thumb + '" alt="One-pager" class="onepager-img" /></a>';
    }
    return formatLine(line);
  });
  return out.join('<br>');
}

// ────────────────────────────────────────────────────────────────
// Toast
// ────────────────────────────────────────────────────────────────

var toastTimer = null;

function showToast(message, duration) {
  var el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer !== null) { clearTimeout(toastTimer); toastTimer = null; }
  el.textContent = message;
  el.classList.add('visible');
  toastTimer = setTimeout(function () {
    el.classList.remove('visible');
    toastTimer = null;
  }, duration || 2500);
}

// ────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  goToScreen('welcome');
});
