// ============================================================================
// ЛАБОРАТОРИЯ: поле боя, редактируемая таблица, графики, симуляция.
//
// Три вкладки смотрят в один BALANCE. Правка ячейки переписывает значение
// в модели — и бой, и графики, и вердикт пересчитываются оттуда же.
// Именно поэтому они и связаны: одна правка, один источник правды.
// ============================================================================

var LAB = (function () {
  "use strict";

  var els = {};
  var lang = "ru";

  /* Состояние поля: сетка игрока и энергия. */
  var grid = ENGINE.makeGrid();
  var energy = 0;
  var selected = { arch: "melee", tier: 1 };
  var lastBatch = null;
  var lastReport = null;

  var COLORS = {
    melee: "#E0A33C",
    ranged: "#6FA8DC",
    mounted: "#8FD48F",
    siege: "#D08FD0",
  };

  /* Стоимость юнита и мержа подсвечиваются в энергии: игрок должен видеть,
     хватит ли бюджета, ещё до нажатия. */
  function t(langKey, key) {
    var sec = CONTENT[lang][langKey];
    return sec ? (sec[key] || "") : "";
  }

  function labText(section, key) {
    var sec = CONTENT[lang].lab[section];
    return sec ? (sec[key] || "") : "";
  }

  /* -------------------------------------------------------------------------
     ПОЛЕ БОЯ
     ------------------------------------------------------------------------- */

  /* Собственный отряд для симуляции и для боя. */
  function ownSquad() {
    var squad = ENGINE.listUnits(grid);
    var spent = 0;
    for (var i = 0; i < squad.length; i++) spent += squad[i].cost;
    return { squad: squad, spent: spent };
  }

  /* Список доступных юнитов для покупки: верхние тиры дороже,
     поэтому в первые секунды доступно немного. */
  function canAfford(arch, tier) {
    return energy >= BALANCE.costFor(arch, tier);
  }

  /* Сбрасывает поле к начальному состоянию. */
  function resetBoard() {
    grid = ENGINE.makeGrid();
    energy = BALANCE.energy.start;
    selected = { arch: "melee", tier: 1 };
    lastBatch = null;
    drawBoard();
    updateHUD();
    drawLog(labText("combat", "waiting"), "muted");
  }

  /* Ставит выбранного юнита в клетку и, если рядом нашёлся такой же,
     запускает слияние.
     Цена хода считается ДО его совершения: юнит плюс каждое вызванное
     слияние. Иначе игрок узнал бы о нехватке энергии постфактум — юнит
     уже на поле, деньги уже потрачены, отменить нельзя. */
  function buy(col, row) {
    if (!ENGINE.canPlace(grid, col, row)) return;

    var price = BALANCE.costFor(selected.arch, selected.tier);
    var merges = ENGINE.previewMerges(grid, selected.arch, selected.tier, col, row);

    // Каскад считается по порядку: первое слияние даёт тир +1, второе +2.
    var fee = 0;
    for (var i = 0; i < merges; i++) {
      fee += BALANCE.mergeCostFor(Math.min(selected.tier + i + 1, BALANCE.tiers));
    }

    if (energy < price + fee) return;

    energy -= price + fee;
    var unit = ENGINE.makeUnit(selected.arch, selected.tier, col, row);
    var done = ENGINE.placeAndMaybeMerge(grid, unit);

    drawBoard();
    updateHUD();

    if (done > 0) {
      drawLog(labText("combat", "mergeHint") + " (−" + fee + ")", "good");
    }
  }

  /* -------------------------------------------------------------------------
     ОТРИСОВКА ПОЛЯ
     ------------------------------------------------------------------------- */
  function drawBoard() {
    var ctx = els.board.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var rect = els.board.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    if (!w || !h) return;

    els.board.width = Math.round(w * dpr);
    els.board.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var cols = BALANCE.board.cols, rows = BALANCE.board.rows;
    var cell = Math.floor(Math.min(w / cols, h / rows));
    var pad = Math.round(cell * 0.16);
    var ox = Math.round((w - cell * cols) / 2);
    var oy = Math.round((h - cell * rows) / 2);

    // Подложка поля
    ctx.save();
    roundRect(ctx, ox - pad, oy - pad, cell * cols + pad * 2, cell * rows + pad * 2, cell * 0.3);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Сетка — едва заметная, чтобы поле читалось как поле
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (var c = 1; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cell, oy + cell * 0.12);
      ctx.lineTo(ox + c * cell, oy + cell * rows - cell * 0.12);
      ctx.stroke();
    }
    for (var r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(ox + cell * 0.12, oy + r * cell);
      ctx.lineTo(ox + cell * cols - cell * 0.12, oy + r * cell);
      ctx.stroke();
    }

    // Юниты
    var rad = cell * 0.32;
    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < cols; cc++) {
        var u = ENGINE.gridAt(grid, cc, rr);
        if (!u) continue;
        drawUnit(ctx, u, ox + cc * cell + cell / 2, oy + rr * cell + cell / 2, rad, 1);
      }
    }
  }

  function drawUnit(ctx, u, x, y, rad, alpha) {
    var color = COLORS[u.arch] || "#E0A33C";
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;

    // Форма зависит от архетипа — так поле читается без подписи.
    ctx.beginPath();
    if (u.arch === "melee") {
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    } else if (u.arch === "ranged") {
      ctx.rect(x - rad * 0.86, y - rad * 0.86, rad * 1.72, rad * 1.72);
    } else if (u.arch === "mounted") {
      ctx.moveTo(x, y - rad);
      ctx.lineTo(x + rad * 0.9, y + rad * 0.7);
      ctx.lineTo(x - rad * 0.9, y + rad * 0.7);
      ctx.closePath();
    } else {
      ctx.moveTo(x - rad, y - rad * 0.6);
      ctx.lineTo(x + rad, y - rad * 0.6);
      ctx.lineTo(x + rad * 0.6, y + rad);
      ctx.lineTo(x - rad * 0.6, y + rad);
      ctx.closePath();
    }

    var grad = ctx.createLinearGradient(0, y - rad, 0, y + rad);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = grad;
    ctx.shadowColor = color;
    ctx.shadowBlur = rad * 0.8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Тайр — числом в центре: без него игрок не понимает, что собрал.
    ctx.fillStyle = "rgba(12,12,15,0.85)";
    ctx.font = "600 " + Math.round(rad * 0.9) + "px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(u.tier), x, y + 1);

    ctx.restore();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt * 255));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt * 255));
    var b = Math.max(0, Math.min(255, (n & 255) + amt * 255));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* Полоса выбора юнита: четыре архетипа, у каждого своя форма и своя цена.
     Игрок видит весь бюджет сразу — решение принимается, а не подбирается. */
  function drawPalette() {
    els.palette.innerHTML = "";
    for (var i = 0; i < BALANCE.order.length; i++) {
      var arch = BALANCE.order[i];
      var name = labText("units", arch);
      var wrap = document.createElement("button");
      wrap.className = "pal-item";
      wrap.setAttribute("data-arch", arch);
      wrap.setAttribute("type", "button");

      var tierRow = document.createElement("div");
      tierRow.className = "pal-tiers";

      for (var t = 1; t <= BALANCE.tiers; t++) {
        var price = BALANCE.costFor(arch, t);
        var btn = document.createElement("span");
        btn.className = "pal-tier";
        btn.setAttribute("data-tier", t);
        btn.textContent = "T" + t;
        btn.title = price + " " + labText("combat", "energy").toLowerCase();
        btn.style.setProperty("--c", COLORS[arch]);
        tierRow.appendChild(btn);
      }

      var label = document.createElement("div");
      label.className = "pal-label";
      label.textContent = name;

      wrap.appendChild(tierRow);
      wrap.appendChild(label);
      els.palette.appendChild(wrap);
    }
    paintPalette();
  }

  /* Подсветка выбранного тира и доступных по энергии. */
  function paintPalette() {
    var items = els.palette.querySelectorAll(".pal-item");
    for (var i = 0; i < items.length; i++) {
      var arch = items[i].getAttribute("data-arch");
      var tiers = items[i].querySelectorAll(".pal-tier");
      for (var j = 0; j < tiers.length; j++) {
        var tier = parseInt(tiers[j].getAttribute("data-tier"), 10);
        var price = BALANCE.costFor(arch, tier);
        tiers[j].classList.toggle("is-active", arch === selected.arch && tier === selected.tier);
        tiers[j].classList.toggle("is-locked", energy < price);
      }
      items[i].classList.toggle("is-active", arch === selected.arch);
    }
  }

  function updateHUD() {
    els.energy.textContent = energy;
    els.unitCount.textContent = ENGINE.countUnits(grid);
    paintPalette();
    els.fightBtn.disabled = ENGINE.countUnits(grid) === 0;
  }

  function drawLog(text, tone) {
    els.log.innerHTML = "";
    var line = document.createElement("div");
    line.className = "log-line log-" + (tone || "muted");
    line.textContent = text;
    els.log.appendChild(line);
  }

  /* -------------------------------------------------------------------------
     БОЙ
     ------------------------------------------------------------------------- */
  function fight() {
    var mine = ownSquad();
    if (!mine.squad.length) return;

    // Противник собирается тем же бюджетом — иначе винрейт показывает
    // не баланс архитектуры, а разницу бюджетов.
    var rng = ENGINE.makeRng(Date.now() % 100000);
    var opp = ENGINE.buildOpponent(rng, mine.spent, BALANCE.board.cols, BALANCE.board.rows);

    els.board.classList.add("is-fighting");
    els.fightBtn.disabled = true;

    var res = ENGINE.simulate(mine.squad, opp.squad, { rng: rng, log: true });

    // Показываем отчёт и восстанавливаем поле: позиции после боя в merge-игре
    // не сохраняются, а энергия остаётся потраченной — так игрок увидит,
    // сколько стоила попытка.
    var title = res.winner === "win" ? labText("combat", "victory")
      : res.winner === "loss" ? labText("combat", "defeat") : "—";

    renderCombat(res, title);

    els.board.classList.remove("is-fighting");
    els.fightBtn.disabled = ENGINE.countUnits(grid) === 0;
  }

  /* Бой показывается в отчёте, а не в реальном времени: анимация на тиках
     занимает время рекрутера, а цифры читаются сразу. */
  function renderCombat(res, title) {
    els.result.className = "lab-result tone-" + (res.winner === "win" ? "good" : res.winner === "loss" ? "bad" : "muted");
    els.result.innerHTML = "";

    var head = document.createElement("div");
    head.className = "result-head";
    head.textContent = title;
    els.result.appendChild(head);

    var meta = document.createElement("div");
    meta.className = "result-meta";
    meta.textContent = res.seconds + " с · " + res.ticks + " тиков · осталось " +
      res.ownLeft + " из " + (res.ownLeft + (res.enemyLeft || 0));
    els.result.appendChild(meta);

    els.log.innerHTML = "";
    var lines = res.log.slice(0, 14);
    for (var i = lines.length - 1; i >= 0; i--) {
      var d = document.createElement("div");
      d.className = "log-line log-" + (lines[i].tone || "muted");
      d.textContent = lines[i].text;
      els.log.appendChild(d);
    }
  }

  /* -------------------------------------------------------------------------
     ТАБЛИЦА
     -------------------------------------------------------------------------
     Настоящие input-поля. Значение уходит в BALANCE и оттуда же читается
     боем и графиками — ровно как в таблице, из которой берут числа в продакшене.
     ------------------------------------------------------------------------- */
  var PARAMS = [
    { key: "hp", field: "base.hp", step: 1, min: 1 },
    { key: "atk", field: "base.atk", step: 1, min: 1 },
    { key: "def", field: "base.def", step: 1, min: 0 },
    { key: "spd", field: "base.spd", step: 0.05, min: 0.2 },
    { key: "crit", field: "base.crit", step: 0.01, min: 0, max: 1 },
  ];

  var DEFAULTS = null;

  function snapshotDefaults() {
    DEFAULTS = {};
    for (var i = 0; i < BALANCE.order.length; i++) {
      var a = BALANCE.order[i];
      DEFAULTS[a] = {};
      for (var p = 0; p < PARAMS.length; p++) {
        var f = PARAMS[p].field.split(".");
        DEFAULTS[a][PARAMS[p].key] = BALANCE.archetypes[a][f[0]][f[1]];
      }
    }
  }

  function renderTable() {
    var table = els.table;
    table.innerHTML = "";

    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var first = document.createElement("th");
    first.textContent = labText("table", "title");
    hr.appendChild(first);
    for (var p = 0; p < PARAMS.length; p++) {
      var th = document.createElement("th");
      th.textContent = labText("params", PARAMS[p].key);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    for (var i = 0; i < BALANCE.order.length; i++) {
      var arch = BALANCE.order[i];
      var tr = document.createElement("tr");

      var th = document.createElement("th");
      th.innerHTML = '<span class="dot" style="background:' + COLORS[arch] + '"></span>' +
        labText("units", arch);
      tr.appendChild(th);

      for (var j = 0; j < PARAMS.length; j++) {
        var td = document.createElement("td");
        var f = PARAMS[j].field.split(".");
        var input = document.createElement("input");
        input.type = "number";
        input.value = BALANCE.archetypes[arch][f[0]][f[1]];
        input.step = PARAMS[j].step;
        input.min = PARAMS[j].min;
        if (PARAMS[j].max != null) input.max = PARAMS[j].max;
        input.setAttribute("data-arch", arch);
        input.setAttribute("data-key", PARAMS[j].key);
        input.setAttribute("data-field", PARAMS[j].field);
        input.title = (BALANCE.hints[PARAMS[j].key] || {})[lang] || "";
        input.addEventListener("change", onTableEdit);
        td.appendChild(input);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  function onTableEdit(ev) {
    var input = ev.currentTarget;
    var arch = input.getAttribute("data-arch");
    var field = input.getAttribute("data-field").split(".");
    var v = parseFloat(input.value);
    if (isNaN(v)) return;
    BALANCE.archetypes[arch][field[0]][field[1]] = v;

    // Всё, что читает модель, пересчитывается сразу — это и есть
    // демонстрация единого источника правды, а не обещание.
    drawBoard();
    drawPalette();
    drawCharts();
    updateVerdict();
  }

  function restoreDefaults() {
    for (var i = 0; i < BALANCE.order.length; i++) {
      var a = BALANCE.order[i];
      for (var p = 0; p < PARAMS.length; p++) {
        var f = PARAMS[p].field.split(".");
        BALANCE.archetypes[a][f[0]][f[1]] = DEFAULTS[a][PARAMS[p].key];
      }
    }
    renderTable();
    drawBoard();
    drawPalette();
    drawCharts();
    updateVerdict();
  }

  /* Таблица копируется в буфер как TSV — так её можно вставить
     в Google Sheets и продолжить работу в привычном инструменте. */
  function copyTable() {
    var rows = [];
    var head = [labText("table", "title")];
    for (var p = 0; p < PARAMS.length; p++) head.push(labText("params", PARAMS[p].key));
    rows.push(head.join("\t"));
    for (var i = 0; i < BALANCE.order.length; i++) {
      var arch = BALANCE.order[i];
      var row = [labText("units", arch)];
      for (var j = 0; j < PARAMS.length; j++) {
        var f = PARAMS[j].field.split(".");
        row.push(BALANCE.archetypes[arch][f[0]][f[1]]);
      }
      rows.push(row.join("\t"));
    }
    var text = rows.join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flashCopy(true);
      }).catch(function () { flashCopy(false); });
    } else {
      flashCopy(false);
    }
  }

  function flashCopy(ok) {
    els.copyBtn.textContent = ok ? labText("table", "copied") : "—";
    setTimeout(function () { els.copyBtn.textContent = CONTENT[lang].lab.table.export; }, 1400);
  }

  /* -------------------------------------------------------------------------
     ГРАФИКИ
     ------------------------------------------------------------------------- */
  function drawCharts() {
    var report = lastReport || (lastReport = ENGINE.analyse());
    lastReport = report;
    chartTTK(report);
    chartDmg(report);
    chartCost(report);
  }

  /* Общая заготовка: оси, сетка, подпись значения над точкой. */
  function chartBase(canvas, series, opts) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var rect = canvas.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    if (!w || !h) return;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var padL = 34, padR = 12, padT = 16, padB = 24;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = opts.max;
    for (var i = 0; i < series.length; i++) max = Math.max(max, series[i].v);

    var X = function (i) { return padL + (iw * (series.length === 1 ? 0.5 : i / (series.length - 1))); };
    var Y = function (v) { return padT + ih - (ih * (max ? v / max : 0)); };

    // Сетка и подписи оси Y
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.fillStyle = "rgba(242,241,237,0.45)";
    ctx.font = "11px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (var g = 0; g <= 2; g++) {
      var yy = padT + ih - ih * (g / 2);
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
      ctx.fillText(String(Math.round(max * g / 2)), padL - 6, yy);
    }

    // Ориентир коридора — рисуется ДО кривой, иначе зона закрывает линию
    if (opts.band) {
      var yTop = Y(Math.min(opts.band[1], max));
      var yBot = Y(Math.min(opts.band[0], max));
      ctx.fillStyle = "rgba(143,212,143,0.10)";
      ctx.fillRect(padL, yTop, iw, yBot - yTop);
    }

    // Кривая — со сглаживанием, иначе на пяти точках выглядит ломаной
    ctx.strokeStyle = opts.color || "#E0A33C";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (var k = 0; k < series.length; k++) {
      var px = X(k), py = Y(series[k].v);
      if (k === 0) ctx.moveTo(px, py);
      else {
        var prevX = X(k - 1), prevY = Y(series[k - 1].v);
        var cx = (prevX + px) / 2;
        ctx.bezierCurveTo(cx, prevY, cx, py, px, py);
      }
    }
    ctx.stroke();

    // Точки и подписи
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (var m = 0; m < series.length; m++) {
      var x = X(m), y = Y(series[m].v);
      ctx.fillStyle = opts.color || "#E0A33C";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(242,241,237,0.85)";
      ctx.fillText(series[m].label || series[m].v, x, y + 7);
    }

    // Подписи оси X: тиры
    ctx.fillStyle = "rgba(242,241,237,0.45)";
    ctx.textBaseline = "top";
    for (var n = 0; n < series.length; n++) {
      ctx.fillText("T" + series[n].tier, X(n), h - padB + 6);
    }
  }

  function chartTTK(report) {
    chartBase(els.chartTTK, report.ttk.map(function (d) {
      return { tier: d.tier, v: d.seconds, label: d.seconds };
    }), { max: 10, color: "#6FA8DC", band: [BALANCE.thresholds.ttkMin, BALANCE.thresholds.ttkMax] });
  }

  function chartDmg(report) {
    chartBase(els.chartDmg, report.dmg.map(function (d) {
      return { tier: d.tier, v: d.atk, label: d.atk };
    }), { max: 10, color: "#D08FD0" });
  }

  function chartCost(report) {
    chartBase(els.chartCost, report.cost.map(function (d) {
      return { tier: d.tier, v: d.price, label: d.price };
    }), { max: 10, color: "#E0A33C" });
  }

  /* -------------------------------------------------------------------------
     СИМУЛЯЦИЯ
     -------------------------------------------------------------------------
     Вердикт считается не по тому, что игрок собрал на поле, а по эталонному
     отряду против базовой линии: одинаковый профиль тиров, разные архетипы.
     Так цифра означает ровно одно — как архетипы соотносятся между собой, —
     и не мешается с тем, что игрок нажал в поле. Состав своего отряда
     влияет на свободный бой на вкладке «Бой», но не на метрику.

     Прогон идёт частями по 12 мс: 1000 боёв — это около десяти тысяч тиков,
     и синхронный цикл на слабом телефоне на секунду подвешивает страницу.
     ------------------------------------------------------------------------- */
  function runSimulation() {
    // Логика прогона живёт в ENGINE: там же раскладка сторон. Своя копия
    // здесь означала бы вторую версию правил — и она однажды разошлась с
    // движком так, что обе стороны вставали в одни клетки.
    var run = ENGINE.makeBatchVs(
      ENGINE.benchmarkSquad,
      ENGINE.baselineSquad,
      BALANCE.sim.battles,
      BALANCE.sim.seed
    );

    els.runBtn.disabled = true;

    function chunk() {
      // 12 мс на кадр: страница остаётся отзывчивой на телефоне,
      // а тысяча боёв проходит за пару секунд.
      var finished = run.step(12);
      els.runBtn.textContent = labText("stats", "running") + " " + run.done + "/" + BALANCE.sim.battles;

      if (!finished) {
        requestAnimationFrame(chunk);
      } else {
        lastBatch = run.result();
        els.runBtn.disabled = false;
        els.runBtn.textContent = labText("stats", "run");
        drawHistogram(lastBatch);
        updateVerdict();
      }
    }

    requestAnimationFrame(chunk);
  }

  function drawHistogram(batch) {
    var total = batch.battles || 1;
    var parts = [
      { v: batch.wins, c: "#8FD48F", label: labText("stats", "win") },
      { v: batch.draws, c: "#E0A33C", label: labText("stats", "draw") },
      { v: batch.losses, c: "#D07070", label: labText("stats", "loss") },
    ];

    els.hist.innerHTML = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var share = p.v / total;
      var row = document.createElement("div");
      row.className = "hist-row";

      var label = document.createElement("span");
      label.className = "hist-label";
      label.textContent = p.label;

      var barWrap = document.createElement("span");
      barWrap.className = "hist-bar";
      var bar = document.createElement("span");
      bar.className = "hist-fill";
      bar.style.width = (share * 100).toFixed(1) + "%";
      bar.style.background = p.c;
      barWrap.appendChild(bar);

      var val = document.createElement("span");
      val.className = "hist-val";
      val.textContent = p.v + " · " + (share * 100).toFixed(1) + "%";

      row.appendChild(label);
      row.appendChild(barWrap);
      row.appendChild(val);
      els.hist.appendChild(row);
    }

    els.winrateValue.textContent = batch.winrate + "%";
    els.winrateMeta.textContent = labText("stats", "sample") + ": " + batch.battles +
      " · " + batch.avgSeconds + " с";
  }

  function updateVerdict() {
    if (!lastBatch) {
      els.verdict.innerHTML = '<p class="verdict-empty">' +
        (lang === "ru"
          ? "Нажмите «Симулировать 1000 боёв» — вердикт появится здесь."
          : "Press “Simulate 1000 battles” — the verdict will appear here.") +
        "</p>";
      return;
    }

    var report = lastReport || (lastReport = ENGINE.analyse());
    var v = ENGINE.verdictFor(lastBatch, report);

    els.verdict.className = "verdict verdict-" + v.tone;
    els.verdict.innerHTML = "";
    var list = document.createElement("ul");
    for (var i = 0; i < v.notes.length; i++) {
      var li = document.createElement("li");
      li.className = "verdict-note note-" + v.notes[i].tone;
      li.textContent = v.notes[i].text;
      list.appendChild(li);
    }
    els.verdict.appendChild(list);
  }

  /* -------------------------------------------------------------------------
     ПРИВЯЗКА
     ------------------------------------------------------------------------- */
  function bind() {
    els.palette.addEventListener("click", function (ev) {
      var tierEl = ev.target.closest(".pal-tier");
      if (!tierEl) return;
      var arch = tierEl.parentNode.parentNode.getAttribute("data-arch");
      var tier = parseInt(tierEl.getAttribute("data-tier"), 10);
      if (energy < BALANCE.costFor(arch, tier)) return;
      selected = { arch: arch, tier: tier };
      paintPalette();
    });

    els.board.addEventListener("click", function (ev) {
      var rect = els.board.getBoundingClientRect();
      var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      var cols = BALANCE.board.cols, rows = BALANCE.board.rows;
      var w = rect.width, h = rect.height;
      var cell = Math.floor(Math.min(w / cols, h / rows));
      var ox = Math.round((w - cell * cols) / 2);
      var oy = Math.round((h - cell * rows) / 2);
      var c = Math.floor((x - ox) / cell);
      var r = Math.floor((y - oy) / cell);
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      buy(c, r);
    });

    els.fightBtn.addEventListener("click", fight);
    els.resetBtn.addEventListener("click", resetBoard);
    els.runBtn.addEventListener("click", runSimulation);
    els.restoreBtn.addEventListener("click", restoreDefaults);
    els.copyBtn.addEventListener("click", copyTable);

    window.addEventListener("resize", function () {
      drawBoard();
      drawCharts();
    });
  }

  /* Пересборка интерфейса при смене языка.
     Язык передаётся явно: модуль запомнил его при инициализации, и после
     переключения вся лаборатория продолжала говорить на старом. */
  function rebuild(nextLang) {
    if (nextLang) lang = nextLang;
    renderTable();
    drawPalette();
    resetBoard();
    lastReport = ENGINE.analyse();
    lastBatch = null;
    drawCharts();
    els.hist.innerHTML = "";
    els.winrateValue.textContent = "—";
    els.winrateMeta.textContent = "";
    els.runBtn.textContent = labText("stats", "run");
    els.copyBtn.textContent = CONTENT[lang].lab.table.export;
    els.restoreBtn.textContent = CONTENT[lang].lab.table.reset;
    els.fightBtn.textContent = CONTENT[lang].lab.combat.fight;
    els.resetBtn.textContent = CONTENT[lang].lab.combat.reset;
    updateVerdict();
  }

  function init(currentLang) {
    lang = currentLang;
    els = {
      board: document.getElementById("labBoard"),
      palette: document.getElementById("labPalette"),
      energy: document.getElementById("labEnergy"),
      unitCount: document.getElementById("labUnits"),
      fightBtn: document.getElementById("labFight"),
      resetBtn: document.getElementById("labReset"),
      log: document.getElementById("labLog"),
      result: document.getElementById("labResult"),
      table: document.getElementById("labTable"),
      restoreBtn: document.getElementById("labRestore"),
      copyBtn: document.getElementById("labCopy"),
      chartTTK: document.getElementById("chartTTK"),
      chartDmg: document.getElementById("chartDmg"),
      chartCost: document.getElementById("chartCost"),
      hist: document.getElementById("labHist"),
      winrateValue: document.getElementById("winrateValue"),
      winrateMeta: document.getElementById("winrateMeta"),
      verdict: document.getElementById("labVerdict"),
      runBtn: document.getElementById("labRun"),
    };
    snapshotDefaults();
    bind();
    rebuild();
  }

  return { init: init, rebuild: rebuild, drawCharts: drawCharts, updateVerdict: updateVerdict };
})();