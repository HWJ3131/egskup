// api/save.js — 네이티브 fetch 사용
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const GS = process.env.GS_ENDPOINT;
  if (!GS) return res.status(500).json({ ok: false, error: "GS_ENDPOINT_MISSING" });

  try {
    const raw = await readBody(req);
    let payload;
    try {
      payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      return res.status(400).json({ ok: false, error: "BAD_JSON_BODY", detail: String(e) });
    }

    // Apps Script는 x-www-form-urlencoded 방식을 더 잘 받습니다.
    const form = new URLSearchParams();
    form.append("payload", JSON.stringify(payload));

    const resp = await fetch(GS, { method: "POST", body: form });
    const text = await resp.text();

    return res.status(200).json({ ok: resp.ok, gsStatus: resp.status, gsRaw: text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "SAVE_HANDLER_ERROR", detail: String(e) });
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      return resolve(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    }
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data || "{}"));
  });
}
