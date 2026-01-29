require('dotenv').config()
const express = require('express')
const app = express()
import { nanoid } from 'nanoid';
app.use(express.static("public"));

app.use(express.json())
app.get("/p/:id", async (req, res) => {
  const id = req.params.id;

  const paste = await getPasteDataFromDB(id);

  if (!paste) {
    return res.status(404).send("Paste not found or expired");
  }
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <link rel="stylesheet" href="/style.css">
            <title>Paste ${id}</title>
        </head>
        <body>
        <header>
          <h1>PasteBin</h1>
        </header>
        <main>
        <div class="paste-container">
            <h2>View Paste</h2>
            <pre id="content">${paste.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
            <p>Remaining views: ${paste.remaining_views ?? "∞"}</p>
            <p>Expires at: ${paste.expires_at ?? "Never"}</p>
            </div>
             </main>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => res.send('API running'))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Running on ${PORT}`))


const pool = require('./db')
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()')
    res.json({
      message: 'Database connected',
      time: result.rows[0]
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      error: 'Database NOT connected'
    })
  }
})

app.get("/api/help", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true, db: "reachable" });
  } catch {
    res.status(200).json({ ok: false, db: "unreachable" });
  }
});

app.post("/api/pastes", async (req, res) => {
  debugger;
  const { text, end_sec, views } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Invalid text" });
  }
  if (end_sec !== undefined && (!Number.isInteger(end_sec) || end_sec < 1)) {
    return res.status(400).json({ error: "Invalid end_sec" });
  }
  if (views !== undefined && (!Number.isInteger(views) || views < 1)) {
    return res.status(400).json({ error: "Invalid views" });
  }

  const id = nanoid(10);
  const expiresAt = end_sec ? `NOW() + INTERVAL '${end_sec} seconds'` : null;

  const q = `
    INSERT INTO pastes_data (id, content, expires_at, remaining_views)
    VALUES ($1, $2, ${expiresAt || "NULL"}, $3)
  `;

  await pool.query(q, [id, text, views ?? null]);

  res.status(201).json({
    id,
    url: `${BASE_URL}/p/${id}`
  });
});

app.get("/api/pastes/:id", async (req, res) => {
  debugger;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const q = `
      SELECT * FROM pastes_data
      WHERE id = $1
      FOR UPDATE
    `;
    const { rows } = await client.query(q, [req.params.id]);
    if (!rows.length) throw "404";

    const p = rows[0];
    const now = new Date();

    if (p.expires_at && p.expires_at <= now) throw "404";
    if (p.views_left !== null && p.views_left <= 0) throw "404";

    if (p.views_left !== null) {
      await client.query(
        "UPDATE pastes_data SET remaining_views = remaining_views - 1 WHERE id = $1",
        [p.id]
      );
    }

    await client.query("COMMIT");

    res.json({
      text: p.text,
      rviews: p.views_left === null ? null : p.views_left - 1,
      expires_at: p.expires_at
    });
  } catch {
    await client.query("ROLLBACK");
    res.status(404).json({ error: "Not found" });
  } finally {
    client.release();
  }
});

app.get("/p/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM pastes_data WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) throw "404";

    const p = rows[0];
    const now = new Date();

    if (p.expires_at && p.expires_at <= now) throw "404";
    if (p.views_left !== null && p.views_left <= 0) throw "404";

    if (p.views_left !== null) {
      await client.query(
        "UPDATE pastes_data SET remaining_views = remaining_views - 1 WHERE id = $1",
        [p.id]
      );
    }

    await client.query("COMMIT");

    const safeText = p.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body><pre>${safeText}</pre></body>
      </html>
    `);
  } catch {
    await client.query("ROLLBACK");
    res.sendStatus(404);
  } finally {
    client.release();
  }
});
async function getPasteDataFromDB(id) {
  const now = new Date();

  const { rows } = await pool.query(
    `SELECT * FROM pastes_data WHERE id = $1`,
    [id]
  );

  if (!rows[0]) return null;

  const paste = rows[0];

  if (paste.expires_at && paste.expires_at < now) return null;

  if (paste.views_left !== null && paste.views_left <= 0) return null;

  if (paste.views_left !== null) {
    await pool.query(
      `UPDATE pastes_data SET remaining_views = remaining_views - 1 WHERE id = $1`,
      [id]
    );
    paste.views_left -= 1;
  }

  return paste;
}
/*app.listen(3000, () => { // remove later
  console.log("Server running on port 3001");
});*/
