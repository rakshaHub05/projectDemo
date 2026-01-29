async function createPasteLink() {
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
  debugger;
  if (!res.ok) {
    document.getElementById("error").textContent = data.error;
    return;
  }
  document.getElementById("result").innerHTML =
    `Share the link: <a href="${data.url}" target="_blank" class="result-link">${data.url}</a>`;


}

