// api/save.js
import fetch from "node-fetch";

/**
 * 프론트에서 JSON 바디로 받은 결과를
 * 환경변수 GS_ENDPOINT(Apps Script)로 안전하게 전달하는 프록시
 * - 같은 오리진(프론트도 Vercel)에서는 CORS 이슈 없음
 * - 다른 오리진(예: GitHub Pages)에서도 쓸 수 있게 CORS 허용
 */
export default async function handler(req, res) {
  // CORS 허용(다른 오리진에서 불러도 동작하도록)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    // Preflight 응답
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const GS = process.env.GS_ENDPOINT;
  if (!GS) {
    return res.status(500).json({ ok: false, error: "GS_ENDPOINT_MISSING" });
  }

  try {
    // Vercel API Route에서는 req.body가 파싱되어 들어옵니다.
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 필수 필드 아주 간단 체크(원하면 더 엄격히)
    const required = [
      "playerName","category","totalTimeMs",
      "perQuestionTimes","perQuestionCorrect",
      "questionWords","questionShown",
      "correctCount","wrongCount","accuracy"
    ];
    for (const k of required) {
      if (body[k] === undefined) {
        return res.status(400).json({ ok:false, error:`MISSING_${k}` });
      }
    }

    // Apps Script는 preflight를 싫어하므로 x-www-form-urlencoded로 전달
    const form = new URLSearchParams();
    form.append("payload", JSON.stringify(body));

    const resp = await fetch(GS, { method: "POST", body: form });
    const text = await resp.text(); // Apps Script가 JSON/텍스트로 줄 수 있음

    return res.status(200).json({ ok: true, gsStatus: resp.status, gsRaw: text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: String(e) });
  }
}
