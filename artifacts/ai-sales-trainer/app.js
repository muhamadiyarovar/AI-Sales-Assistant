/**
 * ИИ-тренажёр продаж — App logic
 *
 * Screens:
 *   'welcome'      → #screen-welcome      (Screen 1)
 *   'instructions' → #screen-instructions  (Screen 2)
 *   'mode-choice'  → #screen-mode-choice   (Screen 3)
 *   'match'        → #screen-match         (Screen 4 — «Подобрать продукт» chat)
 *
 * Navigation: toggling `.active` class — no page reloads.
 */

// ────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────

/**
 * Show the requested screen and hide all others.
 * @param {string} screenId
 */
function goToScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });

  var target = document.getElementById('screen-' + screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    console.warn('[App] Unknown screen ID:', screenId);
  }
}

// ────────────────────────────────────────────────────────────────
// Mode selection (Screen 3)
// ────────────────────────────────────────────────────────────────

/**
 * Called when the user taps a mode card on Screen 3.
 * @param {'match' | 'practice'} mode
 */
function selectMode(mode) {
  if (mode === 'match') {
    startMatchMode();
    return;
  }

  // TODO: Wire up 'practice' mode when it's ready.
  showToast('Скоро будет доступно');
}

// ────────────────────────────────────────────────────────────────
// SCREEN 4 — «Подобрать продукт» chat
// ────────────────────────────────────────────────────────────────

/** API endpoint — goes through the shared proxy on port 80 */
var MATCH_API_URL = '/api/match';

/** Conversation history sent to the server on each turn */
var chatHistory = [];

/** True while an AI response is being streamed */
var chatStreaming = false;

/**
 * Open the match-chat screen and show a greeting if the chat is empty.
 */
function startMatchMode() {
  goToScreen('match');

  if (chatHistory.length === 0) {
    addAssistantMessage(
      'Привет! Я помогу подобрать подходящую программу.\n\n' +
      'Опишите клиента или задачу — например:\n' +
      '• аудитория (студенты, руководители, курсанты…)\n' +
      '• тема или ключевые слова (ИИ, медицина, ML…)\n' +
      '• ограничения по часам или бюджету\n\n' +
      'Можно использовать несколько фильтров сразу.'
    );
  }

  // Focus input after transition
  setTimeout(function () {
    var input = document.getElementById('chat-input');
    if (input) input.focus();
  }, 200);
}

/**
 * Send the user's message and stream the AI response.
 */
function sendMessage() {
  if (chatStreaming) return;

  var input = document.getElementById('chat-input');
  if (!input) return;

  var text = input.value.trim();
  if (!text) return;

  // Show user bubble
  addUserMessage(text);
  input.value = '';
  autoResizeTextarea(input);

  // Add to history
  chatHistory.push({ role: 'user', content: text });

  // Show typing indicator
  var typingEl = addTypingIndicator();

  // Disable send while streaming
  chatStreaming = true;
  setSendDisabled(true);

  // Stream from server
  var assistantText = '';
  var bubbleEl = null;

  fetch(MATCH_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: chatHistory }),
  })
    .then(function (res) {
      if (!res.ok) {
        throw new Error('Сервер вернул ошибку ' + res.status);
      }
      removeTypingIndicator(typingEl);
      bubbleEl = addAssistantMessage('');

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            finishStreaming(assistantText);
            return;
          }

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line

          lines.forEach(function (line) {
            if (!line.startsWith('data: ')) return;
            var raw = line.slice(6).trim();
            if (!raw) return;

            var parsed;
            try { parsed = JSON.parse(raw); } catch (_) { return; }

            if (parsed.error) {
              updateBubble(bubbleEl, '⚠️ ' + parsed.error);
              finishStreaming(null);
              return;
            }

            if (parsed.content) {
              assistantText += parsed.content;
              updateBubble(bubbleEl, assistantText);
              scrollToBottom();
            }

            if (parsed.done) {
              finishStreaming(assistantText);
            }
          });

          return pump();
        });
      }

      return pump();
    })
    .catch(function (err) {
      removeTypingIndicator(typingEl);
      if (!bubbleEl) bubbleEl = addAssistantMessage('');
      updateBubble(bubbleEl, '⚠️ Не удалось получить ответ: ' + err.message);
      finishStreaming(null);
    });
}

/**
 * Called when the stream ends. Saves the assistant message to history.
 * @param {string|null} text
 */
function finishStreaming(text) {
  chatStreaming = false;
  setSendDisabled(false);
  if (text) {
    chatHistory.push({ role: 'assistant', content: text });
  }
  scrollToBottom();
}

// ── DOM helpers ──────────────────────────────────────────────────

function addUserMessage(text) {
  var msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg--user';
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  msg.appendChild(bubble);
  getMessagesContainer().appendChild(msg);
  scrollToBottom();
}

/**
 * Add an assistant bubble and return the bubble element so it can be updated.
 * @param {string} text  Initial text (may be empty for streaming)
 * @returns {HTMLElement}
 */
function addAssistantMessage(text) {
  var msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg--assistant';
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = formatMarkdown(text);
  msg.appendChild(bubble);
  getMessagesContainer().appendChild(msg);
  scrollToBottom();
  return bubble;
}

/**
 * Replace bubble innerHTML with freshly formatted text.
 * @param {HTMLElement} bubble
 * @param {string} text
 */
function updateBubble(bubble, text) {
  if (bubble) bubble.innerHTML = formatMarkdown(text);
}

function addTypingIndicator() {
  var el = document.createElement('div');
  el.className = 'chat-typing';
  el.innerHTML = '<div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div>';
  getMessagesContainer().appendChild(el);
  scrollToBottom();
  return el;
}

function removeTypingIndicator(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function getMessagesContainer() {
  return document.getElementById('chat-messages');
}

function scrollToBottom() {
  var container = getMessagesContainer();
  if (container) container.scrollTop = container.scrollHeight;
}

function setSendDisabled(disabled) {
  var btn = document.getElementById('chat-send-btn');
  if (btn) btn.disabled = disabled;
}

// ── Minimal markdown formatter ──────────────────────────────────

/**
 * Convert a small subset of Markdown to safe HTML:
 *   **bold**, *italic*, bullet lists (- or •), numbered lists, blank-line paragraphs.
 * No external library required.
 * @param {string} text
 * @returns {string}
 */
function formatMarkdown(text) {
  if (!text) return '';

  // Escape HTML entities first
  var escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (not inside bold)
  escaped = escaped.replace(/\*(?!\*)(.+?)\*(?!\*)/g, '<em>$1</em>');

  // Newlines → <br>
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

// ────────────────────────────────────────────────────────────────
// Chat controls
// ────────────────────────────────────────────────────────────────

/** Return to mode-choice screen from the chat */
function exitChat() {
  goToScreen('mode-choice');
}

/** Wipe conversation and start fresh */
function clearChat() {
  chatHistory = [];
  var container = getMessagesContainer();
  if (container) container.innerHTML = '';
  // Re-inject greeting
  addAssistantMessage(
    'Диалог сброшен. Опишите клиента или задачу, и я подберу подходящие программы.'
  );
}

/** Send on Enter (not Shift+Enter) */
function handleChatKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

/** Grow textarea as user types */
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// ────────────────────────────────────────────────────────────────
// Toast utility
// ────────────────────────────────────────────────────────────────

/** @type {ReturnType<typeof setTimeout> | null} */
var toastTimer = null;

/**
 * Show a brief notification at the bottom of the screen.
 * @param {string} message
 * @param {number} [duration=2500]
 */
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
