/* fig-tokenizer — live BPE tokenizer over a compact illustrative merge
   table (360 merges trained on a small English + code corpus). DOM-based:
   the figure is fundamentally about text. */
'use strict';

Figures.register('fig-tokenizer', (container, kit) => {
  var level = kit.level();

  /* Merge table, in rank order (rank = priority when encoding). */
  var MERGES = [
    [' ','t'],['h','e'],[' t','he'],['r','e'],[' ','a'],['i','n'],[' ','w'],
    ['o','n'],['a','t'],[' ',' '],['n','d'],['e','r'],[' ','i'],['e','n'],
    [' a','nd'],['in','g'],['i','on'],[' t','h'],[' ','c'],['t','e'],[' ','='],
    [' t','o'],[' ','re'],['m','e'],[' ','n'],[' ','s'],['o','u'],[' ','b'],
    ['o','r'],['l','e'],[' i','s'],[' ','p'],['t','u'],['r','n'],['a','me'],
    [' ','d'],[' th','at'],['t','ion'],['a','l'],['k','en'],['tu','rn'],
    ['on','s'],['\n','  '],[' ','h'],[' h','a'],['e','l'],[' to','ken'],
    [' ','{'],['te','m'],['at','ion'],[' b','e'],[' ','}'],['c','ons'],
    [')',';'],['\n  ',' '],['T','he'],[' ','f'],[' ','o'],['v','er'],['t','h'],
    ['t','he'],[' w','e'],['c','tion'],['u','e'],[' ','in'],[' token','s'],
    [' c','ou'],[' cou','n'],[' re','turn'],['cons','t'],[' i','tem'],['_','_'],
    ['r','o'],[' ','l'],[' w','a'],[' ','The'],['c','e'],['t','t'],['u','n'],
    ['r','i'],[' ','m'],[' ','"'],[' n','ame'],['u','l'],['m','p'],[' d','o'],
    [' the','re'],['at','er'],[' w','he'],['f','un'],['fun','ction'],['e','d'],
    [' c','o'],['s','s'],['en','t'],['e','t'],['at','a'],['a','n'],['p','p'],
    [' a','re'],['te','d'],[' th','ing'],[' thing','s'],[' ','g'],[' coun','t'],
    ['k','ing'],['n','ame'],['l','o'],[' ','+'],[' re','s'],[' res','ul'],
    [' resul','t'],['v','al'],['val','ue'],[' item','s'],[' ','('],[' o','ver'],
    [' wa','s'],[' w','i'],['a','r'],['tt','er'],[' w','h'],[' ha','v'],
    [' hav','e'],['i','s'],['a','nd'],[' ','y'],[' y','ou'],['t','o'],
    [' d','ata'],['o','d'],['od','el'],[' ha','pp'],[' happ','en'],['p','u'],
    ['pu','t'],['a','re'],['g','h'],['gh','t'],['n','ing'],['a','in'],[' ','0'],
    ['re','turn'],['e','f'],[')',':'],['0','0'],[' ','q'],[' b','ro'],
    [' do','g'],[' wi','th'],[' s','t'],[' The','re'],['l','a'],[' whe','re'],
    [' we','at'],[' weat','he'],[' weathe','r'],[' be','tter'],[' w','ater'],
    [' f','or'],[' p','e'],[' pe','o'],[' peo','p'],[' peop','le'],[' be','f'],
    [' bef','o'],[' befo','re'],['f','or'],['tt','en'],['g','e'],[' in','to'],
    ['x','t'],[' w','ri'],[' i','t'],[' n','u'],[' nu','m'],[' num','b'],
    [' numb','er'],[' m','odel'],[' re','a'],[' rea','d'],['e','s'],[' s','e'],
    ['I','t'],[' ','e'],[' e','ver'],['on','g'],[' c','on'],[' a','n'],
    ['s','w'],['sw','er'],[' coun','ted'],[' co','m'],[' com','m'],
    [' comm','on'],[' ','r'],[' r','are'],['i','le'],[' we','re'],['the','r'],
    ['i','r'],[' w','ou'],[' wou','l'],[' woul','d'],['al','king'],[' l','i'],
    [' g','re'],[' gre','et'],['H','el'],['Hel','lo'],['(',');'],[']',';'],
    ['le','t'],['i','f'],[' =','='],['l','en'],['len','g'],['leng','th'],
    ['e','v'],['ev','ent'],[' =','>'],[' c','ons'],['o','le'],['lo','g'],
    [' }',';'],['i','tem'],[' p','ro'],[' pro','ce'],[' proce','ss'],
    ['in','put'],['d','ef'],['\n  ','  '],['\n    ','  '],['\n      ',' '],
    [' p','r'],[' pr','in'],[' prin','t'],['i','mp'],['imp','or'],['impor','t'],
    [' ','__'],['el','f'],['m','ain'],[' q','u'],[' qu','i'],[' qui','c'],
    [' quic','k'],[' bro','w'],[' brow','n'],[' f','o'],[' fo','x'],[' ','j'],
    [' j','u'],[' ju','mp'],[' jump','s'],[' l','a'],[' la','z'],[' laz','y'],
    ['the','ater'],[' n','e'],[' ne','ar'],[' st','ation'],[' p','la'],
    [' pla','ce'],[' wh','o'],[' be','en'],[' ','T'],[' T','h'],[' Th','is'],
    ['in','for'],['infor','m'],['inform','ation'],[' a','b'],[' ab','ou'],
    [' abou','t'],[' p','o'],[' po','s'],[' pos','i'],[' posi','tion'],
    [' a','tten'],[' atten','tion'],[' o','f'],[' n','ation'],[' s','i'],
    [' si','tu'],[' situ','ation'],[' ','ed'],[' ed','u'],[' edu','c'],
    [' educ','ation'],[' re','l'],[' rel','ation'],[' o','p'],[' op','er'],
    [' oper','ation'],[' d','i'],[' di','re'],[' dire','ction'],[' q','ue'],
    [' que','s'],[' ques','tion'],[' co','l'],[' col','le'],[' colle','ction'],
    ['W','he'],['Whe','n'],[' t','y'],[' ty','p'],[' typ','e'],[' ','me'],
    [' me','ss'],[' mess','a'],[' messa','ge'],[' you','r'],[' t','er'],
    [' ter','m'],[' term','in'],[' termin','al'],[' t','e'],[' te','xt'],
    [' wri','tten'],[' s','ent'],[' n','et'],[' net','w'],[' netw','or'],
    [' networ','k'],[' s','er'],[' ser','ver'],[' data','c'],[' datac','ent'],
    [' datacent','er'],[' t','u'],[' tu','rn'],[' turn','ed'],['in','to'],
    [' number','s'],[' c','an'],[' do','es'],[' n','o'],[' no','t'],[' se','e'],
    [' ','le'],[' le','tter'],[' letter','s'],[' w','or'],[' wor','d'],
    [' word','s'],[' wa','y'],[' ','It'],[' se','es'],[' ever','y'],['W','h'],
    ['Wh','at'],[' happen','s'],[' whe','n'],[' in','put'],[' l','ong'],
    [' long','er'],[' th','an'],[' con','te'],
  ];

  /* GPT-2-style pre-split: a space attaches to the word that follows it. */
  var SPLIT = / ?[A-Za-z]+| ?[0-9]+| ?[^\sA-Za-z0-9]+|\s+(?!\S)|\s+/g;

  var RANK = new Map(), IDS = new Map();
  MERGES.forEach(function (m, i) {
    RANK.set(m[0] + '\u0000' + m[1], i);
    var s = m[0] + m[1];
    if (!IDS.has(s)) IDS.set(s, 256 + i);
  });

  var encoder = new TextEncoder();

  /* Non-ASCII characters fall back to raw UTF-8 bytes; a byte symbol is
     "\u0001" + two hex digits, which can never collide with a merge. */
  function baseSymbols(chunk) {
    var syms = [];
    for (var ch of chunk) {
      if (ch.codePointAt(0) < 128) {
        syms.push(ch);
      } else {
        var bytes = encoder.encode(ch);
        for (var i = 0; i < bytes.length; i++) {
          syms.push('\u0001' + bytes[i].toString(16));
        }
      }
    }
    return syms;
  }

  function applyBPE(chunk) {
    var syms = baseSymbols(chunk);
    for (;;) {
      var bi = -1, br = Infinity;
      for (var i = 0; i < syms.length - 1; i++) {
        var r = RANK.get(syms[i] + '\u0000' + syms[i + 1]);
        if (r !== undefined && r < br) { br = r; bi = i; }
      }
      if (bi < 0) break;
      var a = syms[bi], b = syms[bi + 1], merged = a + b, out = [];
      for (var j = 0; j < syms.length; j++) {
        if (j < syms.length - 1 && syms[j] === a && syms[j + 1] === b) {
          out.push(merged); j++;
        } else {
          out.push(syms[j]);
        }
      }
      syms = out;
    }
    return syms;
  }

  function tokenize(text) {
    var toks = [], chunks = text.match(SPLIT) || [];
    for (var i = 0; i < chunks.length; i++) {
      var t = applyBPE(chunks[i]);
      for (var j = 0; j < t.length; j++) toks.push(t[j]);
    }
    return toks;
  }

  function tokenId(sym) {
    if (sym.charCodeAt(0) === 1) return parseInt(sym.slice(1), 16);
    if (sym.length === 1) return sym.charCodeAt(0);
    var id = IDS.get(sym);
    return id === undefined ? 0 : id;
  }

  function displayText(sym) {
    if (sym.charCodeAt(0) === 1) return '0x' + sym.slice(1).toUpperCase();
    return sym.replace(/ /g, '␣').replace(/\n/g, '⏎');
  }

  /* ---------- DOM ---------- */
  var PILL_COLORS = [PAL.blueSoft, PAL.orangeSoft, PAL.greenSoft,
                     PAL.purpleSoft, PAL.redSoft];

  var input = document.createElement('input');
  input.className = 'fig-input';
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Text to tokenize');
  container.appendChild(input);

  var tokArea = document.createElement('div');
  tokArea.style.cssText =
    'display:flex;flex-wrap:wrap;align-items:flex-start;gap:5px;' +
    'border:1px solid ' + PAL.grid + ';border-radius:10px;' +
    'padding:12px;margin-top:0.7rem;min-height:3.4rem;background:' + PAL.bg + ';';
  container.appendChild(tokArea);

  var stats = document.createElement('div');
  stats.style.cssText =
    'text-align:center;font-size:0.85rem;color:' + PAL.faint +
    ';margin-top:0.55rem;font-variant-numeric:tabular-nums;';
  container.appendChild(stats);

  function render() {
    var text = input.value;
    var toks = tokenize(text);
    tokArea.textContent = '';
    var nBytes = 0;
    for (var i = 0; i < toks.length; i++) {
      var sym = toks[i];
      var isByte = sym.charCodeAt(0) === 1;
      if (isByte) nBytes++;
      var isSpace = /^[\s]+$/.test(sym);
      var pill = document.createElement('span');
      /* Deep highlights byte-fallback pills so the reader can spot where
         the vocabulary bottoms out to raw UTF-8 bytes. */
      var bg = (level === 'deep' && isByte) ? PAL.redSoft
             : (isByte || isSpace) ? PAL.graySoft
                                   : PILL_COLORS[i % PILL_COLORS.length];
      var pillCss =
        'display:inline-flex;flex-direction:column;align-items:center;' +
        'border-radius:6px;padding:3px 7px 2px;font-family:' + PAL.mono + ';' +
        'background:' + bg + ';';
      if (level === 'deep' && isByte) pillCss += 'outline:1px solid ' + PAL.red + ';';
      pill.style.cssText = pillCss;
      var txt = document.createElement('span');
      txt.textContent = displayText(sym);
      txt.style.cssText = 'font-size:13px;line-height:1.3;white-space:pre;color:' +
        (isByte || isSpace ? PAL.faint : PAL.inkStrong) + ';';
      pill.appendChild(txt);
      /* Novice shows just the colored pieces — no integer ids. */
      if (level !== 'novice') {
        var id = document.createElement('span');
        id.textContent = String(tokenId(sym));
        id.style.cssText = 'font-size:11px;line-height:1.2;color:' + PAL.faint + ';';
        pill.appendChild(id);
      }
      tokArea.appendChild(pill);
    }
    var chars = Array.from(text).length;
    if (chars === 0) {
      stats.textContent = 'type something above';
    } else if (level === 'novice') {
      stats.textContent = toks.length + (toks.length === 1 ? ' piece' : ' pieces');
    } else {
      var s = toks.length + (toks.length === 1 ? ' token' : ' tokens') +
        ' · ' + chars + ' characters · ' +
        (chars / toks.length).toFixed(1) + ' characters per token';
      if (level === 'deep' && nBytes > 0) {
        s += ' · ' + nBytes +
          (nBytes === 1 ? ' byte-fallback token' : ' byte-fallback tokens');
      }
      stats.textContent = s;
    }
  }

  var controls = kit.makeControls(container);
  var PRESETS = [
    ['English', 'When you type a message, the text is turned into numbers.'],
    ['Code', 'function greet(name) { return "Hello, " + name; }'],
    ['Rare word + emoji', 'supercalifragilisticexpialidocious 🦆 café'],
  ];
  if (level === 'novice') {
    /* One control only: load a plain example sentence. */
    kit.makeButton(controls, 'Example', function () {
      input.value = PRESETS[0][1];
      render();
    });
  } else {
    PRESETS.forEach(function (p) {
      kit.makeButton(controls, p[0], function () {
        input.value = p[1];
        render();
      });
    });
  }

  input.addEventListener('input', render);
  input.value = level === 'novice' ? PRESETS[0][1]
              : level === 'deep'   ? PRESETS[2][1]
                                   : PRESETS[1][1];
  render();

  if (level === 'novice') {
    kit.caption(container,
      'Type a sentence and watch it split into tokens — the small pieces the ' +
      'model reads. Common words stay whole, and rarer words break into ' +
      'several pieces (␣ marks a space kept with its piece).');
  } else if (level === 'deep') {
    kit.caption(container,
      'A small but real byte-pair tokenizer running on your text. Common words ' +
      'and code idioms are single tokens (␣ marks an attached space) and rare ' +
      'words split into pieces. Red pills are byte-fallback tokens — anything ' +
      'beyond ASCII decomposes into raw UTF-8 bytes shown as 0xNN — and the ' +
      'readout gives the characters-per-token ratio and the byte-fallback count.');
  } else {
    kit.caption(container,
      'A small but real byte-pair tokenizer running on your text. Common words ' +
      'and code idioms are single tokens (␣ marks an attached space), rare ' +
      'words split into pieces, and anything beyond ASCII falls back to raw bytes.');
  }

  return {};
});
