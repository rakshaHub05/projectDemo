async function createPaste() {
    debugger;
  const text = document.getElementById("text").value;
  const end_sec = document.getElementById("end_sec").value;
  const views = document.getElementById("views").value;

  document.getElementById("error").textContent = "";
  document.getElementById("result").textContent = "";

  const body = { text };
  if (end_sec) body.end_sec = Number(end_sec);
  if (views) body.views = Number(views);

  const res = await fetch("/api/pastes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    document.getElementById("error").textContent = data.error;
    return;
  }

  document.getElementById("result").innerHTML =
    `Created: <a href="${data.url}" target="_blank">${data.url}</a>`;
}

/* ---------- VIEW PAGE ---------- */

async function loadPaste() {
  const id = location.pathname.split("/").pop();
  const res = await fetch(`/api/pastes/${id}`);

  if (!res.ok) {
    document.getElementById("error").textContent = "Paste unavailable";
    return;
  }

  const data = await res.json();
  document.getElementById("content").textContent = data.text;

  let meta = [];
  if (data.rviews !== null) meta.push(`Remaining views: ${data.rviews}`);
  if (data.expires_at) meta.push(`Expires: ${new Date(data.expires_at).toLocaleString()}`);
  document.getElementById("meta").textContent = meta.join(" | ");
}

if (location.pathname.startsWith("/p/")) {
  loadPaste();
}
