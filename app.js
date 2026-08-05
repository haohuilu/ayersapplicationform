/* Ayers Loan Application - web form
   Rebuild of the printed PDF (version 3) with repeatable property and
   employment entries. No dependencies, no build step. */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STORAGE_KEY = 'ayers-loan-application-draft';   // autosaved work in progress

  /* ------------------------------------------------------------------ */
  /* Option lists (taken from the PDF drop-downs)                        */
  /* ------------------------------------------------------------------ */

  var TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr'];
  var CITIZENSHIP = ['Australian Citizen', 'Australian Permanent Resident', 'NZ Citizen',
                     'NZ Permanent Resident', 'Temporary Resident', 'Foreign Resident'];
  var GENDER = ['Male', 'Female'];
  var MARITAL = ['Single', 'De Facto', 'Married', 'Separated', 'Divorced', 'Widowed'];
  var REPAYMENT = ['P&I', 'IO'];
  var RESIDENTIAL_STATUS = [
    ['home_with_mortgage', 'Home with Mortgage'],
    ['own_home', 'Own Home'],
    ['rent_boarding', 'Rent/Boarding'],
    ['living_with_parents', 'Living with Parents/Relatives']
  ];
  var EMPLOYMENT_STATUS = [
    ['full_time', 'Full Time'],
    ['casual', 'Casual'],
    ['part_time', 'Part Time'],
    ['self_employed', 'Self-Employed'],
    ['contractor', 'Contractor']
  ];

  var GENERAL_EXPENSES = [
    ['primary_residence', 'Primary Residence'],
    ['phone_internet', 'Phone &amp; Internet'],
    ['food_groceries', 'Food &amp; Groceries'],
    ['recreation_holiday', 'Recreation &amp; Holiday'],
    ['clothing_personal_care', 'Clothing &amp; Personal Care'],
    ['medical_health', 'Medical &amp; Health'],
    ['transport', 'Transport'],
    ['education', 'Education'],
    ['childcare', 'Childcare'],
    ['general_insurance', 'General Insurance'],
    ['general_others', 'Others']
  ];

  var ADDITIONAL_EXPENSES_TOP = [
    ['strata_fees', 'Strata Fees'],
    ['private_school_fees', 'Private School Fees'],
    ['child_support', 'Child Support / Maintenance Payment'],
    ['private_health_insurance', 'Private Health Insurance']
  ];

  var ADDITIONAL_EXPENSES_BOTTOM = [
    ['boarding_rent_expenses', 'Boarding / Rent Expenses (on-going)'],
    ['additional_others', 'Others']
  ];

  var ASSETS_LEFT = [
    ['motor_vehicle_1_value', 'Motor Vehicle Value', 'money', 'motor_vehicle_1_make', 'Make', 'text'],
    ['motor_vehicle_2_value', 'Motor Vehicle Value', 'money', 'motor_vehicle_2_make', 'Make', 'text'],
    ['savings_1', 'Savings', 'money', 'savings_1_bank', 'Bank', 'text'],
    ['savings_2', 'Savings', 'money', 'savings_2_bank', 'Bank', 'text'],
    ['other_investments', 'Other investments (e.g. shares)', 'money', null, null, null],
    ['deposit_paid', 'Deposit Paid', 'money', null, null, null],
    ['non_refundable_gift', 'Non-Refundable Gift', 'money', null, null, null],
    ['home_contents', 'Home Contents', 'money', null, null, null],
    ['superannuation_1', 'Superannuation (Applicant 1)', 'money', null, null, null],
    ['superannuation_2', 'Superannuation (Applicant 2)', 'money', null, null, null]
  ];

  var ASSETS_RIGHT = [
    ['credit_card_1_limit', 'Credit Card #1 Limit', 'money', 'credit_card_1_bank', 'Bank', 'text'],
    ['credit_card_2_limit', 'Credit Card #2 Limit', 'money', 'credit_card_2_bank', 'Bank', 'text'],
    ['credit_card_3_limit', 'Credit Card #3 Limit', 'money', 'credit_card_3_bank', 'Bank', 'text'],
    ['credit_card_4_limit', 'Credit Card #4 Limit', 'money', 'credit_card_4_bank', 'Bank', 'text'],
    ['personal_loan_limit', 'Personal Loan Limit', 'money', 'personal_loan_bank', 'Bank', 'text'],
    ['car_loan_1_limit', 'Car Loan #1 Limit', 'money', 'car_loan_1_monthly', 'Per Month', 'money'],
    ['car_loan_2_limit', 'Car Loan #2 Limit', 'money', 'car_loan_2_monthly', 'Per Month', 'money'],
    ['rent_boarding_fee', 'Rent/Boarding Fee', 'money', 'rent_boarding_weekly', 'Per Week', 'money'],
    ['hecs_balance', 'HECS Balance', 'money', 'hecs_monthly', 'Per Month', 'money'],
    ['liability_others', 'Others (please specify)', 'text', null, null, null]
  ];

  /* ------------------------------------------------------------------ */
  /* Small HTML builders                                                 */
  /* ------------------------------------------------------------------ */

  function opts(list, blankLabel) {
    var out = '<option value="">' + (blankLabel || '') + '</option>';
    list.forEach(function (o) { out += '<option value="' + o + '">' + o + '</option>'; });
    return out;
  }

  function text(name, label, extra) {
    return '<div class="field"><label for="' + name + '">' + label + '</label>' +
           '<input type="text" id="' + name + '" name="' + name + '" ' + (extra || '') + '></div>';
  }

  function money(name, label) {
    return '<div class="field"><label for="' + name + '">' + label + '</label>' +
           '<div class="money"><span>$</span><input type="text" inputmode="decimal" class="amount" ' +
           'id="' + name + '" name="' + name + '"></div></div>';
  }

  function select(name, label, list) {
    return '<div class="field"><label for="' + name + '">' + label + '</label>' +
           '<select id="' + name + '" name="' + name + '">' + opts(list) + '</select></div>';
  }

  function tickList(prefix, items, group, columns) {
    var out = '<div class="ticks' + (columns === 2 ? ' two' : '') + '">';
    items.forEach(function (it) {
      var name = prefix + it[0];
      out += '<label class="tick"><input type="checkbox" name="' + name + '" data-excl="' + group + '"> ' +
             it[1] + '</label>';
    });
    return out + '</div>';
  }

  function yesNo(prefix, label, note) {
    return '<div class="tick-group-label">' + label +
           (note ? '<span class="note">' + note + '</span>' : '') + '</div>' +
           '<div class="ticks">' +
           '<label class="tick"><input type="checkbox" name="' + prefix + '_yes" data-excl="' + prefix + '"> Yes</label>' +
           '<label class="tick"><input type="checkbox" name="' + prefix + '_no" data-excl="' + prefix + '"> No</label>' +
           '</div>';
  }

  function addressBlock(prefix, label) {
    return '<div class="field addr-block">' +
      '<span class="field-label">' + label + '</span>' +
      '<input type="text" name="' + prefix + '_line1" aria-label="' + label + ' line 1">' +
      '<input type="text" name="' + prefix + '_line2" aria-label="' + label + ' line 2">' +
      '<div class="with-postcode">' +
        '<input type="text" name="' + prefix + '_suburb" aria-label="Suburb / State" placeholder="Suburb, State">' +
        '<div class="pc-wrap"><span class="pc-label">Postcode</span>' +
        '<input type="text" name="' + prefix + '_postcode" aria-label="Postcode"></div>' +
      '</div>' +
    '</div>';
  }

  function pairRow(cfg) {
    var mainName = cfg[0], mainLabel = cfg[1], mainType = cfg[2];
    var secName = cfg[3], secLabel = cfg[4], secType = cfg[5];
    var out = '<div class="pair-row"><label for="' + mainName + '">' + mainLabel + '</label>';
    out += fieldControl(mainName, mainType);
    if (secName) {
      out += '<label for="' + secName + '" class="sec">' + secLabel + '</label>' + fieldControl(secName, secType);
    } else {
      out += '<span></span><span></span>';
    }
    return out + '</div>';
  }

  function fieldControl(name, type) {
    if (type === 'money') {
      return '<div class="money"><span>$</span><input type="text" inputmode="decimal" class="amount" id="' +
             name + '" name="' + name + '"></div>';
    }
    return '<input type="text" id="' + name + '" name="' + name + '">';
  }

  /* ------------------------------------------------------------------ */
  /* Personal details                                                    */
  /* ------------------------------------------------------------------ */

  function personalBlock(n) {
    var p = 'a' + n + '_';
    return '' +
      '<div class="row r-title">' +
        select(p + 'title', 'Title', TITLES) +
        text(p + 'given_names', 'Given Name(s)') +
      '</div>' +
      text(p + 'surname', 'Surname') +
      '<div class="row r-2">' +
        text(p + 'home_phone', 'Home Phone Number') +
        text(p + 'mobile_phone', 'Mobile Phone Number') +
      '</div>' +
      '<div class="row r-2">' +
        text(p + 'work_phone', 'Work Phone Number') +
        select(p + 'citizenship', 'Citizenship', CITIZENSHIP) +
      '</div>' +
      text(p + 'email', 'Email Address') +
      '<div class="row r-3">' +
        text(p + 'date_of_birth', 'Date of Birth', 'placeholder="DD/MM/YYYY"') +
        select(p + 'gender', 'Gender', GENDER) +
        select(p + 'marital_status', 'Marital Status', MARITAL) +
      '</div>' +
      '<div class="row r-dep">' +
        '<div class="field">' +
          '<span class="field-label">Number &amp; Age of Dependents</span>' +
          '<div class="row r-2">' +
            '<input type="text" name="' + p + 'dependents_number" aria-label="Number of dependents">' +
            '<input type="text" name="' + p + 'dependents_ages" aria-label="Age of dependents">' +
          '</div>' +
        '</div>' +
        text(p + 'drivers_licence', 'Driver&rsquo;s License Number') +
      '</div>' +

      addressBlock(p + 'current_address', 'Current Residential Address') +
      '<div class="row r-2">' +
        text(p + 'current_country', 'Country') +
        text(p + 'current_moved_in', 'Date moved in (MM/YYYY)', 'placeholder="MM/YYYY"') +
      '</div>' +

      '<div class="row r-2">' +
        '<div>' +
          '<div class="tick-group-label">Current Residential Status</div>' +
          tickList(p + 'current_status_', RESIDENTIAL_STATUS, p + 'current_status') +
        '</div>' +
        '<div>' + yesNo(p + 'first_home_buyer', '1st Home Buyer') + '</div>' +
      '</div>' +

      '<div class="tick-group-label">Previous residential address' +
        '<span class="note">(complete if you have been at your current address for less than 3 years)</span></div>' +
      addressBlock(p + 'previous_address', '') +
      '<div class="row r-2">' +
        text(p + 'previous_country', 'Country') +
        text(p + 'previous_moved_in', 'Date moved in (MM/YYYY)', 'placeholder="MM/YYYY"') +
      '</div>' +

      '<div class="row r-2">' +
        '<div>' +
          '<div class="tick-group-label">Previous Residential Status</div>' +
          tickList(p + 'previous_status_', RESIDENTIAL_STATUS, p + 'previous_status') +
        '</div>' +
        '<div>' + yesNo(p + 'foreign_tax_residency', 'Foreign Tax Residency &ndash; Individual',
                        'Are you a tax resident of any country other than Australia?') + '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Employment (repeatable)                                             */
  /* ------------------------------------------------------------------ */

  function employmentCard(n, i, isCurrent) {
    var p = 'a' + n + '_emp_' + i + '_';
    return '<div class="card' + (isCurrent ? ' is-current' : '') + '" data-emp-card="' + n + '">' +
      '<div class="card-head">' +
        '<span class="card-title"></span>' +
        '<label class="tick card-current no-print">' +
          '<input type="checkbox" name="' + p + 'is_current" data-current' + (isCurrent ? ' checked' : '') +
          '> Current job</label>' +
        '<button type="button" class="btn-remove no-print" data-remove="emp" title="Remove this employment">&times;</button>' +
      '</div>' +
      '<div class="tick-group-label">Employment Status</div>' +
      tickList(p + 'status_', EMPLOYMENT_STATUS, p + 'status', 2) +
      text(p + 'employer_name', 'Employer&rsquo;s Name') +
      text(p + 'job_title', 'Job Title') +
      '<div class="field"><label for="' + p + 'employer_address">Employer&rsquo;s Address</label>' +
        '<textarea id="' + p + 'employer_address" name="' + p + 'employer_address"></textarea></div>' +
      '<div class="row emp-dates">' +
        text(p + 'commencement_date', 'Commencement Date', 'placeholder="MM/YYYY"') +
        '<div class="field emp-end-date"><label for="' + p + 'end_date">End Date</label>' +
          '<input type="text" id="' + p + 'end_date" name="' + p + 'end_date" placeholder="MM/YYYY"></div>' +
        text(p + 'contact_number', 'Employment Contact Number') +
      '</div>' +
    '</div>';
  }

  function employmentSection(n) {
    return '<div class="emp-list" data-emp-list="' + n + '"></div>' +
      '<div class="add-row no-print">' +
        '<button type="button" class="btn" data-add-emp="' + n + '">+ Add job</button>' +
      '</div>' +
      '<p class="hint no-print">Add an entry for each job, then tick <strong>Current job</strong> on any that are ' +
      'still held &mdash; an applicant can have more than one. Include previous employers if they have been with ' +
      'their current employer for less than 3 years.</p>';
  }

  /* ------------------------------------------------------------------ */
  /* Income                                                              */
  /* ------------------------------------------------------------------ */

  var INCOME_COLUMNS = [
    ['base', 'Base'],
    ['overtime', 'Overtime'],
    ['commission', 'Commission/Bonus'],
    ['others', 'Others (e.g. car allowance)']
  ];

  /* One income line per job. The lines are kept in step with the employment
     cards by syncIncome(), so adding a job adds its income row. */
  function incomeSection(n) {
    var head = '<div class="income-line income-head-line">' +
      '<span class="income-head"></span>' +
      INCOME_COLUMNS.map(function (c) { return '<span class="income-head">' + c[1] + '</span>'; }).join('') +
      '<span class="income-head">Total Income</span>' +
    '</div>';

    var totalName = 'a' + n + '_income_total';
    var foot = '<div class="income-line income-total-line" data-income-total hidden>' +
      '<span class="income-label is-total">Total Income (all jobs)</span>' +
      '<span></span><span></span><span></span><span></span>' +
      '<div class="money"><span>$</span><input type="text" id="' + totalName + '" name="' + totalName +
      '" readonly></div>' +
    '</div>';

    return '<div class="subhead spaced-sm">Applicant ' + n + ' Income Details (Annual)</div>' +
      '<div class="income-grid" data-income-list="' + n + '">' + head + foot + '</div>';
  }

  function incomeLine(n, i) {
    var p = 'a' + n + '_income_' + i + '_';
    var cells = INCOME_COLUMNS.map(function (c) {
      return '<div class="income-cell">' +
        '<label class="income-cell-label" for="' + p + c[0] + '">' + c[1] + '</label>' +
        '<div class="money"><span>$</span><input type="text" inputmode="decimal" class="amount" id="' +
        p + c[0] + '" name="' + p + c[0] + '"></div>' +
      '</div>';
    }).join('');

    return '<div class="income-line" data-income-row>' +
      '<span class="income-label"></span>' + cells +
      '<div class="income-cell">' +
        '<label class="income-cell-label" for="' + p + 'total">Total Income</label>' +
        '<div class="money"><span>$</span><input type="text" id="' + p + 'total" name="' + p +
        'total" readonly></div>' +
      '</div>' +
    '</div>';
  }

  /* Match the income lines to the employment cards, and label each line with
     the job it belongs to. */
  function syncIncome(n) {
    var grid = $('[data-income-list="' + n + '"]');
    var list = $('[data-emp-list="' + n + '"]');
    if (!grid || !list) { return; }

    var jobs = $$('[data-emp-card]', list);
    var rows = $$('[data-income-row]', grid);
    var totalLine = $('[data-income-total]', grid);

    while (rows.length < jobs.length) {
      var next = rows.length + 1;
      totalLine.insertAdjacentHTML('beforebegin', incomeLine(n, next));
      totalLine.previousElementSibling.setAttribute('data-income-index', next);
      rows = $$('[data-income-row]', grid);
    }
    while (rows.length > jobs.length) {
      rows.pop().remove();
    }

    rows.forEach(function (row, idx) {
      var card = jobs[idx];

      // Renumber by position so each line's fields stay tied to its job.
      var i = idx + 1;
      var was = row.getAttribute('data-income-index');
      if (was !== String(i)) {
        renameFields(row, 'a' + n + '_income_' + was + '_', 'a' + n + '_income_' + i + '_');
        row.setAttribute('data-income-index', i);
      }

      var title = $('.card-title', card).textContent;
      var job = (card.querySelector('[name$="job_title"]') || {}).value || '';
      var employer = (card.querySelector('[name$="employer_name"]') || {}).value || '';
      var detail = job || employer;
      var label = $('.income-label', row);
      label.textContent = detail || title;                       // the job reads better than "Previous Employment 2"
      label.title = detail ? title + ' — ' + detail : title;     // full context on hover
      row.classList.toggle('is-current', card.classList.contains('is-current'));
    });

    // With a single job the line total is the total; no need to repeat it.
    totalLine.hidden = jobs.length < 2;
    recalc();
  }

  /* ------------------------------------------------------------------ */
  /* Properties (repeatable)                                             */
  /* ------------------------------------------------------------------ */

  function propertyRow(i) {
    var p = 'property_' + i + '_';
    function cell(name, ph) {
      return '<td><input type="text" name="' + p + name + '" aria-label="' + ph + '"></td>';
    }
    function cellMoney(name, ph) {
      return '<td class="num"><input type="text" inputmode="decimal" class="amount" name="' + p + name +
             '" aria-label="' + ph + '"></td>';
    }
    return '<tr data-property-row>' +
      '<td><input type="text" name="' + p + 'address' + '" aria-label="Address of the property"></td>' +
      cell('interest_rate', 'Interest rate') +
      '<td><select name="' + p + 'repayment_type" aria-label="Repayment type">' + opts(REPAYMENT) + '</select></td>' +
      cellMoney('market_value', 'Estimated market value') +
      cellMoney('loan_limit', 'Loan limit') +
      cell('bank', 'Bank') +
      cellMoney('monthly_repayment', 'Monthly repayment') +
      cellMoney('weekly_rental', 'Weekly rental') +
      cell('owner_percent', 'Owner percent') +
      '<td class="row-tools no-print">' +
        '<button type="button" class="btn-remove" data-remove="property" title="Remove this property">&times;</button>' +
      '</td>' +
    '</tr>';
  }

  /* ------------------------------------------------------------------ */
  /* Living expenses                                                     */
  /* ------------------------------------------------------------------ */

  function expenseRow(name, label, group, removable) {
    return '<div class="exp-row"' + (removable ? ' data-inv-row' : '') + '>' +
      '<label for="' + name + '">' + label + '</label>' +
      '<div class="rm">' +
        '<div class="money" style="flex:1"><span>$</span>' +
          '<input type="text" inputmode="decimal" class="amount" data-sum="' + group + '" id="' + name +
          '" name="' + name + '"></div>' +
        (removable ? '<button type="button" class="btn-remove no-print" data-remove="inv" title="Remove">&times;</button>' : '') +
      '</div>' +
    '</div>';
  }

  function totalRow(name, label) {
    return '<div class="exp-row is-total"><label for="' + name + '">' + label + '</label>' +
      '<div class="money"><span>$</span><input type="text" id="' + name + '" name="' + name + '" readonly></div></div>';
  }

  function investmentRow(i) {
    return expenseRow('investment_property_' + i + '_expense', 'Investment Property ' + i, 'additional', true);
  }

  /* ------------------------------------------------------------------ */
  /* Numbers                                                             */
  /* ------------------------------------------------------------------ */

  function num(v) {
    if (v === null || v === undefined) { return 0; }
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function fmt(n) {
    if (!n) { return ''; }
    return n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function sumNames(names) {
    return names.reduce(function (t, name) {
      var el = document.querySelector('[name="' + name + '"]');
      return t + (el ? num(el.value) : 0);
    }, 0);
  }

  function recalc() {
    [1, 2].forEach(function (n) {
      var grid = $('[data-income-list="' + n + '"]');
      if (!grid) { return; }
      var total = 0;

      $$('[data-income-row]', grid).forEach(function (row, idx) {
        var p = 'a' + n + '_income_' + (idx + 1) + '_';
        var line = sumNames(INCOME_COLUMNS.map(function (c) { return p + c[0]; }));
        var el = document.querySelector('[name="' + p + 'total"]');
        if (el) { el.value = fmt(line); }
        total += line;
      });

      var grand = document.querySelector('[name="a' + n + '_income_total"]');
      if (grand) { grand.value = fmt(total); }
    });

    var general = 0, additional = 0;
    $$('[data-sum="general"]').forEach(function (el) { general += num(el.value); });
    $$('[data-sum="additional"]').forEach(function (el) { additional += num(el.value); });

    var g = $('#general_total'), a = $('#additional_total'), t = $('#total_living_expenses');
    if (g) { g.value = fmt(general); }
    if (a) { a.value = fmt(additional); }
    if (t) { t.value = fmt(general + additional); }
  }

  /* ------------------------------------------------------------------ */
  /* Repeatable list management                                          */
  /* ------------------------------------------------------------------ */

  function renameFields(scope, oldPrefix, newPrefix) {
    $$('[name]', scope).forEach(function (el) {
      if (el.name.indexOf(oldPrefix) === 0) {
        var next = newPrefix + el.name.slice(oldPrefix.length);
        el.name = next;
        if (el.id && el.id.indexOf(oldPrefix) === 0) {
          var oldId = el.id;
          el.id = newPrefix + oldId.slice(oldPrefix.length);
          var lab = scope.querySelector('label[for="' + cssEscape(oldId) + '"]');
          if (lab) { lab.setAttribute('for', el.id); }
        }
        if (el.hasAttribute('data-excl')) {
          var ex = el.getAttribute('data-excl');
          if (ex.indexOf(oldPrefix) === 0) { el.setAttribute('data-excl', newPrefix + ex.slice(oldPrefix.length)); }
        }
      }
    });
  }

  function cssEscape(s) { return s.replace(/(["\\])/g, '\\$1'); }

  function isCurrentCard(card) {
    var cb = $('[data-current]', card);
    return !!(cb && cb.checked);
  }

  /* Keep current jobs above previous employers, preserving the order within
     each group. Moving the nodes keeps their values — they are the same
     elements — so only the focused control needs restoring. */
  function sortEmployment(n) {
    var list = $('[data-emp-list="' + n + '"]');
    if (!list) { return; }
    var cards = $$('[data-emp-card]', list);
    var sorted = cards.filter(isCurrentCard).concat(cards.filter(function (c) { return !isCurrentCard(c); }));
    var same = sorted.every(function (c, i) { return c === cards[i]; });
    if (same) { return; }
    var focused = document.activeElement;
    sorted.forEach(function (c) { list.appendChild(c); });
    if (focused && list.contains(focused)) { focused.focus(); }
  }

  function renumberEmployment(n) {
    var list = $('[data-emp-list="' + n + '"]');
    if (!list) { return; }
    var cards = $$('[data-emp-card]', list);
    if (!cards.length) { return; }

    // A draft saved before "current job" existed, or a card the user un-ticked
    // on the only entry: fall back to treating the first entry as current.
    if (!cards.some(isCurrentCard)) {
      var first = $('[data-current]', cards[0]);
      if (first) { first.checked = true; }
    }

    var currentTotal = cards.filter(isCurrentCard).length;
    var nCurrent = 0, nPrevious = 0;

    cards.forEach(function (card, idx) {
      var i = idx + 1;
      var was = card.getAttribute('data-emp-index');
      if (was !== String(i)) {
        renameFields(card, 'a' + n + '_emp_' + was + '_', 'a' + n + '_emp_' + i + '_');
        card.setAttribute('data-emp-index', i);
      }

      var current = isCurrentCard(card);
      card.classList.toggle('is-current', current);

      var title;
      if (current) {
        nCurrent++;
        title = currentTotal > 1 ? 'Current Employment ' + nCurrent : 'Current Employment';
      } else {
        nPrevious++;
        title = 'Previous Employment ' + nPrevious;
      }
      $('.card-title', card).textContent = title;

      $('[data-remove="emp"]', card).style.visibility = cards.length > 1 ? 'visible' : 'hidden';
    });

    syncIncome(n);
  }

  /* New entries start as previous employment — the applicant ticks "Current
     job" on any they still hold, which moves the card up into that group. */
  function addEmployment(n) {
    var list = $('[data-emp-list="' + n + '"]');
    var i = $$('[data-emp-card]', list).length + 1;
    list.insertAdjacentHTML('beforeend', employmentCard(n, i, false));
    var card = list.lastElementChild;
    card.setAttribute('data-emp-index', i);
    renumberEmployment(n);
    return card;
  }

  function renumberProperties() {
    var rows = $$('[data-property-row]');
    rows.forEach(function (row, idx) {
      var i = idx + 1;
      var current = row.getAttribute('data-property-index');
      if (current !== String(i)) {
        renameFields(row, 'property_' + current + '_', 'property_' + i + '_');
        row.setAttribute('data-property-index', i);
      }
      $('[data-remove="property"]', row).style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
  }

  function addProperty() {
    var body = $('#property-rows');
    var i = $$('[data-property-row]', body).length + 1;
    body.insertAdjacentHTML('beforeend', propertyRow(i));
    body.lastElementChild.setAttribute('data-property-index', i);
    renumberProperties();
    return body.lastElementChild;
  }

  function renumberInvestments() {
    $$('[data-inv-row]').forEach(function (row, idx) {
      var i = idx + 1;
      var current = row.getAttribute('data-inv-index');
      if (current !== String(i)) {
        renameFields(row, 'investment_property_' + current + '_', 'investment_property_' + i + '_');
        row.setAttribute('data-inv-index', i);
      }
      row.querySelector('label').textContent = 'Investment Property ' + i;
    });
  }

  function addInvestmentExpense() {
    var anchor = $('#investment-expenses');
    var i = $$('[data-inv-row]').length + 1;
    anchor.insertAdjacentHTML('beforeend', investmentRow(i));
    anchor.lastElementChild.setAttribute('data-inv-index', i);
    renumberInvestments();
    return anchor.lastElementChild;
  }

  function counts() {
    return {
      properties: $$('[data-property-row]').length,
      emp1: $$('[data-emp-list="1"] [data-emp-card]').length,
      emp2: $$('[data-emp-list="2"] [data-emp-card]').length,
      investments: $$('[data-inv-row]').length
    };
  }

  function setCounts(c) {
    c = c || {};
    function grow(current, target, addFn, removeSel) {
      target = Math.max(1, target || 1);
      while (current < target) { addFn(); current++; }
      while (current > target) {
        var all = $$(removeSel);
        all[all.length - 1].remove();
        current--;
      }
    }
    grow(counts().properties, c.properties, addProperty, '[data-property-row]');
    grow(counts().emp1, c.emp1, function () { addEmployment(1); }, '[data-emp-list="1"] [data-emp-card]');
    grow(counts().emp2, c.emp2, function () { addEmployment(2); }, '[data-emp-list="2"] [data-emp-card]');

    // investments may legitimately be zero
    var invTarget = c.investments === undefined ? 4 : c.investments;
    var cur = counts().investments;
    while (cur < invTarget) { addInvestmentExpense(); cur++; }
    while (cur > invTarget) { $$('[data-inv-row]').pop().remove(); cur--; }

    renumberProperties();
    renumberEmployment(1);
    renumberEmployment(2);
    renumberInvestments();
  }

  /* ------------------------------------------------------------------ */
  /* Serialise / restore                                                 */
  /* ------------------------------------------------------------------ */

  function collect() {
    var fields = {};
    $$('#loan-form [name]').forEach(function (el) {
      if (el.type === 'checkbox') {
        if (el.checked) { fields[el.name] = true; }
      } else if (el.value !== '' && !el.readOnly) {
        fields[el.name] = el.value;
      }
    });
    return { version: 1, savedAt: new Date().toISOString(), counts: counts(), fields: fields };
  }

  /* A record is named after the applicant: "Dean Laurence Smith", or both
     names on a joint application. Returns '' when no name has been entered —
     callers ask for one rather than saving something called "Untitled". */
  function applicantName(fields) {
    fields = fields || {};
    var parts = [];
    [1, 2].forEach(function (n) {
      var given = (fields['a' + n + '_given_names'] || '').trim();
      var surname = (fields['a' + n + '_surname'] || '').trim();
      var full = [given, surname].filter(Boolean).join(' ');
      if (full) { parts.push(full); }
    });
    return parts.join(' & ');
  }

  function fileSafe(s) {
    return String(s).replace(/[^\w\s,&-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'application';
  }

  function apply(data) {
    if (!data) { return; }
    setCounts(data.counts);
    $$('#loan-form [name]').forEach(function (el) {
      if (el.type === 'checkbox') { el.checked = false; } else if (!el.readOnly) { el.value = ''; }
    });
    Object.keys(data.fields || {}).forEach(function (name) {
      var el = document.querySelector('#loan-form [name="' + cssEscape(name) + '"]');
      if (!el) { return; }
      if (el.type === 'checkbox') { el.checked = !!data.fields[name]; } else { el.value = data.fields[name]; }
    });
    [1, 2].forEach(function (n) { sortEmployment(n); renumberEmployment(n); });
    recalc();
  }

  function clearForm() {
    $('#loan-form').reset();
    setCounts({ properties: 3, emp1: 1, emp2: 1, investments: 2 });
    $$('#loan-form [name]').forEach(function (el) {
      if (el.type === 'checkbox') { el.checked = false; } else { el.value = ''; }
    });
    [1, 2].forEach(function (n) { renumberEmployment(n); });
    recalc();
  }

  /* ------------------------------------------------------------------ */
  /* Printing                                                            */
  /* ------------------------------------------------------------------ */

  /* The browser's "Save as PDF" uses document.title as the filename, so give
     it the applicant's name rather than a generic one. */
  function printFilename() {
    var name = applicantName(collect().fields);
    return name ? 'Ayers Loan Application - ' + fileSafe(name) : 'Ayers Loan Application';
  }

  function setupPrinting() {
    var realTitle = document.title;
    window.addEventListener('beforeprint', function () { document.title = printFilename(); });
    window.addEventListener('afterprint', function () { document.title = realTitle; });
  }

  /* ------------------------------------------------------------------ */
  /* Status message                                                      */
  /* ------------------------------------------------------------------ */

  var statusTimer;
  function say(msg) {
    var el = $('#status');
    if (!el) { return; }
    el.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.textContent = ''; }, 4000);
  }

  /* ------------------------------------------------------------------ */
  /* Build the page                                                      */
  /* ------------------------------------------------------------------ */

  function build() {
    [1, 2].forEach(function (n) {
      $('[data-personal="' + n + '"]').innerHTML = personalBlock(n);
      $('[data-employment="' + n + '"]').innerHTML = employmentSection(n);
      $('[data-income="' + n + '"]').innerHTML = incomeSection(n);
    });

    $('#assets-left').innerHTML = ASSETS_LEFT.map(pairRow).join('');
    $('#assets-right').innerHTML = ASSETS_RIGHT.map(pairRow).join('');

    $('#expenses-general').innerHTML =
      '<div class="subhead">General</div>' +
      GENERAL_EXPENSES.map(function (e) { return expenseRow(e[0], e[1], 'general', false); }).join('') +
      totalRow('general_total', 'Total');

    $('#expenses-additional').innerHTML =
      '<div class="subhead">Additional</div>' +
      ADDITIONAL_EXPENSES_TOP.map(function (e) { return expenseRow(e[0], e[1], 'additional', false); }).join('') +
      '<div id="investment-expenses"></div>' +
      '<div class="add-row no-print"><button type="button" class="btn" id="btn-add-investment">' +
      '+ Add investment property</button></div>' +
      ADDITIONAL_EXPENSES_BOTTOM.map(function (e) { return expenseRow(e[0], e[1], 'additional', false); }).join('') +
      totalRow('additional_total', 'Total');

    setCounts({ properties: 3, emp1: 1, emp2: 1, investments: 2 });
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function wire() {
    var form = $('#loan-form');

    form.addEventListener('input', function (e) {
      if (e.target.classList.contains('amount')) { recalc(); }

      // Keep each income line labelled with the job it belongs to.
      if (/(job_title|employer_name)$/.test(e.target.name || '')) {
        var card = e.target.closest('[data-emp-card]');
        if (card) { syncIncome(card.getAttribute('data-emp-card')); }
      }
    });

    form.addEventListener('blur', function (e) {
      if (e.target.classList && e.target.classList.contains('amount') && e.target.value) {
        var n = num(e.target.value);
        e.target.value = n ? fmt(n) : e.target.value;
        recalc();
      }
    }, true);

    // Exclusive tick groups (checkboxes behave like the printed boxes but
    // only one option in a group can be ticked).
    form.addEventListener('change', function (e) {
      var el = e.target;
      if (el.type !== 'checkbox') { return; }

      if (el.hasAttribute('data-current')) {
        var applicant = el.closest('[data-emp-card]').getAttribute('data-emp-card');
        sortEmployment(applicant);
        renumberEmployment(applicant);
        return;
      }

      var group = el.getAttribute('data-excl') || (el.getAttribute('data-pair') ? el.name : null);
      if (el.getAttribute('data-pair') && el.checked) {
        var other = form.querySelector('[name="' + el.getAttribute('data-pair') + '"]');
        if (other) { other.checked = false; }
        return;
      }
      if (!group || !el.checked) { return; }
      $$('[data-excl="' + cssEscape(group) + '"]', form).forEach(function (sib) {
        if (sib !== el) { sib.checked = false; }
      });
    });

    form.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) { return; }

      if (btn.hasAttribute('data-add-emp')) {
        addEmployment(btn.getAttribute('data-add-emp'));
        return;
      }
      var kind = btn.getAttribute('data-remove');
      if (kind === 'emp') {
        var card = btn.closest('[data-emp-card]');
        var n = card.getAttribute('data-emp-card');
        // Drop this job's income line, not simply the last one, so the
        // remaining figures stay with their jobs.
        var pos = $$('[data-emp-card]', $('[data-emp-list="' + n + '"]')).indexOf(card);
        var incomeRows = $$('[data-income-list="' + n + '"] [data-income-row]');
        if (incomeRows[pos]) { incomeRows[pos].remove(); }
        card.remove();
        renumberEmployment(n);
      } else if (kind === 'property') {
        btn.closest('tr').remove();
        renumberProperties();
      } else if (kind === 'inv') {
        btn.closest('[data-inv-row]').remove();
        renumberInvestments();
        recalc();
      }
    });

    $('#btn-add-property').addEventListener('click', addProperty);
    $('#btn-add-investment').addEventListener('click', addInvestmentExpense);

    $('#btn-fillable').addEventListener('click', function () {
      var btn = this;
      var name = applicantName(collect().fields);
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = 'Building…';
      say('Building PDF…');
      window.AyersPdf.download('Ayers Loan Application' + (name ? ' - ' + fileSafe(name) : '') + '.pdf')
        .finally(function () { btn.textContent = label; })
        .then(function (overflow) {
          btn.disabled = false;
          if (overflow && overflow.length) {
            window.alert('PDF downloaded.\n\nThe Ayers form has room for 5 properties, one current and ' +
              'one previous job per applicant, and 4 investment property expense lines. These did not ' +
              'fit and are not in the PDF:\n\n  • ' + overflow.join('\n  • ') +
              '\n\nPrint the page itself (⌘P) if you need a record showing everything.');
            say('PDF downloaded — some entries did not fit');
          } else {
            say('PDF downloaded');
          }
        })
        .catch(function (err) {
          btn.disabled = false;
          window.alert('Could not build the PDF.\n\n' + err.message +
            '\n\nThis needs the page to be served over http:// — start it with "Start Ayers Form.command" ' +
            'rather than double-clicking index.html.');
          say('PDF failed');
        });
    });

    /* Reset, on the form itself, is the only way to start over. */
    $('#btn-reset').addEventListener('click', function () {
      if (!window.confirm('Clear the whole form?\n\nAnything not downloaded will be lost.')) { return; }
      localStorage.removeItem(STORAGE_KEY);
      clearForm();
      window.scrollTo({ top: 0 });
      say('Form cleared');
    });

    // Autosave, quietly.
    var autosaveTimer;
    form.addEventListener('input', function () {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function () {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collect()));
      }, 1200);
    });
  }

  function restore() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { return false; }
    try {
      var data = JSON.parse(raw);
      apply(data);
      say('Restored where you left off');
      return true;
    } catch (err) { return false; }
  }

  build();
  wire();
  setupPrinting();
  restore();
  recalc();
})();
