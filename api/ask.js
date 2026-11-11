// How It Works — engineering explainer for curious adults (built on the Lecture Hall engine)
// v2: words and chalkboard figures are made at the same time (faster), repeat questions are
// saved on Vercel's network (instant + free), Quick vs Full depth, and mini-course outlines.
// Env: ANTHROPIC_API_KEY (required), CLAUDE_MODEL, CLAUDE_CHECK_MODEL (optional)

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const CHECK_MODEL = process.env.CLAUDE_CHECK_MODEL || "claude-haiku-5-5";
// Diagrams use the fast model, which the drawing step is tuned for. The layout rules in SYSTEM_BOARD keep labels inside boxes and off lines.
const BOARD_MODEL = process.env.BOARD_MODEL || "claude-sonnet-5-5";   // the stronger model draws the diagrams (more accurate, cleaner labels)
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
  simple: `LEVEL: EXTRA SIMPLE. 200-280 words total, still exactly the 4 sections. No jargon at all: say it the way you'd explain it to a friend over coffee, using everyday comparisons. The screen gets exactly 4 simple diagrams with few labels.`,
  quick: `LEVEL: EVERYDAY (for the average curious adult). 340-460 words total, exactly the 4 sections. Detailed but easy to follow: plain, friendly language and short sentences. Name the real parts, but every time a technical word appears, explain it right away in simple words. Use one familiar comparison in each section (like a kitchen, a car, or a garden hose). Use a number only when it helps the picture. The screen gets exactly 4 clear diagrams; use a formula only if it is very simple and truly helps.`,
  full: `LEVEL: TECH CURIOUS (for a tech-minded adult who wants the real engineering). 450-600 words total, exactly the 4 sections. Use the proper engineering terms (define each briefly the first time), real numbers and units (voltages, frequencies, pressures, speeds, efficiencies), how the parts interact, the design tradeoffs, and the limits. Still clear and well organized, never dense or academic. The screen gets exactly 4 detailed diagrams with more labels; when a real formula genuinely explains the idea (for example P = V × I, or efficiency = output ÷ input), write it on the most fitting diagram.`
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
4. "Examples in the real world": 3-5 specific, named places where this same technology or principle is working today, each with a sentence on what it does there. (Shown with a REAL-WORLD EXAMPLES map.)
Plain, engaging prose; no markdown, no bullet lists, no emojis (it is read aloud).

OTHER FIELDS (lectures only):
- "terms": 4-6 key words from the explanation (parts, terms, units), each with a one-sentence plain-English definition a curious teenager could follow.
- "surprising": a "Didja know?" fact: one fun, surprising, true fact about how it works today (1-2 sentences). Do not start it with "Didja know".
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
4. EXAMPLES IN THE REAL WORLD: the same principle in 4-6 everyday places today. Each place is a simple recognizable outline ICON drawn with a few shapes (a car = body rect + 2 wheel circles; a phone = tall rounded rect + small circle; a drone = small body + 4 rotor circles; a washing machine = square + round door), never an empty box. Put the label under each icon. Arrange them in a ring around a center label, with short straight connector lines that stop 15px before each icon and the center.

Each figure has a "title" that starts with the view name (for example "Cutaway: inside an EV motor", "Take it apart: the five main parts", "Step by step: from battery to wheels", "Real-world examples: motors all around you"), a short "caption" (under 14 words), an "svg", and a "legend".
LEGEND: list EVERY symbol, variable, unit abbreviation and math sign that appears in that figure's svg (for example V, A, kW, rpm, °C, +, −), each with a plain-English meaning. Use [] if there are none.
FORMULAS: for EVERY formula written in that figure's svg, give the "formula" exactly as written and an "explanation" in 1-2 plain sentences. Use [] if there are none.
Each svg is SVG ELEMENTS ONLY (no <svg> wrapper) on an 800 wide x 500 tall near-black monitor screen:
- Use single quotes for attribute values.
- Allowed elements: g, path, line, circle, ellipse, rect, polyline, polygon, text. Nothing else.
- Colors only: #ffffff (white), #5eead4 (teal, main structure), #7dd3fc (sky blue, moving parts), #fbbf24 (amber, energy, motion and arrows), #f472b6 (pink, highlights), #a3e635 (lime, inputs and outputs). Mostly teal, white and sky blue. Fills, if any, use fill-opacity='0.18'.
- Lines: stroke-width 2 to 4, stroke-linecap='round'. Dashed lines use stroke-dasharray='6 6'. Text: font-family='Inter' font-size 18 to 30, fill white or a color above; part labels in white.
- Clean engineering style: crisp geometry, leader lines from labels to parts, arrows for flow and motion.
- TEXT SIZE MATH: at font-size 18, each character is about 10px wide (20px font: 11px). Any box holding text must be at least (characters x 10) + 28px wide. Prefer short labels (1-3 words). Never let text run past a box edge.
- TEXT IN A BOX OR PILL: center it. For a box at y=Y with height H, put the text at y = Y + H/2 + 0.35 x font-size with text-anchor='middle' at the box's center x, and make the box at least font-size + 24 tall.
- ROWS: anything stacked vertically keeps at least 20px of empty space between rows. Never put a box or pill on top of other words. Do not crowd the bottom of the board.
- LABELS NEVER SIT ON A LINE: keep words at least 12px away from ground lines and box borders.
- LINES NEVER CROSS TEXT: leader lines end 8px before the label starts; no line may pass through any label. Put labels in clear space to the right or left of the drawing, stacked with 34px between them.
- STEP BY STEP layout: 3-6 steps in ONE clean left-to-right row (or 2 rows of 3, the second row also reading left to right). Each step: a numbered circle (r 18) above a box with a 1-3 word label, and a short caption line under the box. Straight arrows with small triangle arrowheads between boxes; arrows never cross boxes or circles.
- CUTAWAY and TAKE IT APART: draw the object as accurately as you can, with true proportions and the parts in their real places and real shapes, the way an engineering textbook shows it. Center it on the left two-thirds; labels in a neat column on the right third (x 560-780, text-anchor='start'), in the same top-to-bottom order as the parts they name so leader lines never cross each other. Each leader line runs from a small dot (r 3) ON the part to 8px short of its label. EVERY label has a leader line, and every leader line ends on the part it names.
- Every symbol, color or shape that stands for something has its own label or appears in the legend; never leave a symbol unexplained. Two labels never touch or stack closer than 34px.
- Before you finish each figure, check: is every label's line touching the right part? Does any text run past x 20 or x 780? Does any line cross any text? Fix these first.
- LAYOUT: plan every position first. Objects must not overlap; text never sits on another shape's outline; leave 20px between things; keep inside x 20-780, y 20-480. Max 40 elements per figure. Each figure stands alone (the screen is cleared between figures).

Always respond by calling the give_board tool.`;

const SYSTEM_OUTLINE = `You design short courses for curious adults about how technology works today. Given a topic, plan a 4-part mini-course that builds from the basic principle to the real engineering, with no history parts. Each part has a short "title" and a "question" the learner would ask to get that part's lecture. Give the course a clear "title". If the topic is harmful or not educational, return parts: []. Always respond by calling the give_outline tool.`;

// Live drawing: the artist writes one figure at a time in this plain format,
// and each finished figure is sent to the page right away.
const STREAM_FORMAT = `OUTPUT FORMAT (IMPORTANT): plain text only, no JSON, no tools. Write each figure as its own block, in order, exactly like this:
=== STEP
TITLE: Cutaway: the figure title
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
    ...(/haiku/i.test(model || MODEL) ? { thinking: { type: "disabled" } } : {}),
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
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, ...(/haiku/i.test(model) ? { thinking: { type: "disabled" } } : {}), messages: [{ role: "user", content: user }] })   // the stronger model refuses that setting
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
  return { title: f.TITLE.trim().replace(/^fig(ure)?\.?\s*\d+\s*[:.-]\s*/i, ""), caption: f.CAPTION.trim(), svg: cleanSvg(f.SVG.trim()),
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
  // All the figures are drawn at the same time, one call each, and sent to the page in order as soon as
  // each is ready. The detailed views (cutaway, take it apart) use the stronger model; the simpler ones
  // (step by step, real-world examples) use the fast model, so they are ready quickly.
  const VIEWS = ["Cutaway", "Take it apart", "Step by step", "Real-world examples"];
  const n = Math.min(maxSteps, 4);
  const results = new Array(n).fill(undefined); let next = 0;
  const emit = () => {
    while (next < n && results[next] !== undefined) {
      const step = results[next]; next++;
      if (!step || !step.svg) continue;
      if (kidsLimits) { step.legend = step.legend.slice(0, 8); step.formulas = step.formulas.slice(0, 3); delete step.title; }
      start(); res.write(JSON.stringify(step) + "\n"); count++;
    }
  };
  const drawOne = async k => {
    const one = `${user}\n\nDraw ONLY figure ${k + 1} of ${n}: the ${VIEWS[k]} view. Write exactly one === STEP block for it and nothing else.`;
    const model = k < 2 ? BOARD_MODEL : "claude-haiku-5-5";
    for (let attempt = 0; attempt < 2; attempt++) {
      let t = "";
      try {
        await streamClaude(SYSTEM_BOARD_STREAM, one, k < 2 ? 12000 : 6000, model, x => { t += x; });
        if (t.includes("=== NONE")) { none = true; return null; }
        const a = t.indexOf("=== STEP"), b = t.indexOf("=== END", a);
        if (a >= 0 && b > a) { const step = parseBlock(t.slice(a + 8, b)); if (step.svg) return step; }
        if (a >= 0) { const step = parseBlock(t.slice(a + 8)); if (step.svg) return step; }   // cut off before its end mark
      } catch (e) { lastErr = e; console.error("figure", k + 1, "attempt", attempt + 1, "failed:", e.message); }
    }
    return null;
  };
  await Promise.all(Array.from({ length: n }, (_, k) => drawOne(k).then(step => { results[k] = step; if (!none) emit(); })));
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

// "Explain this picture": a little more detail on each word and symbol in one figure, and why it matters.
// The page sends the figure's title, caption, the words on it and its formulas; answers are saved on Vercel's network.
const EXPLAIN_TOOL = {
  name: "give_explanations", description: "Deliver the expanded explanations for one picture.",
  input_schema: { type: "object", properties: {
    overview: { type: "string" },
    items: { type: "array", items: { type: "object", properties: { word: { type: "string" }, more: { type: "string" }, why: { type: "string" } } } },
    formulas: { type: "array", items: { type: "object", properties: { formula: { type: "string" }, more: { type: "string" }, why: { type: "string" } } } }
  }, required: ["items"] }
};
const SYSTEM_EXPLAIN = `You are a friendly, expert engineer helping a curious adult study one technical diagram from your "How It Works" lesson. They paused the lesson to understand the picture better.
Given the lecture question, the figure's title and caption, the words and symbols written on it, and its formulas:
- "overview": 1-2 sentences on what the whole figure shows and the one thing to notice first.
- "items": for each word or symbol that names something (skip filler like "Fig." or plain numbers), give "word" exactly as written, "more": 2-3 plain sentences saying what it is and how it fits in this picture, and "why": one sentence on why it matters in real life or to the big idea. Order them the way the eye reads the figure. At most 10 items; merge duplicates.
- "formulas": for each formula, "formula" exactly as written, "more": what each part stands for and what the formula says, in plain words, with a tiny worked example if it helps, and "why": one sentence on why it matters.
Be accurate. Use everyday words; when a technical term is needed, explain it. No Markdown.
If the content is not appropriate for an educational site, return items: [].`;
async function explainFigure(src, send) {
  const clip = (v, n) => String(v || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const question = clip(src.q, 300), title = clip(src.t, 160), caption = clip(src.c, 240);
  const words = clip(src.w, 900).split("|").map(x => x.trim()).filter(Boolean).slice(0, 24);
  const formulas = clip(src.f, 600).split("||").map(x => x.trim()).filter(Boolean).slice(0, 4);
  if (!words.length && !formulas.length && !title) return send(400, { error: "empty" });
  const user = `Lecture question: ${question}\nFigure title: ${title}\nCaption: ${caption}\nWords and symbols on the figure: ${words.join(" | ") || "(none)"}\nFormulas on the figure: ${formulas.join(" || ") || "(none)"}`;
  try {
    const j = await withRetry(() => callTool(SYSTEM_EXPLAIN, EXPLAIN_TOOL, user, 2500, x => Array.isArray(x.items), CHECK_MODEL), 15000);
    const items = j.items.map(i => ({ word: clip(i.word, 60), more: clip(i.more, 600), why: clip(i.why, 300) })).filter(i => i.word && i.more).slice(0, 10);
    const fx = (Array.isArray(j.formulas) ? j.formulas : []).map(i => ({ formula: clip(i.formula, 100), more: clip(i.more, 700), why: clip(i.why, 300) })).filter(i => i.formula && i.more).slice(0, 4);
    return send(200, { overview: clip(j.overview, 400), items, formulas: fx }, true);
  } catch (e) {
    return send(500, { error: "oops", reason: errorCode(e) });
  }
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
  if (src.part === "explain") return explainFigure(src, send);
  const part = ["board", "outline"].includes(src.part) ? src.part : "lecture";
  const question = String(src.q || src.question || "").trim().slice(0, 300);
  const depth = ["quick", "simple"].includes(src.depth) ? src.depth : "full";
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
      user += `\n\nThe lecture, section by section:\n${paras.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nDraw EXACTLY ${paras.length} figures, one per section, in the same order, using the 4 views in order (Cutaway, Take it apart, Step by step, Real-world examples). Figure k must illustrate section k, so the screen changes as the narrator talks. Start each title with its view name.`;
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
