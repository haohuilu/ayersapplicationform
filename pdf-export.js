/* Build a completed, still-editable PDF from the live web form.
 *
 * Neither earlier approach was good enough:
 *
 *   - Filling the original Ayers PDF kept the exact design but was capped by
 *     its fixed rows, so extra people, jobs, properties and assets fell off.
 *   - Screenshotting the page with html2canvas kept everything but produced a
 *     bitmap: soft text, nothing selectable, and a much larger file.
 *
 * So this walks the rendered DOM and redraws it into the PDF as vector — real
 * text, rectangles and lines — with an AcroForm field placed over every input
 * so the result can still be typed into afterwards. Whatever is on screen is
 * what comes out, however many entries have been added.
 */

(function () {
  'use strict';

  var A4_W = 595.276, A4_H = 841.89;
  var MARGIN_X = 31.18;        // 11 mm
  var MARGIN_TOP = 28.35;      // 10 mm
  var MARGIN_BOTTOM = 22.68;   //  8 mm

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Typed values are capped at this CSS size before scaling to the page.
     On screen an input is 12px — deliberately larger than its 10.5px label,
     because that is what you type into. On paper the same contrast reads
     heavy, so values are brought down to the label size. Raise this if the
     filled text should stand out more. */
  var VALUE_FONT_PX = 10.5;

  /* ------------------------------------------------------------------ */
  /* Reading the page                                                    */
  /* ------------------------------------------------------------------ */

  function colour(css) {
    var m = /rgba?\(([^)]+)\)/.exec(css || '');
    if (!m) { return null; }
    var p = m[1].split(',').map(parseFloat);
    if (p.length > 3 && p[3] === 0) { return null; }        // fully transparent
    return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255 };
  }

  function rgb(c) { return PDFLib.rgb(c.r, c.g, c.b); }

  function isHidden(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 ||
        el.hasAttribute('hidden') || (el.classList && el.classList.contains('no-print'))) {
      return true;
    }
    // Screen-reader-only text (the income column labels, the table's "Remove")
    // is hidden by clipping it to nothing rather than by display, and would
    // otherwise be drawn on top of the visible headings.
    if (cs.clip && cs.clip !== 'auto' && /rect\(\s*0(px)?[,\s]/.test(cs.clip)) { return true; }
    if (cs.clipPath && /inset\(\s*(50%|100%)/.test(cs.clipPath)) { return true; }
    return false;
  }

  /* Measure text where the browser actually put it.
   *
   * Using the parent element's box instead was wrong twice over: a tick label
   * starts to the right of its checkbox, not at the element's left edge, and a
   * <br> produces two lines that must not be run together. Ranges over the
   * text node give the true rectangle of every rendered line. */
  function textLines(node) {
    var text = node.nodeValue;
    if (!text || !text.trim()) { return []; }

    var range = document.createRange();
    var lines = [];
    var current = null;
    var i = 0;

    while (i < text.length) {
      if (/\s/.test(text[i])) { i++; continue; }
      var start = i;
      while (i < text.length && !/\s/.test(text[i])) { i++; }

      range.setStart(node, start);
      range.setEnd(node, i);
      var r = range.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }

      if (current && Math.abs(r.top - current.top) < 1.5) {
        current.text += ' ' + text.slice(start, i);
        current.right = r.right;
      } else {
        if (current) { lines.push(current); }
        current = { text: text.slice(start, i), left: r.left, top: r.top,
                    bottom: r.bottom, right: r.right, height: r.height };
      }
    }
    if (current) { lines.push(current); }
    return lines;
  }

  function collect(sheet) {
    var box = sheet.getBoundingClientRect();
    var cs0 = getComputedStyle(sheet);
    var padL = parseFloat(cs0.paddingLeft) || 0;
    var padT = parseFloat(cs0.paddingTop) || 0;
    var padR = parseFloat(cs0.paddingRight) || 0;
    var originX = box.left + padL;
    var originY = box.top + padT;

    var items = [];
    $$('*', sheet).forEach(function (el) {
      var cs = getComputedStyle(el);
      if (isHidden(el, cs)) { return; }
      for (var p = el.parentElement; p && p !== sheet.parentElement; p = p.parentElement) {
        if (isHidden(p, getComputedStyle(p))) { return; }
      }

      var r = el.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) { return; }
      if (r.width <= 1.5 && r.height <= 1.5) { return; }   // 1px sr-only boxes
      var base = { x: r.left - originX, y: r.top - originY, w: r.width, h: r.height };
      var tag = el.tagName.toLowerCase();

      if (tag === 'img') { items.push({ kind: 'logo', box: base }); return; }

      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        items.push({ kind: 'field', box: base, el: el, tag: tag,
                     type: (el.type || '').toLowerCase(),
                     padL: parseFloat(cs.paddingLeft) || 0,
                     fontSize: parseFloat(cs.fontSize) || 12,
                     bg: colour(cs.backgroundColor) || { r: 0.867, g: 0.871, b: 0.863 },
                     ink: colour(cs.color) || { r: 0.25, g: 0.25, b: 0.26 } });
        return;
      }

      var bg = colour(cs.backgroundColor);
      if (bg) { items.push({ kind: 'rect', box: base, fill: bg }); }

      ['Top', 'Right', 'Bottom', 'Left'].forEach(function (side) {
        var w = parseFloat(cs['border' + side + 'Width']) || 0;
        var c = colour(cs['border' + side + 'Color']);
        if (w > 0 && c && cs['border' + side + 'Style'] !== 'none') {
          items.push({ kind: 'border', box: base, side: side.toLowerCase(), width: w, fill: c });
        }
      });

      var size = parseFloat(cs.fontSize) || 12;
      var bold = (parseInt(cs.fontWeight, 10) || 400) >= 600;
      var ink = colour(cs.color) || { r: 0, g: 0, b: 0 };
      var upper = cs.textTransform === 'uppercase';

      for (var n = 0; n < el.childNodes.length; n++) {
        if (el.childNodes[n].nodeType !== 3) { continue; }
        textLines(el.childNodes[n]).forEach(function (line) {
          items.push({
            kind: 'text',
            box: { x: line.left - originX, y: line.top - originY,
                   w: line.right - line.left, h: line.height },
            text: upper ? line.text.toUpperCase() : line.text,
            size: size, bold: bold, fill: ink
          });
        });
      }
    });

    items.sort(function (a, b) { return (a.box.y - b.box.y) || (a.box.x - b.box.x); });
    return { items: items, contentW: box.width - padL - padR };
  }

  /* ------------------------------------------------------------------ */
  /* Laying it onto A4                                                   */
  /* ------------------------------------------------------------------ */

  /* Break between items, never through one, so a field or table row is never
     sliced in half by a page edge. */
  function paginate(items, pageH) {
    var pages = [], current = [], top = 0;
    items.forEach(function (it) {
      if (current.length && (it.box.y + it.box.h) - top > pageH) {
        pages.push({ top: top, items: current });
        top = it.box.y;
        current = [];
      }
      current.push(it);
    });
    if (current.length) { pages.push({ top: top, items: current }); }
    return pages;
  }

  function wrap(text, font, size, maxWidth) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) { return [text]; }
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (word) {
      var trial = line ? line + ' ' + word : word;
      if (!line || font.widthOfTextAtSize(trial, size) <= maxWidth) { line = trial; }
      else { lines.push(line); line = word; }
    });
    if (line) { lines.push(line); }
    return lines;
  }

  /* The standard PDF fonts are WinAnsi, so swap the typographic characters
     the form uses rather than letting a draw call throw. */
  function safeText(s) {
    return String(s)
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-').replace(/…/g, '...')
      .replace(/ /g, ' ').replace(/×/g, 'x')
      .replace(/[^\x20-\x7E\xA1-\xFF]/g, '');
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */

  function makeDrawer(ctx, page, pageTop) {
    var s = ctx.scale;
    function X(px) { return MARGIN_X + px * s; }
    function Y(py) { return ctx.pageTopPt - (py - pageTop) * s; }

    return {
      rect: function (b, fill) {
        page.drawRectangle({ x: X(b.x), y: Y(b.y + b.h),
          width: b.w * s, height: b.h * s, color: rgb(fill) });
      },
      border: function (b, side, width, fill) {
        var t = Math.max(0.3, width * s);
        var g = {
          top:    { x: b.x, y: b.y, w: b.w, h: width },
          bottom: { x: b.x, y: b.y + b.h - width, w: b.w, h: width },
          left:   { x: b.x, y: b.y, w: width, h: b.h },
          right:  { x: b.x + b.w - width, y: b.y, w: width, h: b.h }
        }[side];
        page.drawRectangle({ x: X(g.x), y: Y(g.y + g.h),
          width: Math.max(t, g.w * s), height: Math.max(t, g.h * s), color: rgb(fill) });
      },
      text: function (it) {
        var value = safeText(it.text);
        if (!value) { return; }
        var font = it.bold ? ctx.bold : ctx.font;
        var size = it.size * s;
        // the line rect is the inline box; sit the baseline inside it
        var baseline = it.box.y + (it.box.h + it.size * 0.72) / 2;
        page.drawText(value, {
          x: X(it.box.x), y: Y(baseline), size: size, font: font, color: rgb(it.fill)
        });
      },
      pos: function (b) {
        return { x: X(b.x), y: Y(b.y + b.h), width: b.w * s, height: b.h * s };
      }
    };
  }

  function uniqueName(used, name) {
    var base = name || 'field', n = base, i = 2;
    while (used[n]) { n = base + '__' + (i++); }
    used[n] = true;
    return n;
  }

  function addField(ctx, page, it, place) {
    var name = uniqueName(ctx.used, it.el.name || it.el.id);
    var grey = it.bg, ink = it.ink;

    if (it.type === 'checkbox' || it.type === 'radio') {
      var cb = ctx.form.createCheckBox(name);
      if (it.el.checked) { cb.check(); }
      cb.addToPage(page, {
        x: place.x, y: place.y, width: place.width, height: place.height,
        borderWidth: 0.6, borderColor: PDFLib.rgb(0.43, 0.43, 0.44),
        backgroundColor: PDFLib.rgb(1, 1, 1)
      });
      return;
    }

    // keep the input's own left padding clear — that is where the $ sits
    var inset = it.padL * ctx.scale;
    var x = place.x + inset;
    var width = Math.max(6, place.width - inset - 1);
    var size = Math.max(4.5, Math.min(it.fontSize, VALUE_FONT_PX) * ctx.scale);

    var field;
    if (it.tag === 'select') {
      field = ctx.form.createDropdown(name);
      var opts = Array.prototype.map.call(it.el.options, function (o) { return safeText(o.value); })
        .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      if (opts.length) { field.addOptions(opts); }
      if (it.el.value) { try { field.select(safeText(it.el.value)); } catch (e) { /* not an option */ } }
    } else {
      field = ctx.form.createTextField(name);
      if (it.tag === 'textarea') { field.enableMultiline(); }
      field.setText(safeText(it.el.value || ''));
    }

    field.addToPage(page, {
      x: x, y: place.y, width: width, height: place.height,
      borderWidth: 0, backgroundColor: rgb(grey), textColor: rgb(ink), font: ctx.font
    });
    field.setFontSize(size);
    if (it.el.readOnly && field.enableReadOnly) { field.enableReadOnly(); }
  }

  /* Masthead logo, drawn from its own SVG paths so it stays vector. */
  var LOGO_VIEW = { x: 33.5, y: 58.5, w: 126.5, h: 76 };
  var logoCache = null;

  async function logoPaths() {
    if (logoCache) { return logoCache; }
    var svg = await (await fetch('assets/ayers-logo.svg')).text();
    var out = [], re = /<path[^>]*?fill="([^"]*)"[^>]*?d="([^"]*)"/g, m;
    while ((m = re.exec(svg))) { out.push({ fill: m[1], d: m[2] }); }
    logoCache = out;
    return out;
  }

  function drawLogo(page, place, paths) {
    if (!paths.length) { return; }
    var scale = place.width / LOGO_VIEW.w;
    paths.forEach(function (p) {
      var c = /^#[0-9a-f]{6}$/i.test(p.fill)
        ? { r: parseInt(p.fill.slice(1, 3), 16) / 255,
            g: parseInt(p.fill.slice(3, 5), 16) / 255,
            b: parseInt(p.fill.slice(5, 7), 16) / 255 }
        : { r: 0.1, g: 0.1, b: 0.1 };
      page.drawSvgPath(p.d, {
        x: place.x - LOGO_VIEW.x * scale,
        y: place.y + place.height + LOGO_VIEW.y * scale,
        scale: scale, color: rgb(c)
      });
    });
  }

  /* ------------------------------------------------------------------ */

  async function buildPdf() {
    if (!window.PDFLib) { throw new Error('The PDF library did not load. Refresh and try again.'); }
    if (document.fonts && document.fonts.ready) { await document.fonts.ready; }

    var pdf = await PDFLib.PDFDocument.create();
    var ctx = {
      form: pdf.getForm(),
      font: await pdf.embedFont(PDFLib.StandardFonts.Helvetica),
      bold: await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold),
      used: Object.create(null),
      pageTopPt: A4_H - MARGIN_TOP
    };
    pdf.setTitle(document.title || 'Ayers Loan Application');
    pdf.setAuthor('Ayers Financial Group');

    var paths = [];
    try { paths = await logoPaths(); } catch (e) { paths = []; }

    var usableW = A4_W - MARGIN_X * 2;
    var usableH = A4_H - MARGIN_TOP - MARGIN_BOTTOM;
    var pageCount = 0;

    /* Measure the web form exactly as it is on screen and scale it to the
       page width. One uniform scale keeps every font size and every gap in
       the same proportion as the browser shows them; the document simply runs
       to as many pages as the content needs.

       The only thing changed for the measurement is that the on-screen-only
       controls are taken out of the flow. Merely skipping them at draw time
       left their space behind as unexplained gaps — most visibly above the
       income details, where the "+ Add job" button sits. */
    var hide = document.createElement('style');
    hide.textContent = '.no-print { display: none !important; }';
    document.head.appendChild(hide);
    void document.body.offsetHeight;
    var sheetData;
    try {
      sheetData = $$('.sheet').map(function (sheet) { return collect(sheet); });
    } finally {
      hide.remove();
      void document.body.offsetHeight;
    }

    for (var s = 0; s < sheetData.length; s++) {
      var read = sheetData[s];
      ctx.scale = usableW / read.contentW;

      paginate(read.items, usableH / ctx.scale).forEach(function (slice) {
        var page = pdf.addPage([A4_W, A4_H]);
        pageCount++;
        var draw = makeDrawer(ctx, page, slice.top);

        // backgrounds and rules first, then everything that sits on them
        slice.items.forEach(function (it) {
          if (it.kind === 'rect') { draw.rect(it.box, it.fill); }
          else if (it.kind === 'border') { draw.border(it.box, it.side, it.width, it.fill); }
        });
        slice.items.forEach(function (it) {
          if (it.kind === 'logo') { drawLogo(page, draw.pos(it.box), paths); }
          else if (it.kind === 'text') { draw.text(it); }
          else if (it.kind === 'field') { addField(ctx, page, it, draw.pos(it.box)); }
        });
      });
    }

    ctx.form.updateFieldAppearances(ctx.font);
    return {
      bytes: await pdf.save({ updateFieldAppearances: false }),
      pages: pageCount,
      fields: ctx.form.getFields().length
    };
  }

  window.AyersPdf = {
    lastResult: null,
    download: async function (filename) {
      var built = await buildPdf();
      var blob = new Blob([built.bytes], { type: 'application/pdf' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
      window.AyersPdf.lastResult = { pages: built.pages, fields: built.fields, bytes: built.bytes.length };
      return [];   // nothing is capped any more, so nothing to report as dropped
    }
  };
})();
