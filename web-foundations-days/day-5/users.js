/* ============================================================
   QuickNotes — User Directory (Day 5)
   Fetch users from JSONPlaceholder and display them.
   ============================================================ */

/* ------------------------------------------------------------
   1. Constants
   ------------------------------------------------------------ */
const API_URL = "https://jsonplaceholder.typicode.com/users";

/* ------------------------------------------------------------
   2. Select the elements we need
   ------------------------------------------------------------ */
const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusEl = document.querySelector("#status");
const listEl = document.querySelector("#users-list");

/* ------------------------------------------------------------
   3. In-memory store of the users we fetched.
      The filter reads from this — it never makes a new request.
   ------------------------------------------------------------ */
let allUsers = [];

/* ------------------------------------------------------------
   4. renderUsers(list)
      Draws any array of users into #users-list.
      Each user shows: name, email, city, company name.
   ------------------------------------------------------------ */
function renderUsers(users) {
  // Clear the old list first.
  listEl.innerHTML = "";

  // Empty state.
  if (users.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    listEl.appendChild(li);
    return;
  }

  // One <li> per user.
  users.forEach((user) => {
    const li = document.createElement("li");

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    li.appendChild(name);
    li.appendChild(email);
    li.appendChild(city);
    li.appendChild(company);

    listEl.appendChild(li);
  });
}

/* ------------------------------------------------------------
   5. loadUsers()
      Fetches the users, handles loading / success / error,
      and stores the result in allUsers.
   ------------------------------------------------------------ */
async function loadUsers() {
  statusEl.textContent = "Loading users...";
  loadBtn.disabled = true;
  listEl.innerHTML = "";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const users = await response.json();

    allUsers = users;
    renderUsers(allUsers);

    statusEl.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    statusEl.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadBtn.disabled = false;
  }
}

/* ------------------------------------------------------------
   6. Click the button to load users
   ------------------------------------------------------------ */
loadBtn.addEventListener("click", loadUsers);

/* ------------------------------------------------------------
   7. Filter as the user types
      Filters the local allUsers array — no new request.
   ------------------------------------------------------------ */
filterInput.addEventListener("input", () => {
  const query = filterInput.value.trim().toLowerCase();

  // If the box is empty, show everyone we already have.
  if (query === "") {
    renderUsers(allUsers);
    return;
  }

  const filtered = allUsers.filter((user) =>
    user.name.toLowerCase().includes(query)
  );

  renderUsers(filtered);
});