/* ============================================================
   QuickNotes — Note Editor (Day 4)
   Live counters + draft saving + dark mode
   ============================================================ */

/* ------------------------------------------------------------
   1. Select the elements we need
   ------------------------------------------------------------ */
const textarea = document.querySelector("#note-text");
const charCountEl = document.querySelector("#char-count");
const wordCountEl = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

/* ------------------------------------------------------------
   2. Keys for localStorage
   ------------------------------------------------------------ */
const DRAFT_KEY = "quicknotes-draft";
const THEME_KEY = "quicknotes-theme";

/* ------------------------------------------------------------
   3. updateCounts()
   Updates both counters and the warning / over classes.
   ------------------------------------------------------------ */
function updateCounts() {
  const text = textarea.value;
  const charCount = text.length;

  // Count words: trim first, then split on any whitespace.
  const trimmed = text.trim();
  const wordCount = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCountEl.textContent = `${charCount} / 200 characters`;
  wordCountEl.textContent = `${wordCount} ${
    wordCount === 1 ? "word" : "words"
  }`;

  // Remove any previous state classes...
  charCountEl.classList.remove("warning", "over");

  // ...then re-apply based on the new length.
  if (charCount > 200) {
    charCountEl.classList.add("over");
  } else if (charCount > 180) {
    charCountEl.classList.add("warning");
  }
}

/* ------------------------------------------------------------
   4. clearAll()
   Empties the textarea, removes the draft, resets counters.
   ------------------------------------------------------------ */
function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

/* ------------------------------------------------------------
   5. Restore saved draft and theme on page load
   ------------------------------------------------------------ */
function restoreDraft() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved !== null) {
    textarea.value = saved;
  }
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    themeToggle.textContent = "Dark mode";
  }
}

/* ------------------------------------------------------------
   6. On every input: update counters and save the draft
   ------------------------------------------------------------ */
textarea.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, textarea.value);
});

/* ------------------------------------------------------------
   7. Escape inside the textarea clears everything
   ------------------------------------------------------------ */
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});

/* ------------------------------------------------------------
   8. Clear button
   ------------------------------------------------------------ */
clearBtn.addEventListener("click", clearAll);

/* ------------------------------------------------------------
   9. Theme toggle
   ------------------------------------------------------------ */
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

/* ------------------------------------------------------------
   10. First load: restore everything, then draw the counters once
   ------------------------------------------------------------ */
restoreDraft();
restoreTheme();
updateCounts();