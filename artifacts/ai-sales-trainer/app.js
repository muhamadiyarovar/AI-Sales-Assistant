/**
 * ИИ-тренажёр продаж — App logic
 *
 * Screen IDs:
 *   'welcome'      → #screen-welcome     (Screen 1)
 *   'instructions' → #screen-instructions (Screen 2)
 *   'mode-choice'  → #screen-mode-choice  (Screen 3)
 *
 * Navigation is done by toggling the `.active` class on <section> elements.
 * No page reloads, no router — pure show/hide.
 */

// ────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────

/**
 * Show the requested screen and hide all others.
 * @param {string} screenId  One of: 'welcome' | 'instructions' | 'mode-choice'
 */
function goToScreen(screenId) {
  const screens = document.querySelectorAll('.screen');

  screens.forEach(function (section) {
    section.classList.remove('active');
  });

  const target = document.getElementById('screen-' + screenId);
  if (target) {
    target.classList.add('active');
    // Scroll to top so long content doesn't disorient the user
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    console.warn('[App] Unknown screen ID:', screenId);
  }
}

// ────────────────────────────────────────────────────────────────
// Mode selection (Screen 3)
// ────────────────────────────────────────────────────────────────

/**
 * Called when the user taps a mode card.
 * Shows a "coming soon" toast while the real flows are built.
 *
 * @param {'match' | 'practice'} mode
 *
 * TODO: Replace the placeholder toast with the real mode flow:
 *   - 'match'    → open the product-matching chat/filter interface
 *   - 'practice' → open the role-play practice interface
 */
function selectMode(mode) {
  // TODO: Wire up real mode flows here.
  //   if (mode === 'match')    { startMatchMode();    return; }
  //   if (mode === 'practice') { startPracticeMode(); return; }

  showToast('Скоро будет доступно');
}

// ────────────────────────────────────────────────────────────────
// Toast utility
// ────────────────────────────────────────────────────────────────

/** @type {ReturnType<typeof setTimeout> | null} */
var toastTimer = null;

/**
 * Show a brief notification at the bottom of the screen.
 * @param {string} message  Text to display
 * @param {number} [duration=2500]  Auto-hide delay in ms
 */
function showToast(message, duration) {
  var el = document.getElementById('toast');
  if (!el) return;

  // Reset any in-progress timer
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  el.textContent = message;
  el.classList.add('visible');

  toastTimer = setTimeout(function () {
    el.classList.remove('visible');
    toastTimer = null;
  }, duration || 2500);
}

// ────────────────────────────────────────────────────────────────
// Init — make sure Screen 1 is shown on load
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  goToScreen('welcome');
});
