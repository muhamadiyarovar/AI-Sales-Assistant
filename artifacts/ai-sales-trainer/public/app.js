/**
 * ИИ-тренажёр продаж — App logic
 *
 * Screens:
 *   'welcome'      → #screen-welcome      (Screen 1)
 *   'instructions' → #screen-instructions  (Screen 2)
 *   'mode-choice'  → #screen-mode-choice   (Screen 3)
 *   'match'        → #screen-match         (Screen 4 — фильтры + результаты)
 */

var MATCH_API_URL = '/api/match';
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
  showToast('Скоро будет доступно');
}

// ────────────────────────────────────────────────────────────────
// SCREEN 4 — Фильтры
// ────────────────────────────────────────────────────────────────

/**
 * Collect checked values from the filter panel.
 * Returns an object { audience[], hours[], keywords[], price[], format[], doctype[] }
 */
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

/**
 * Format selected filters into a readable message for the AI.
 * @returns {string|null} null when nothing is checked
 */
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

/**
 * Called when the user clicks «Найти программы».
 */
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

  // Clear previous results
  resultsEl.innerHTML = '';

  // Disable button while streaming
  setApplyDisabled(true);
  chatStreaming = true;

  // Show typing indicator
  var typingEl = document.createElement('div');
  typingEl.className = 'chat-typing';
  typingEl.innerHTML = '<div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div>';
  resultsEl.appendChild(typingEl);

  // Scroll to results
  resultsEl.scrollTop = 0;

  // Create result block that will be filled as the stream arrives
  var resultEl = null;
  var fullText = '';

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

// ────────────────────────────────────────────────────────────────
// Reset helpers
// ────────────────────────────────────────────────────────────────

/** Uncheck all filter checkboxes */
function resetFilters() {
  document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(function (cb) {
    cb.checked = false;
  });
  showToast('Фильтры сброшены');
}

/** Uncheck filters + clear results */
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

/** Go back to mode-choice */
function exitChat() {
  goToScreen('mode-choice');
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
    // ONE-PAGER with Google Drive URL → show thumbnail image
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
