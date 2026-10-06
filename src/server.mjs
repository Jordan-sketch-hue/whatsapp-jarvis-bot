/**
 * Minimal HTTP surface for the reader (Railway gives it a public URL + $PORT):
 *   GET /healthz          → liveness JSON (linked?, last event time)
 *   GET /qr?token=SECRET  → live pairing page (polls /qr.json, always shows the
 *                           current QR so a rotated/expired code is never scanned)
 *   GET /qr.json?token=…  → { linked, hasQR, dataUrl } for the page to poll
 *
 * Gated by QR_TOKEN so a public Railway URL can't be used by a stranger to pair.
 */
import http from "node:http";
import QRCode from "qrcode";

export function startServer(state) {
  const port = Number(process.env.PORT) || 8080;
  const token = process.env.QR_TOKEN?.trim();
  const authed = (u) => !token || u.searchParams.get("token") === token;

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);

    if (u.pathname === "/healthz" || u.pathname === "/") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          linked: state.linked,
          hasQR: !!state.qr,
          lastEventAt: state.lastEventAt,
          startedAt: state.startedAt,
        }),
      );
      return;
    }

    // Live QR data the page polls — always reflects the CURRENT rotating code.
    if (u.pathname === "/qr.json") {
      if (!authed(u)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "forbidden" }));
        return;
      }
      let dataUrl = null;
      if (!state.linked && state.qr) {
        dataUrl = await QRCode.toDataURL(state.qr, { margin: 2, width: 320 });
      }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ linked: state.linked, hasQR: !!state.qr, dataUrl }));
      return;
    }

    if (u.pathname === "/qr") {
      if (!authed(u)) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("Forbidden — wrong or missing ?token");
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(livePage(token ? `?token=${encodeURIComponent(token)}` : ""));
      return;
    }

    // Guarded send — the autopilot's "Angel for WhatsApp" path. Fails closed:
    // refuses unless WA_SEND_SECRET is set AND matches, and the device is linked.
    if (u.pathname === "/send" && req.method === "POST") {
      const secret = process.env.WA_SEND_SECRET?.trim();
      if (!secret || req.headers["x-send-secret"] !== secret) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "forbidden" }));
        return;
      }
      if (!state.sock || !state.linked) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "not linked" }));
        return;
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      let payload = {};
      try { payload = JSON.parse(raw || "{}"); } catch { /* keep {} */ }
      let { jid, text } = payload;
      if (!jid || !text) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "jid and text required" }));
        return;
      }
      if (!String(jid).includes("@")) {
        let d = String(jid).replace(/[^0-9]/g, "");
        if (d.length === 10) d = "1" + d; // bare NANP (Jamaica 876/658, US/CA) → +1, not +<first2digits>
        jid = `${d}@s.whatsapp.net`;
      }
      try {
        await state.sock.sendMessage(jid, { text: String(text) });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(e?.message || e) }));
      }
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  });

  server.listen(port, () => console.log(`[server] listening on :${port}`));
  return server;
}

function livePage(qs) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Link WhatsApp · Jarvis</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0c;color:#eaeaea;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{max-width:440px;text-align:center;padding:28px;background:#151517;border:1px solid #262629;border-radius:16px}
    h1{font-size:18px;margin:0 0 12px}#img{border-radius:12px;background:#fff;padding:8px;margin:8px 0;width:320px;height:320px;object-fit:contain}
    p{font-size:14px;line-height:1.5}.muted{color:#888;font-size:12px}b{color:#fff}.ok{color:#34d399;font-size:20px}
    .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:6px;animation:p 1s infinite}
    @keyframes p{50%{opacity:.3}}
  </style></head><body><div class="card">
    <h1>Link WhatsApp Business</h1>
    <p><span class="dot"></span><span id="status">Loading current code…</span></p>
    <img id="img" alt="WhatsApp QR" />
    <p class="muted">On your phone: <b>WhatsApp Business → Settings → Linked devices → Link a device</b>, then scan. This code is always live — just point and scan.</p>
  </div>
  <script>
    const qs = ${JSON.stringify(qs)};
    const img = document.getElementById('img');
    const status = document.getElementById('status');
    async function tick(){
      try{
        const r = await fetch('/qr.json'+qs, {cache:'no-store'});
        const d = await r.json();
        if(d.linked){
          status.innerHTML = '<span class="ok">✅ Linked! You can close this tab.</span>';
          img.style.display='none';
          return; // stop polling
        }
        if(d.dataUrl){ img.src = d.dataUrl; status.textContent = 'Scan this code now (it stays current)'; }
        else { status.textContent = 'Waiting for the bot to generate a code…'; }
      }catch(e){ status.textContent = 'Reconnecting…'; }
      setTimeout(tick, 2500);
    }
    tick();
  </script>
  </body></html>`;
}
