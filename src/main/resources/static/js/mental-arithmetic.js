const MentalArithmetic = (() => {

  let state = {
    sectionCount: 1,
    correctAnswers: [],
    seqNums: [],   // per-section array of numbers
    seqOps: [],    // per-section array of operators
    phase: 'idle', // idle | showing | answering | done
    showTimeout: null,
    settings: {}
  };

  const DOM = {
    panel: () => document.getElementById('settingsPanel'),
    area: () => document.getElementById('exerciseArea'),
    answerPanel: () => document.getElementById('answerPanel'),
    grid: () => document.getElementById('exerciseGrid'),
    startBtn: () => document.getElementById('startBtn'),
    stopBtn: () => document.getElementById('stopBtn'),
    submitBtn: () => document.getElementById('submitBtn'),
    retryBtn: () => document.getElementById('retryBtn'),
    newBtn: () => document.getElementById('newExerciseBtn'),
    modal: () => document.getElementById('resultModal'),
    modalBody: () => document.getElementById('resultBody'),
    modalClose: () => document.getElementById('modalClose'),
    phaseLabel: () => document.getElementById('phaseLabel'),
    answerInputs: () => document.getElementById('answerInputs'),
    numCount: () => document.getElementById('numCount'),
    digitCount: () => document.getElementById('digitCount'),
    intervalMs: () => document.getElementById('intervalMs'),
    screenDiv: () => document.getElementById('screenDiv'),
    operation: () => document.getElementById('operation'),
  };

  function getSettings() {
    return {
      count: parseInt(DOM.numCount().value, 10) || 5,
      digits: parseInt(DOM.digitCount().value, 10) || 1,
      interval: parseInt(DOM.intervalMs().value, 10) || 1000,
      divisions: parseInt(DOM.screenDiv().value, 10) || 1,
      operation: DOM.operation().value || 'add'
    };
  }

  function generateNumber(digits) {
    const lower = Math.pow(10, digits - 1);
    const upper = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
  }

  // Build independent number+operator sequences for each section, and its sum.
  function generateSequences(s) {
    state.seqNums = [];
    state.seqOps = [];
    state.correctAnswers = [];

    for (let d = 0; d < s.divisions; d++) {
      const nums = [];
      const ops = [];
      for (let i = 0; i < s.count; i++) {
        nums.push(generateNumber(s.digits));
        if (s.operation === 'add') ops.push('+');
        else if (s.operation === 'sub') ops.push(i === 0 ? '+' : '-');
        else if (s.operation === 'mul') ops.push(i === 0 ? '×' : '×');
        else ops.push(i === 0 || Math.random() > 0.5 ? '+' : '-');
      }
      let total = 0;
      if (s.operation === 'mul') {
        total = nums[0] || 0;
        for (let i = 1; i < nums.length; i++) total *= nums[i];
      } else {
        for (let i = 0; i < nums.length; i++) total += (ops[i] === '+' ? nums[i] : -nums[i]);
      }

      state.seqNums.push(nums);
      state.seqOps.push(ops);
      state.correctAnswers.push(total);
    }
    state.sectionCount = s.divisions;
  }

  function buildGrid(s) {
    const grid = DOM.grid();
    grid.className = 'exercise-grid div-' + s.divisions;
    grid.innerHTML = '';
    for (let d = 0; d < s.divisions; d++) {
      const cell = document.createElement('div');
      cell.className = 'exercise-cell state-ready';
      cell.dataset.div = d;
      cell.innerHTML = `
        <span class="cell-label">${label(d)}</span>
        <span class="cell-number hide">0</span>
      `;
      grid.appendChild(cell);
    }
  }

  function label(d) { return String.fromCharCode(65 + d); }
  function getCells() { return DOM.grid().querySelectorAll('.exercise-cell'); }
  function signed(op, n) {
    if (op === '-') return '−' + n;
    if (op === '×') return '× ' + n;
    return '' + n;
  }

  function enterFullscreen() {
    document.body.classList.add('fullscreen-mode');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }

  function exitFullscreen() {
    document.body.classList.remove('fullscreen-mode');
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  function startExercise() {
    const s = getSettings();

    if (s.count < 1) { alert('Ən azı 1 ədəd olmalıdır!'); return; }

    state.settings = s;
    state.phase = 'showing';
    generateSequences(s);

    DOM.panel().style.display = 'none';
    DOM.area().style.display = 'block';
    DOM.answerPanel().style.display = 'none';
    enterFullscreen();

    buildGrid(s);
    updatePhaseLabel('Ədədlər göstərilir…');

    const cells = getCells();
    let idx = 0;

    function showStep() {
      // reveal current index in every section (each its own number)
      for (let d = 0; d < s.divisions; d++) {
        const numSpan = cells[d].querySelector('.cell-number');
        numSpan.textContent = signed(state.seqOps[d][idx], state.seqNums[d][idx]);
        numSpan.className = 'cell-number show';
        cells[d].className = 'exercise-cell state-showing';
      }

      state.showTimeout = setTimeout(() => {
        idx++;
        if (idx >= s.count) { endShowing(); return; }
        // brief blink to separate consecutive numbers
        for (let d = 0; d < s.divisions; d++) {
          cells[d].querySelector('.cell-number').className = 'cell-number hide';
          cells[d].className = 'exercise-cell state-ready';
        }
        state.showTimeout = setTimeout(showStep, Math.min(120, s.interval / 4));
      }, s.interval);
    }

    showStep();
  }

  // After the last number, go straight to the answer box (no separate countdown).
  function endShowing() {
    clearTimeout(state.showTimeout);
    state.showTimeout = null;

    const s = state.settings;
    const cells = getCells();
    if (document.body.classList.contains('fullscreen-mode')) {
      // Keep numbers visible in fullscreen (proyektor üçün)
      for (let d = 0; d < s.divisions; d++) {
        cells[d].className = 'exercise-cell state-done';
      }
    } else {
      for (let d = 0; d < s.divisions; d++) {
        cells[d].querySelector('.cell-number').className = 'cell-number hide';
        cells[d].className = 'exercise-cell state-done';
      }
    }

    state.phase = 'answering';
    updatePhaseLabel('Cavabını yaz ✍️');
    showAnswerInputs();
  }

  function showAnswerInputs() {
    const container = DOM.answerInputs();
    container.innerHTML = '';
    DOM.answerPanel().style.display = 'block';

    for (let d = 0; d < state.sectionCount; d++) {
      const row = document.createElement('div');
      row.className = 'answer-input-row';
      row.innerHTML = `
        <label>${label(d)}</label>
        <input type="number" id="answer-${d}" placeholder="${state.sectionCount > 1 ? label(d) + ' hissəsinin cəmi' : 'Cəmi'}" autocomplete="off" />
      `;
      container.appendChild(row);
    }

    DOM.answerPanel().scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const first = document.getElementById('answer-0');
      if (first) first.focus();
    }, 120);
  }

  function checkAnswers() {
    const results = [];
    let correctCount = 0;

    for (let d = 0; d < state.sectionCount; d++) {
      const input = document.getElementById('answer-' + d);
      const raw = input ? input.value.trim() : '';
      const userAns = raw === '' ? null : parseFloat(raw);
      const correct = state.correctAnswers[d];
      const isCorrect = userAns !== null && !isNaN(userAns) && userAns === correct;
      if (isCorrect) correctCount++;
      results.push({ section: d, user: userAns, correct, isCorrect });
    }
    showResults(results, correctCount);
  }

  function showResults(results, correctCount) {
    const body = DOM.modalBody();
    const total = results.length;
    const allCorrect = correctCount === total;

    let summaryHtml;
    if (allCorrect) {
      summaryHtml = '<div class="result-summary all-correct">🎉 Təbriklər! Düz tapdınız!</div>';
    } else {
      summaryHtml = `<div class="result-summary partial">${correctCount} / ${total} cavab düzgündür</div>`;
    }

    let itemsHtml = '';
    for (const r of results) {
      itemsHtml += `
        <div class="result-item ${r.isCorrect ? 'correct' : 'incorrect'}">
          <span class="result-section">${total > 1 ? label(r.section) + ' hissəsi' : 'Cəmi'}</span>
          <div class="result-values">
            <span><span class="result-label">Sizin cavab:</span> <span class="result-num">${r.user !== null && !isNaN(r.user) ? r.user : '—'}</span></span>
            <span><span class="result-label">Düzgün cəm:</span> <span class="result-num">${r.correct}</span></span>
          </div>
          <span class="result-icon">${r.isCorrect ? '✅' : '❌'}</span>
        </div>
      `;
    }

    body.innerHTML = summaryHtml + itemsHtml;
    DOM.modal().style.display = 'flex';
  }

  function stopExercise() {
    clearTimeout(state.showTimeout);
    state.showTimeout = null;
    state.phase = 'idle';
    exitFullscreen();
    resetView();
  }

  function resetView() {
    DOM.panel().style.display = 'block';
    DOM.area().style.display = 'none';
    DOM.answerPanel().style.display = 'none';
    DOM.modal().style.display = 'none';
    updatePhaseLabel('Hazırlıq');
  }

  function updatePhaseLabel(text) { DOM.phaseLabel().textContent = text; }

  function bindEvents() {
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen-mode');
      }
    });

    DOM.startBtn().addEventListener('click', startExercise);
    DOM.stopBtn().addEventListener('click', stopExercise);
    DOM.submitBtn().addEventListener('click', checkAnswers);
    DOM.retryBtn().addEventListener('click', () => { DOM.modal().style.display = 'none'; startExercise(); });
    DOM.newBtn().addEventListener('click', () => { DOM.modal().style.display = 'none'; exitFullscreen(); resetView(); });
    DOM.modalClose().addEventListener('click', () => { DOM.modal().style.display = 'none'; });
    DOM.modal().addEventListener('click', (e) => { if (e.target === DOM.modal()) DOM.modal().style.display = 'none'; });

    DOM.answerInputs().addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const inputs = Array.from(DOM.answerInputs().querySelectorAll('input'));
      const i = inputs.indexOf(document.activeElement);
      if (i > -1 && i < inputs.length - 1) inputs[i + 1].focus();
      else checkAnswers();
    });
  }

  function init() { bindEvents(); }
  return { init };
})();
