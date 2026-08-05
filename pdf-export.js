/* Fillable-PDF export.
 *
 * Browser "Save as PDF" always produces a flat page — it cannot emit form
 * fields. To hand over a PDF that can still be typed into, this fills the
 * AcroForm fields of the original Ayers PDF (kept blank in
 * assets/ayers-form-template.pdf) and leaves them editable.
 *
 * The template has fixed capacity: 5 properties, one current plus one previous
 * job per applicant, and 4 investment-property expense lines. Anything beyond
 * that cannot be represented, so it is reported to the user rather than
 * silently dropped.
 */

(function () {
  'use strict';

  var TEMPLATE = 'assets/ayers-form-template.pdf';
  var CAP = { properties: 5, jobsPerApplicant: 2, investments: 4 };

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function val(name) {
    var el = document.querySelector('[name="' + name.replace(/(["\\])/g, '\\$1') + '"]');
    if (!el) { return ''; }
    if (el.type === 'checkbox') { return el.checked; }
    return el.value || '';
  }

  function num(v) {
    var n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function fmt(n) {
    return n ? n.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : '';
  }

  function jobCards(applicant) {
    return $$('[data-emp-list="' + applicant + '"] [data-emp-card]');
  }

  function isCurrent(card) {
    var cb = $('[data-current]', card);
    return !!(cb && cb.checked);
  }

  /* Build { webFieldName: value } for everything the template can hold. */
  function gather() {
    var out = {};
    var overflow = [];

    // Straight one-to-one fields.
    Object.keys(window.AYERS_PDF_MAP).forEach(function (web) {
      var el = document.querySelector('[name="' + web.replace(/(["\\])/g, '\\$1') + '"]');
      if (el) { out[web] = el.type === 'checkbox' ? el.checked : el.value; }
    });

    // Read-only totals are excluded from the form's own serialisation, so take
    // them straight off the page.
    ['general_total', 'additional_total', 'total_living_expenses'].forEach(function (k) {
      out[k] = val(k);
    });

    [1, 2].forEach(function (a) {
      var p = 'a' + a + '_';
      var cards = jobCards(a);
      var current = cards.filter(isCurrent);
      var previous = cards.filter(function (c) { return !isCurrent(c); });

      function cardIndex(card) { return card.getAttribute('data-emp-index'); }

      // Current employment -> the template's "current" block.
      if (current[0]) {
        var ci = cardIndex(current[0]);
        out[p + 'emp_cur_employer'] = val(p + 'emp_' + ci + '_employer_name');
        out[p + 'emp_cur_job']      = val(p + 'emp_' + ci + '_job_title');
        out[p + 'emp_cur_address']  = val(p + 'emp_' + ci + '_employer_address');
        out[p + 'emp_cur_start']    = val(p + 'emp_' + ci + '_commencement_date');
        out[p + 'emp_cur_contact']  = val(p + 'emp_' + ci + '_contact_number');
        ['full_time', 'casual', 'part_time', 'self_employed', 'contractor'].forEach(function (s) {
          out[p + 'emp_status_' + s] = val(p + 'emp_' + ci + '_status_' + s);
        });
      }

      // First previous employer -> the template's "previous" block.
      if (previous[0]) {
        var pi = cardIndex(previous[0]);
        out[p + 'emp_prev_employer'] = val(p + 'emp_' + pi + '_employer_name');
        out[p + 'emp_prev_job']      = val(p + 'emp_' + pi + '_job_title');
        out[p + 'emp_prev_address']  = val(p + 'emp_' + pi + '_employer_address');
        out[p + 'emp_prev_from']     = val(p + 'emp_' + pi + '_commencement_date');
        out[p + 'emp_prev_to']       = val(p + 'emp_' + pi + '_end_date');
      }

      if (cards.length > CAP.jobsPerApplicant) {
        overflow.push((cards.length - CAP.jobsPerApplicant) + ' job' +
          (cards.length - CAP.jobsPerApplicant === 1 ? '' : 's') + ' for applicant ' + a);
      }

      // The template has one income row per applicant, so total the jobs.
      var totals = { base: 0, overtime: 0, commission: 0, others: 0 };
      cards.forEach(function (card) {
        var i = cardIndex(card);
        Object.keys(totals).forEach(function (k) {
          totals[k] += num(val(p + 'income_' + i + '_' + k));
        });
      });
      var grand = totals.base + totals.overtime + totals.commission + totals.others;
      out[p + 'income_base']       = fmt(totals.base);
      out[p + 'income_overtime']   = fmt(totals.overtime);
      out[p + 'income_commission'] = fmt(totals.commission);
      out[p + 'income_others']     = fmt(totals.others);
      out[p + 'income_total']      = fmt(grand);
    });

    var props = $$('[data-property-row]').length;
    if (props > CAP.properties) { overflow.push((props - CAP.properties) + ' propert' + (props - CAP.properties === 1 ? 'y' : 'ies')); }

    var invs = $$('[data-inv-row]').length;
    if (invs > CAP.investments) { overflow.push((invs - CAP.investments) + ' investment property expense line' + (invs - CAP.investments === 1 ? '' : 's')); }

    return { values: out, overflow: overflow };
  }

  function selectOption(field, wanted) {
    var opts = field.getOptions();
    var want = String(wanted).trim().toLowerCase();
    for (var i = 0; i < opts.length; i++) {
      if (String(opts[i]).trim().toLowerCase() === want) { field.select(opts[i]); return true; }
    }
    return false;
  }

  async function buildPdf() {
    var res = await fetch(TEMPLATE);
    if (!res.ok) { throw new Error('Could not load the PDF template (' + res.status + ')'); }
    var bytes = await res.arrayBuffer();

    var doc = await PDFLib.PDFDocument.load(bytes);
    var form = doc.getForm();
    var gathered = gather();
    var map = window.AYERS_PDF_MAP;

    Object.keys(gathered.values).forEach(function (web) {
      var pdfName = map[web];
      if (!pdfName) { return; }
      var v = gathered.values[web];
      if (v === '' || v === false || v === undefined || v === null) { return; }

      var field;
      try { field = form.getField(pdfName); } catch (e) { return; }

      try {
        if (field instanceof PDFLib.PDFCheckBox) {
          if (v) { field.check(); }
        } else if (field instanceof PDFLib.PDFDropdown || field instanceof PDFLib.PDFOptionList) {
          selectOption(field, v);
        } else if (field instanceof PDFLib.PDFRadioGroup) {
          field.select(String(v));
        } else if (field.setText) {
          field.setText(String(v));
        }
      } catch (e) { /* a value the field won't take; leave it blank */ }
    });

    /* Draw the appearances ourselves. Leaving it to the viewer via
       NeedAppearances alone is not enough: Preview and the browser PDF viewers
       render text fields but leave the drop-downs (Title, Citizenship, Gender,
       Marital Status) looking blank. Generating them here is still not
       flattening — every field stays editable. */
    /* Hand the drawing to the PDF viewer rather than generating appearance
       streams here.
     *
     * pdf-lib can draw them, but only in a font it embeds itself (Helvetica),
     * which loses the form's Gotham and renders smaller than the original.
     * Worse, viewers redraw drop-downs from the field value rather than from a
     * supplied stream, so a stale blank stream left Title / Citizenship /
     * Gender / Marital Status looking empty.
     *
     * Clearing the old streams and setting NeedAppearances makes the viewer
     * redraw every field from its value using the form's own /DA and /DR — the
     * original typeface, at the original size, and still fully editable. */
    var PDFName = PDFLib.PDFName;
    form.getFields().forEach(function (field) {
      // Tick boxes keep their own appearance streams — those hold the check
      // glyph and its on/off states, which a viewer will not reconstruct.
      if (field instanceof PDFLib.PDFCheckBox || field instanceof PDFLib.PDFRadioGroup) { return; }
      field.acroField.getWidgets().forEach(function (widget) {
        widget.dict.delete(PDFName.of('AP'));
      });
    });
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFLib.PDFBool.True);

    return { bytes: await doc.save({ updateFieldAppearances: false }), overflow: gathered.overflow };
  }

  window.AyersPdf = {
    download: async function (filename) {
      var built = await buildPdf();
      var blob = new Blob([built.bytes], { type: 'application/pdf' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      return built.overflow;
    }
  };
})();
