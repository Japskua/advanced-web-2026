// Plain browser JavaScript: no framework, no build step.
// The browser downloads this file exactly as it is written.
// From week 3 on, the front-end is written in React and TypeScript.

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const formEl = document.getElementById("createForm");
const titleEl = document.getElementById("titleInput");
const descriptionEl = document.getElementById("descriptionInput");
const errorEl = document.getElementById("error");

const STATUSES = ["open", "in progress", "done"];

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

// One helper for every API call. It sends JSON, reads the response envelope
// ({ ok: true, data } or { ok: false, error: { message } }) and throws an
// Error with the server's message when something went wrong.
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });

  // 204 No Content has no body to parse.
  if (res.status === 204) return null;

  const payload = await res.json();
  if (!res.ok || !payload.ok) {
    throw new Error(payload?.error?.message ?? `Request failed with status ${res.status}`);
  }
  return payload.data;
}

async function load() {
  try {
    showError("");
    const tasks = await api("/api/tasks");
    render(tasks);
  } catch (e) {
    showError(e.message);
  }
}

// Run an action, then reload the list. Any error is shown to the user.
async function runAndReload(action) {
  try {
    showError("");
    await action();
    await load();
  } catch (e) {
    showError(e.message);
  }
}

function renderTask(task) {
  const li = document.createElement("li");
  li.className = "item";

  // Text content. Using `textContent` (never `innerHTML`) for user data means a
  // title such as "<img src=x onerror=alert(1)>" is shown as text instead of
  // being run as HTML. That is a basic defence against XSS attacks.
  const text = document.createElement("div");
  text.className = "taskText";

  const title = document.createElement("span");
  title.className = "taskTitle";
  title.textContent = task.title;
  if (task.status === "done") title.classList.add("dim");

  const description = document.createElement("span");
  description.className = "taskDescription";
  description.textContent = task.description;

  text.append(title, description);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = task.status;

  const left = document.createElement("div");
  left.className = "left";
  left.append(text, badge);

  // Actions: change the status, delete.
  const statusSelect = document.createElement("select");
  statusSelect.className = "statusSelect";
  statusSelect.setAttribute("aria-label", `Status of ${task.title}`);
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    option.selected = task.status === status;
    statusSelect.appendChild(option);
  }

  const updateButton = document.createElement("button");
  updateButton.textContent = "Update";
  // PUT replaces every editable field, so the full task is sent, not just the status.
  updateButton.onclick = () =>
    runAndReload(() =>
      api(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          status: statusSelect.value,
        }),
      }),
    );

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete";
  deleteButton.onclick = () => runAndReload(() => api(`/api/tasks/${task.id}`, { method: "DELETE" }));

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(statusSelect, updateButton, deleteButton);

  li.append(left, actions);
  return li;
}

function render(tasks) {
  listEl.replaceChildren(...tasks.map(renderTask));
  emptyEl.hidden = tasks.length > 0;
}

formEl.addEventListener("submit", (e) => {
  // Without preventDefault the browser would submit the form the old-fashioned
  // way and reload the page.
  e.preventDefault();

  const title = titleEl.value.trim();
  const description = descriptionEl.value.trim();
  if (!title || !description) {
    showError("Both title and description are required.");
    return;
  }

  runAndReload(async () => {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    });
    titleEl.value = "";
    descriptionEl.value = "";
  });
});

load();
