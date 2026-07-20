/* fig-request-json — annotated, abbreviated Messages API request body.
   DOM-based (the figure is fundamentally about text). Hover/tap a
   top-level part to highlight it and read what it does; the annotation
   box below has a fixed minimum height so the layout never jumps. */
'use strict';

Figures.register('fig-request-json', (container, kit) => {
  const C = {
    key:   PAL.blueDark,
    str:   PAL.ink,
    val:   PAL.purple,
    punct: PAL.faint,
    dim:   PAL.faint,
  };

  const PARTS = {
    headers: {
      accent: PAL.purple, soft: PAL.purpleSoft, title: 'the headers',
      text: 'These travel outside the JSON body. x-api-key (or an OAuth bearer token, for subscription sign-ins) proves who is asking and who pays; anthropic-version pins the API’s behavior to a known date so old clients keep working; content-type declares the body to be JSON.',
    },
    model: {
      accent: PAL.blue, soft: PAL.blueSoft, title: '"model"',
      text: 'The exact model that should answer, named by a dated identifier. Nothing else in the request implies a model — the string is the whole choice, and the service routes the request to a fleet serving that model.',
    },
    max_tokens: {
      accent: PAL.teal, soft: PAL.graySoft, title: '"max_tokens"',
      text: 'An upper bound on how many tokens the reply may contain — a stop condition, not a target. Generation halts when the model finishes on its own or when this ceiling is reached, whichever comes first.',
    },
    system: {
      accent: PAL.orange, soft: PAL.orangeSoft, title: '"system"',
      text: 'The system prompt: the CLI’s standing instructions about tone, tool use, safety rules, and your environment. It sits apart from the conversation and is sent again, in full, with every single request.',
    },
    messages: {
      accent: PAL.green, soft: PAL.greenSoft, title: '"messages"',
      text: 'The whole conversation, replayed from the top on every call — the API remembers nothing. Turns alternate user / assistant, and tool outputs ride inside user turns as tool_result content blocks: to the model, a shell command’s output is just something you said.',
    },
    tools: {
      accent: PAL.red, soft: PAL.redSoft, title: '"tools"',
      text: 'Every tool the model may ask for, each defined by a name, a description, and a JSON Schema for its arguments. The model never executes anything — it can only emit a request that matches one of these schemas, which the CLI then carries out.',
    },
    stream: {
      accent: PAL.yellow, soft: PAL.graySoft, title: '"stream": true',
      text: 'Asks for the reply as server-sent events over a connection held open for the whole generation, so tokens appear in your terminal as they are produced instead of after a long silence.',
    },
  };

  /* ---- panel ---- */
  const panel = document.createElement('div');
  panel.style.cssText =
    'background:' + PAL.graySoft + ';border-radius:10px;padding:0.9rem 0.6rem;' +
    'font-family:' + PAL.mono + ';font-size:0.78rem;line-height:1.65;' +
    'overflow-x:auto;color:' + PAL.ink + ';';
  container.appendChild(panel);

  function block(key) {
    const d = document.createElement('div');
    d.style.cssText =
      'border-left:3px solid transparent;border-radius:6px;' +
      'padding:0.15rem 0.5rem;cursor:pointer;';
    if (key) {
      d.dataset.key = key;
      d.tabIndex = 0;
      d.setAttribute('role', 'button');
      d.setAttribute('aria-pressed', 'false');
      d.setAttribute('aria-label', 'Explain ' + PARTS[key].title);
    } else d.style.cursor = 'default';
    panel.appendChild(d);
    return d;
  }

  function line(parent, tokens) {
    const d = document.createElement('div');
    d.style.whiteSpace = 'pre';
    for (const [text, color, italic] of tokens) {
      const s = document.createElement('span');
      s.textContent = text;
      s.style.color = color;
      if (italic) s.style.fontStyle = 'italic';
      d.appendChild(s);
    }
    parent.appendChild(d);
  }

  const k = t => [t, C.key];        // JSON key
  const p = t => [t, C.punct];      // punctuation
  const s = t => [t, C.str];        // string value
  const v = t => [t, C.val];        // number / bool
  const dim = t => [t, C.dim, true];// elision

  /* headers */
  const hdr = block('headers');
  line(hdr, [['POST', PAL.blueDark], [' /v1/messages ', C.str], ['HTTP/1.1', C.dim]]);
  line(hdr, [k('host'), p(': '), s('api.anthropic.com')]);
  line(hdr, [k('x-api-key'), p(': '), s('sk-ant-api03-'), dim('…redacted…')]);
  line(hdr, [k('anthropic-version'), p(': '), s('2023-06-01')]);
  line(hdr, [k('content-type'), p(': '), s('application/json')]);

  line(block(null), [p('{')]);

  const mdl = block('model');
  line(mdl, [k('  "model"'), p(': '), s('"claude-opus-4-20250514"'), p(',')]);

  const mx = block('max_tokens');
  line(mx, [k('  "max_tokens"'), p(': '), v('32000'), p(',')]);

  const sys = block('system');
  line(sys, [k('  "system"'), p(': '), s('"You are Claude Code…'), dim(' (≈12,000 more tokens)'), s('"'), p(',')]);

  const msgs = block('messages');
  line(msgs, [k('  "messages"'), p(': [')]);
  line(msgs, [p('    { '), k('"role"'), p(': '), s('"user"'), p(', '), k('"content"'), p(': '), s('"fix the failing test"'), p(' },')]);
  line(msgs, [p('    { '), k('"role"'), p(': '), s('"assistant"'), p(', '), k('"content"'), p(': [')]);
  line(msgs, [p('        { '), k('"type"'), p(': '), s('"tool_use"'), p(', '), k('"id"'), p(': '), s('"toolu_01…"'), p(',')]);
  line(msgs, [p('          '), k('"name"'), p(': '), s('"Read"'), p(', '), k('"input"'), p(': { '), k('"file_path"'), p(': '), s('"utils.py"'), p(' } } ] },')]);
  line(msgs, [p('    { '), k('"role"'), p(': '), s('"user"'), p(', '), k('"content"'), p(': [')]);
  line(msgs, [p('        { '), k('"type"'), p(': '), s('"tool_result"'), p(', '), k('"tool_use_id"'), p(': '), s('"toolu_01…"'), p(',')]);
  line(msgs, [p('          '), k('"content"'), p(': '), s('"1  def slugify(s):…'), dim(' (…)'), s('"'), p(' } ] }')]);
  line(msgs, [p('  ],')]);

  const tls = block('tools');
  line(tls, [k('  "tools"'), p(': [')]);
  line(tls, [p('    { '), k('"name"'), p(': '), s('"Read"'), p(', '), k('"description"'), p(': '), s('"Reads a file…"'), p(',')]);
  line(tls, [p('      '), k('"input_schema"'), p(': { '), k('"type"'), p(': '), s('"object"'), p(',')]);
  line(tls, [p('        '), k('"properties"'), p(': { '), dim('…'), p(' } } },')]);
  line(tls, [p('    { '), k('"name"'), p(': '), s('"Bash"'), p(', '), dim('…'), p(' },'), dim('  … a dozen more tools …')]);
  line(tls, [p('  ],')]);

  const str = block('stream');
  line(str, [k('  "stream"'), p(': '), v('true')]);

  line(block(null), [p('}')]);

  /* ---- annotation box (fixed min-height: no layout jumps) ---- */
  const info = document.createElement('div');
  info.style.cssText =
    'min-height:7em;margin-top:0.7rem;padding:0.7rem 0.9rem;' +
    'border-radius:8px;background:' + PAL.graySoft + ';' +
    'font-size:0.92rem;line-height:1.55;color:' + PAL.ink + ';' +
    'border-left:3px solid ' + PAL.grid + ';';
  container.appendChild(info);

  const infoTitle = document.createElement('div');
  infoTitle.style.cssText = 'font-weight:650;margin-bottom:0.2rem;color:' + PAL.inkStrong +
    ';font-family:' + PAL.mono + ';font-size:0.85rem;';
  const infoText = document.createElement('div');
  info.append(infoTitle, infoText);

  const blocks = { headers: hdr, model: mdl, max_tokens: mx, system: sys, messages: msgs, tools: tls, stream: str };
  let pinned = null;

  function show(key) {
    for (const [id, el] of Object.entries(blocks)) {
      const on = id === key;
      el.style.background = on ? PARTS[id].soft : 'transparent';
      el.style.borderLeftColor = on ? PARTS[id].accent : 'transparent';
    }
    if (key) {
      infoTitle.textContent = PARTS[key].title;
      infoText.textContent = PARTS[key].text;
      info.style.borderLeftColor = PARTS[key].accent;
    } else {
      infoTitle.textContent = '';
      infoText.textContent = 'Hover over or tap a part of the request — the headers, or any top-level field of the JSON body — to see what it does.';
      info.style.borderLeftColor = PAL.grid;
    }
  }

  function updatePressed() {
    for (const [id, el] of Object.entries(blocks)) {
      el.setAttribute('aria-pressed', String(pinned === id));
    }
  }

  function togglePin(id) {
    pinned = (pinned === id) ? null : id;
    updatePressed();
    show(pinned);
  }

  for (const [id, el] of Object.entries(blocks)) {
    el.addEventListener('pointerenter', () => show(id));
    el.addEventListener('pointerleave', () => show(pinned));
    el.addEventListener('focus', () => show(id));
    el.addEventListener('blur', () => show(pinned));
    el.addEventListener('click', () => togglePin(id));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePin(id); }
    });
  }
  show(null);

  kit.caption(container,
    'An abbreviated Messages API request. Click a section to pin its explanation. ' +
    'In a working session the system prompt, history, and tool schemas run to hundreds of kilobytes.');
});
