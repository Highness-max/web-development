/* ============================================================
   QuickNotes — Notes Toolkit (Day 3)
   All results print to the browser Console.
   ============================================================ */

/* ------------------------------------------------------------
   1. Starting data — an array of note objects
   ------------------------------------------------------------ */
let notes = [
  { id: 1, text: "Revise HTML forms", category: "study" },
  { id: 2, text: "Buy milk and bread", category: "personal" },
  { id: 3, text: "Push code to GitHub", category: "work" },
  { id: 4, text: "Practise Flexbox tonight", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

/* ------------------------------------------------------------
   2. searchNotes(word)
   Returns an array of notes whose text contains `word`,
   ignoring upper and lower case.
   ------------------------------------------------------------ */
function searchNotes(word) {
  const cleaned = word.trim().toLowerCase();
  return notes.filter((note) =>
    note.text.toLowerCase().includes(cleaned)
  );
}

/* ------------------------------------------------------------
   3. longestNote()
   Returns the note object with the most characters,
   or null if the notes array is empty.
   ------------------------------------------------------------ */
function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

/* ------------------------------------------------------------
   4. countByCategory()
   Returns an object counting notes per category.
   Example: { study: 2, personal: 2, work: 1 }
   ------------------------------------------------------------ */
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category]) {
      counts[note.category]++;
    } else {
      counts[note.category] = 1;
    }
  }
  return counts;
}

/* ------------------------------------------------------------
   5. getSummary()
   Returns a sentence like:
   "5 notes: 2 study, 2 personal, 1 work."
   Uses "note" for exactly one, "notes" otherwise.
   ------------------------------------------------------------ */
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;

  const word = total === 1 ? "note" : "notes";

  const parts = Object.keys(counts).map(
    (category) => `${counts[category]} ${category}`
  );

  return `${total} ${word}: ${parts.join(", ")}.`;
}

/* ------------------------------------------------------------
   6. isDuplicate(text)
   Returns true if a note with the same text already exists,
   ignoring case and extra spaces.
   ------------------------------------------------------------ */
function isDuplicate(text) {
  const cleaned = text.trim().toLowerCase();
  return notes.some(
    (note) => note.text.trim().toLowerCase() === cleaned
  );
}

/* ------------------------------------------------------------
   7. addNote(text, category)
   Adds a note only if:
     - text length after trimming is 1–200 characters
     - it is not a duplicate
     - category is one of: personal, work, study
   Returns true when added, false otherwise,
   logging the reason when rejected.
   ------------------------------------------------------------ */
function addNote(text, category) {
  const cleaned = text.trim();
  const validCategories = ["personal", "work", "study"];

  if (cleaned.length === 0) {
    console.log("❌ Rejected: note cannot be empty.");
    return false;
  }

  if (cleaned.length > 200) {
    console.log("❌ Rejected: note must be 200 characters or fewer.");
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log(
      `❌ Rejected: category must be one of ${validCategories.join(", ")}.`
    );
    return false;
  }

  if (isDuplicate(cleaned)) {
    console.log(`❌ Rejected: "${cleaned}" already exists.`);
    return false;
  }

  notes.push({
    id: Date.now(),
    text: cleaned,
    category: category,
  });
  console.log(`✅ Added: "${cleaned}" [${category}]`);
  return true;
}

/* ============================================================
   TESTS — each console.log shows the expected output in a comment
   ============================================================ */

console.log("=== searchNotes ===");
console.log(searchNotes("html"));
// Expected: [ { id: 1, text: "Revise HTML forms", category: "study" } ]

console.log(searchNotes("BUY"));
// Expected: [ { id: 2, text: "Buy milk and bread", category: "personal" } ]

console.log(searchNotes("javascript"));
// Expected: []   (nothing matches)

console.log("=== longestNote ===");
console.log(longestNote());
// Expected: { id: 4, text: "Practise Flexbox tonight", category: "study" }

console.log("=== countByCategory ===");
console.log(countByCategory());
// Expected: { study: 2, personal: 2, work: 1 }

console.log("=== getSummary ===");
console.log(getSummary());
// Expected: "5 notes: 2 study, 2 personal, 1 work."

console.log("=== isDuplicate ===");
console.log(isDuplicate("Buy milk and bread"));
// Expected: true

console.log(isDuplicate("   BUY MILK AND BREAD   "));
// Expected: true  (case and extra spaces are ignored)

console.log(isDuplicate("Something brand new"));
// Expected: false

console.log("=== addNote ===");
console.log(addNote("Learn JavaScript arrays", "study"));
// Expected: ✅ Added message, then true

console.log(addNote("Learn JavaScript arrays", "study"));
// Expected: ❌ Rejected duplicate message, then false

console.log(addNote("", "work"));
// Expected: ❌ Rejected empty message, then false

console.log(addNote("A very long note", "holiday"));
// Expected: ❌ Rejected category message, then false

console.log(addNote("Plan the week", "personal"));
// Expected: ✅ Added message, then true

console.log("=== After adding notes ===");
console.log(getSummary());
// Expected: "7 notes: 3 study, 3 personal, 1 work."