// How It Works — engineering explainer for curious adults (built on the Lecture Hall engine)
// v2: words and chalkboard figures are made at the same time (faster), repeat questions are
// saved on Vercel's network (instant + free), Quick vs Full depth, and mini-course outlines.
// Env: ANTHROPIC_API_KEY (required), CLAUDE_MODEL, CLAUDE_CHECK_MODEL (optional)

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const CHECK_MODEL = process.env.CLAUDE_CHECK_MODEL || "claude-haiku-5-5";
// The drawing step uses the faster model. To switch back, add BOARD_MODEL = claude-sonnet-5-5 in Vercel settings.
const BOARD_MODEL = process.env.BOARD_MODEL || "claude-haiku-5-5";
const HOURLY_LIMIT = 30;
const hits = new Map();

// Crisis language gets a caring answer and real help, never a lecture.
const HELP_WORDS = /\b(kill myself|suicide|suicidal|end my life|hurt myself|self harm|self-harm|want to die)\b/i;
const HELP = {
  type: "help", title: "You matter",
  answer: [
    { heading: "", text: "It sounds like you might be going through something really hard. You don't have to face it alone." },
    { heading: "", text: "In the US, you can call or text 988 to reach the Suicide and Crisis Lifeline any time, day or night. If you are in immediate danger, call 911. Talking to someone you trust can help too." }
  ]
};
const DECLINE = {
  type: "decline", title: "Let's pick another topic",
  answer: [{ heading: "", text: "That's not something How It Works can explain. Ask me how a machine, gadget, building, system or technology works today, and I'll take it apart for you." }]
};
const BREAK = {
  type: "redirect", title: "Time for a short break",
  answer: [{ heading: "", text: "You've explored a lot this hour. Take a short break and come back soon to see how more things work." }]
};

const DEPTH = {
  quick: `STYLE: PLAIN ENGLISH. 170-260 words total. Everyday words, no jargon; when a technical word is unavoidable, explain it in the same sentence. Use one familiar comparison. Still exactly the 4 sections. The screen gets exactly 4 simple diagrams.`,
  full: `STYLE: DETAILED. 340-480 words total, exactly the 4 sections. Name the real parts and the real engineering, with key numbers where they help (voltages, speeds, sizes, temperatures). The screen gets exactly 4 diagrams.`
};

const SYSTEM_LECTURE = `You are a brilliant, friendly engineer who explains how things work TODAY to a curious adult, the way a great museum guide or design engineer would. You are an AI explainer; if asked, say so honestly. (A separate artist draws the diagrams on screen; you write the words.)

FOCUS: How technology, machines, buildings, systems, materials and natural forces work right now. Present day only: do NOT tell origin stories, inventors, history or "back in the day". If the question is about history, briefly redirect to how the thing works today.

SCOPE: Transportation and aviation, buildings and engineering, AI and robotics, computers and digital tech, communications and imaging, electricity and energy, engines, machines and manufacturing, logistics and supply chain, space and satellites, infrastructure and utilities, medical technology, home and consumer tech, everyday objects, physics and forces, chemistry and materials. Anything else that is a "how does it work" question about the physical or technical world is fine too.

DECIDE THE TYPE FIRST:
- "lecture": a how-it-works question. Explain it.
- "redirect": chit-chat, opinions, history-only questions, or questions that are not about how something works. One or two friendly sentences steering to a related how-it-works question.
- "decline": requests for instructions that could cause serious harm (weapons, explosives, hacking or breaking security, making drugs, defeating safety systems, dangerous chemistry), sexual content, or harassment. Brief and polite.

SAFETY: Explain how security and safety systems work at a general level only; never give steps to defeat them. MEDICAL TECHNOLOGY: explain how the device or machine works; never give personal medical advice, diagnosis or dosing; add one short line suggesting a doctor for personal health questions. CONTESTED TOPICS: facts and main viewpoints, no opinions.
ACCURACY: Well-established facts only. Say so when something varies by model or maker.

THE EXPLANATION ("answer"): EXACTLY 4 sections, in this order, with these exact headings:
1. "The short answer": what it does and the core idea in a few sentences. (Shown with a CUTAWAY view.)
2. "Take it apart": the main parts and what each one does. (Shown with an EXPLODED view of the parts.)
3. "Step by step": what happens, in order, from start to finish. Number the steps in words (first, second, then, finally). (Shown with a STEP SEQUENCE.)
4. "Where you'll find it": where this same technology or principle shows up in everyday life today. (Shown with a WHERE-IT'S-USED map.)
Plain, engaging prose; no markdown, no bullet lists, no emojis (it is read aloud).

OTHER FIELDS (lectures only):
- "terms": 3-5 key parts or terms, each with a one-sentence plain definition.
- "surprising": one surprising, true fact about how it works today (1-2 sentences).
- "misconception": one common misconception and the truth (1-2 sentences), or "".
- "image_query": 2-4 plain, literal search words for a real photo of the thing, or "" if a photo would not help.
- "deeper": exactly 3 smart follow-up how-it-works questions.

For redirect, decline: fill only type, title, answer.

Always respond by calling the give_lecture tool.`;

const SYSTEM_BOARD = `You are the diagram artist for an engineering explainer. Given a how-it-works question and the explanation's 4 sections, draw one technical diagram per section, like the screens of an engineer's design workstation.

If the question is not a legitimate how-it-works question (chit-chat, harmful instructions, sexual content), return figures: [].

THE 4 VIEWS, in this order:
1. CUTAWAY: a cross-section or see-through view of the object or system with its insides visible and the key parts labeled with leader lines.
2. TAKE IT APART: an exploded view: the main parts pulled apart along a line or arc, each one labeled, with dashed lines showing where they fit together.
3. STEP BY STEP: a numbered sequence (3-6 steps) of boxes or small sketches joined by arrows, showing what happens in order. Number each step in a circle.
4. WHERE YOU'LL FIND IT: the same principle in 3-5 everyday places today, drawn as simple outline icons (for example a car, a phone, a blender, a drone) around a center label, each with a short caption.

Each figure has a "title" that starts with the view name (for example "Cutaway: inside an EV motor", "Take it apart: the five main parts", "Step by step: from battery to wheels", "Where you'll find it: motors all around you"), a short "caption" (under 14 words), an "svg", and a "legend".
LEGEND: list EVERY symbol, variable, unit abbreviation and math sign that appears in that figure's svg (for example V, A, kW, rpm, °C, +, −), each with a plain-English meaning. Use [] if there are none.
FORMULAS: for EVERY formula written in that figure's svg, give the "formula" exactly as written and an "explanation" in 1-2 plain sentences. Use [] if there are none.
Each svg is SVG ELEMENTS ONLY (no <svg> wrapper) on an 800 wide x 500 tall near-black monitor screen:
- Use single quotes for attribute values.
- Allowed elements: g, path, line, circle, ellipse, rect, polyline, polygon, text. Nothing else.
- Colors only: #ffffff (white), #5eead4 (teal, main structure), #7dd3fc (sky blue, moving parts), #fbbf24 (amber, energy, motion and arrows), #f472b6 (pink, highlights), #a3e635 (lime, inputs and outputs). Mostly teal, white and sky blue. Fills, if any, use fill-opacity='0.18'.
- Lines: stroke-width 2 to 4, stroke-linecap='round'. Dashed lines use stroke-dasharray='6 6'. Text: font-family='Inter' font-size 18 to 30, fill white or a color above; part labels in white.
- Clean engineering style: crisp geometry, leader lines from labels to parts, arrows for flow and motion.
- LAYOUT: plan positions first. Objects must not overlap; text never sits on a shape; leave 20px between things; keep inside x 20-780, y 20-480. Max 22 elements per figure. Each figure stands alone (the screen is cleared between figures).

Always respond by calling the give_board tool.`;

const SYSTEM_OUTLINE = `You design short courses for curious adults about how technology works today. Given a topic, plan a 4-part mini-course that builds from the basic principle to the real engineering, with no history parts. Each part has a short "title" and a "question" the learner would ask to get that part's lecture. Give the course a clear "title". If the topic is harmful or not educational, return parts: []. Always respond by calling the give_outline tool.`;

// Live drawing: the artist writes one figure at a time in this plain format,
// and each finished figure is sent to the page right away.
const STREAM_FORMAT = `OUTPUT FORMAT (IMPORTANT): plain text only, no JSON, no tools. Write each figure as its own block, in order, exactly like this:
=== STEP
TITLE: Fig. 1: the figure title
CAPTION: the short caption
SVG: all of this figure's svg elements on ONE line
LEGEND: symbol | meaning ;; symbol | meaning
FORMULAS: formula | explanation ;; formula | explanation
=== END
Leave LEGEND or FORMULAS empty when there are none. Write nothing before the first block or after the last one. If the question is not appropriate, write only: === NONE`;
const SYSTEM_BOARD_STREAM = SYSTEM_BOARD.replace("Always respond by calling the give_board tool.", STREAM_FORMAT);

const LECTURE_TOOL = {
  name: "give_lecture", description: "Deliver the mini-lecture words.",
  input_schema: { type: "object", properties: {
    type: { type: "string", enum: ["lecture", "redirect", "decline"] },
    title: { type: "string" },
    answer: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, text: { type: "string" } } } },
    terms: { type: "array", items: { type: "object", properties: { word: { type: "string" }, meaning: { type: "string" } } } },
    surprising: { type: "string" }, misconception: { type: "string" }, image_query: { type: "string" },
    deeper: { type: "array", items: { type: "string" } }
  }, required: ["type", "title", "answer"] }
};
const BOARD_TOOL = {
  name: "give_board", description: "Deliver the chalkboard figures.",
  input_schema: { type: "object", properties: {
    figures: { type: "array", items: { type: "object", properties: { title: { type: "string" }, caption: { type: "string" }, svg: { type: "string" }, legend: { type: "array", items: { type: "object", properties: { symbol: { type: "string" }, meaning: { type: "string" } } } }, formulas: { type: "array", items: { type: "object", properties: { formula: { type: "string" }, explanation: { type: "string" } } } } } } }
  }, required: ["figures"] }
};
const OUTLINE_TOOL = {
  name: "give_outline", description: "Deliver the mini-course outline.",
  input_schema: { type: "object", properties: {
    title: { type: "string" },
    parts: { type: "array", items: { type: "object", properties: { title: { type: "string" }, question: { type: "string" } } } }
  }, required: ["title", "parts"] }
};

async function anthropic(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  return r.json();
}

async function callTool(system, tool, user, maxTokens, check, model) {
  const data = await anthropic({
    model: model || MODEL, max_tokens: maxTokens, system,
    tools: [tool], tool_choice: { type: "auto" },
    messages: [{ role: "user", content: user }]
  });
  if (data.stop_reason === "max_tokens") throw new Error("too_long");
  const block = (data.content || []).find(b => b.type === "tool_use");
  if (block && block.input && check(block.input)) return block.input;
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) { const j = JSON.parse(txt.slice(s, e + 1)); if (check(j)) return j; }
  throw new Error("bad_shape");
}

async function streamClaude(system, user, maxTokens, model, onText) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, thinking: { type: "disabled" }, messages: [{ role: "user", content: user }] })
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of ev.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let d; try { d = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (d.type === "content_block_delta" && d.delta && d.delta.type === "text_delta") onText(d.delta.text);
        if (d.type === "error") throw new Error("api_529 " + JSON.stringify(d.error || {}).slice(0, 120));
      }
    }
  }
}

function pairs(str, maxA, maxB, limit) {
  return String(str || "").split(";;").map(x => x.split("|")).filter(p => p.length >= 2)
    .map(p => [p[0].trim().slice(0, maxA), p.slice(1).join("|").trim().slice(0, maxB)]).filter(p => p[0] && p[1]).slice(0, limit);
}
function parseBlock(block) {
  const f = { TITLE: "", CAPTION: "", SVG: "", LEGEND: "", FORMULAS: "" }; let key = null;
  for (const raw of block.split("\n")) {
    const m = raw.match(/^\s*(TITLE|CAPTION|SVG|LEGEND|FORMULAS)\s*:\s*(.*)$/);
    if (m) { key = m[1]; f[key] = m[2]; }
    else if (key && raw.trim()) f[key] += " " + raw.trim();
  }
  return { title: f.TITLE.trim(), caption: f.CAPTION.trim(), svg: cleanSvg(f.SVG.trim()),
    legend: pairs(f.LEGEND, 20, 160, 10).map(([symbol, meaning]) => ({ symbol, meaning })),
    formulas: pairs(f.FORMULAS, 80, 400, 4).map(([formula, explanation]) => ({ formula, explanation })) };
}

// Streams drawing steps to the page as newline-separated JSON, one finished step per line.
async function streamBoard(res, isGet, user, maxSteps, kidsLimits) {
  let wrote = false, count = 0, text = "", lastErr = null, none = false;
  const start = () => {
    if (wrote) return; wrote = true;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", isGet ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    res.setHeader("X-Accel-Buffering", "no");
  };
  const flush = () => {
    if (text.includes("=== NONE")) none = true;
    let a, b;
    while ((a = text.indexOf("=== STEP")) >= 0 && (b = text.indexOf("=== END", a)) >= 0) {
      const step = parseBlock(text.slice(a + 8, b)); text = text.slice(b + 7);
      if (!step.svg || count >= maxSteps) continue;
      if (kidsLimits) { step.legend = step.legend.slice(0, 8); step.formulas = step.formulas.slice(0, 3); delete step.title; }
      start(); res.write(JSON.stringify(step) + "\n"); count++;
    }
  };
  for (let attempt = 0; attempt < 2 && !wrote && !none; attempt++) {
    text = "";
    try { await streamClaude(SYSTEM_BOARD_STREAM, user, 8000, BOARD_MODEL, t => { text += t; flush(); }); flush(); lastErr = null; }
    catch (e) { lastErr = e; console.error("drawing attempt", attempt + 1, "failed:", e.message); }
    if (wrote || none) break;
  }
  if (wrote) { res.write(JSON.stringify({ done: true }) + "\n"); return res.end(); }
  if (none || !lastErr) {
    res.setHeader("Cache-Control", isGet && none ? "public, s-maxage=2592000" : "no-store");
    return res.status(200).json({ steps: [], done: true });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(500).json({ error: "oops", reason: errorCode(lastErr) });
}

async function withRetry(fn, budgetMs) {
  const start = Date.now(); let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1 && Date.now() - start > budgetMs) break;
    try { return await fn(); }
    catch (e) { lastErr = e; console.error("attempt", attempt + 1, "failed:", e.message); }
  }
  throw lastErr || new Error("failed");
}

function errorCode(err) {
  const m = String(err && err.message || "");
  return m.startsWith("api_429") ? "R2" : m.startsWith("api_5") ? "B3" : m === "too_long" ? "L4" : m.startsWith("api_4") ? "A5" : "S6";
}

function normalize(j) {
  if (!j || !Array.isArray(j.answer)) return null;
  j.answer = j.answer.map(a => typeof a === "string" ? { heading: "", text: a } : { heading: String(a.heading || ""), text: String(a.text || "") }).filter(a => a.text);
  return j.answer.length ? j : null;
}

// The page itself only allows safe drawing shapes; this is an extra first pass.
function cleanSvg(svg) {
  let s = String(svg || "");
  ["<script", "<style", "<image", "<foreignObject", "<iframe", "<use", "javascript:", "href="].forEach(bad => {
    s = s.split(bad).join("");
  });
  return s;
}

async function safetyCheck(question, lec) {
  const text = [lec.title, ...lec.answer.map(a => a.text), lec.surprising, lec.misconception, lec.image_query].join("\n");
  const data = await anthropic({
    model: CHECK_MODEL, max_tokens: 20, thinking: { type: "disabled" },
    system: "You review content for a general-audience educational website for adults that explains how technology works. Reply with exactly one word: SAFE or UNSAFE. UNSAFE only for sexual content, step-by-step instructions that could cause serious harm (weapons, drugs, hacking, dangerous chemistry), hate or harassment, or encouragement of self-harm. Normal education about history, war, medicine, the body, science, money, politics or religion explained neutrally is SAFE.",
    messages: [{ role: "user", content: `Question: ${question}\n\nContent:\n${text}` }]
  });
  const verdict = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
  if (!verdict.trim()) { console.error("safety check gave no answer"); throw new Error("blank_verdict"); }
  // Only an explicit UNSAFE blocks; formatting like "**SAFE**" or "Safe." passes.
  const unsafe = /UNSAFE|NOT\s+SAFE/i.test(verdict);
  if (unsafe) console.error("safety check said UNSAFE for topic:", String(lec && lec.title || "").slice(0, 80));
  return !unsafe;
}

module.exports = async (req, res) => {
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  const send = (status, obj, cacheable) => {
    res.setHeader("Cache-Control", cacheable && isGet && status === 200 ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    return res.status(status).json(obj);
  };
  if (!process.env.ANTHROPIC_API_KEY) return send(500, { error: "oops", reason: "K1" });

  const src = (isGet ? req.query : req.body) || {};
  const part = ["board", "outline"].includes(src.part) ? src.part : "lecture";
  const question = String(src.q || src.question || "").trim().slice(0, 300);
  const depth = src.depth === "quick" ? "quick" : "full";
  const context = isGet ? "" : String(src.context || "").slice(0, 200);
  const more = !isGet && src.more === true;
  const prev = isGet ? "" : String(src.prev || "").slice(0, 3000);
  // the figures request carries the lecture, one section per line, so each figure matches a section
  const paras = String(src.a || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 5).map(x => x.slice(0, 900));
  // optional picture (POST only): explained, never saved
  const image = isGet ? "" : String(src.image || "");
  if (image && (image.length > 4000000 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)))) return send(400, { error: "bad_image" });
  if (!question) return send(400, { error: "empty" });

  if (HELP_WORDS.test(question)) {
    if (part === "board") return send(200, { figures: [] }, true);
    if (part === "outline") return send(200, { title: "", parts: [] }, true);
    return send(200, HELP, true);
  }

  // per-visitor limit counts lectures and course outlines (the figures ride along)
  if (part !== "board") {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
    if (recent.length >= HOURLY_LIMIT) return send(200, part === "outline" ? { title: "", parts: [], reason: "limit" } : BREAK, false);
    recent.push(now); hits.set(ip, recent);
  }

  if (part === "outline") {
    try {
      const o = await withRetry(() => callTool(SYSTEM_OUTLINE, OUTLINE_TOOL, `Topic: ${question}`, 1500, j => Array.isArray(j.parts)), 25000);
      const parts = o.parts.slice(0, 4).map(p => ({ title: String(p.title || ""), question: String(p.question || p.title || "") })).filter(p => p.question);
      return send(200, { title: String(o.title || question), parts }, true);
    } catch (e) {
      return send(500, { error: "oops", reason: errorCode(e) });
    }
  }

  let user = `${DEPTH[depth]}\n\n${context ? `We were just discussing: ${context}\n` : ""}Question: ${question}`;
  if (more) {
    user = `${DEPTH[depth]}\n\nThe learner tapped "Go deeper" on: ${context}\nHere is what was ALREADY covered:\n${prev}\n\nGo one level deeper on this same topic: finer parts, the real engineering, numbers, limits and tradeoffs. Present day only, no history. Still use the same 4 section headings. Do not repeat what was already said. Title it like "Deeper: ...".${/^go deeper on /i.test(question) ? "" : `\nThe learner specifically wants to dig into: ${question}`}`;
  }

  if (part === "board") {
    if (paras.length) {
      user += `\n\nThe lecture, section by section:\n${paras.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nDraw EXACTLY ${paras.length} figures, one per section, in the same order, using the 4 views in order (Cutaway, Take it apart, Step by step, Where you'll find it). Figure k must illustrate section k, so the screen changes as the narrator talks. Start each title with its view name.`;
    }
    return streamBoard(res, isGet, user, paras.length || 4, false);
  }

  let lec;
  const content = image ? [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
    { type: "text", text: user + `\n\nThe learner attached the image above. Identify the object, machine or system it shows and explain how it works today (or answer their question about it). In "The short answer", start by naming what is in the picture. If it is not something with a how-it-works story, use type "redirect" and suggest a related question.` }
  ] : user;
  try {
    lec = await withRetry(async () => {
      const j = normalize(await callTool(SYSTEM_LECTURE, LECTURE_TOOL, content, 4000, x => Array.isArray(x.answer)));
      if (!j) throw new Error("bad_shape");
      return j;
    }, 30000);
  } catch (e) {
    return send(500, { error: "oops", reason: errorCode(e) });
  }

  if (!["lecture", "redirect", "decline"].includes(lec.type)) lec.type = "lecture";
  if (lec.type === "decline") return send(200, DECLINE, true);

  try {
    if (lec.type === "lecture" && !(await safetyCheck(question, lec))) return send(200, DECLINE, true);
  } catch (e) {
    console.error("safety check failed:", e.message);
    return send(500, { error: "oops", reason: "C7" });
  }
  return send(200, lec, true);
};
