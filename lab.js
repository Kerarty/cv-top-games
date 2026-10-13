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

  /* Сбрасывает поле к начальному состоянию и гасит бой, если он шёл. */
  function resetBoard() {
    stopPlayback();
    grid = ENGINE.makeGrid();
    energy = BALANCE.energy.start;
    selected = { arch: "melee", tier: 1 };
    lastBatch = null;
    showBuildView();
    updateHUD();
    drawLog(labText("combat", "waiting"), "muted");
  }

  /* Возврат к режиму сборки: поле снова узкое, показывает только свой отряд. */
  function showBuildView() {
    view.mode = "build";
    view.cols = BALANCE.board.cols;
    view.rows = BALANCE.board.rows;
    view.floating = [];
    view.units = listUnitsForView();
    if (els.sideLabels) els.sideLabels.classList.remove("is-visible");
    if (els.battleBar) els.battleBar.classList.remove("is-visible");
    drawScene();
  }

  /* Юниты сетки в виде сцены. Позиция фиксирована: в сборке анимировать
     нечего, юнит либо стоит на месте, либо только что появился. */
  function listUnitsForView() {
    var out = [];
    for (var r = 0; r < BALANCE.board.rows; r++) {
      for (var c = 0; c < BALANCE.board.cols; c++) {
        var u = ENGINE.gridAt(grid, c, r);
        if (!u) continue;
        out.push({
          id: u.id, arch: u.arch, tier: u.tier,
          col: u.col, row: u.row, dc: u.col, dr: u.row,
          hp: u.hp, maxHp: u.maxHp,
          side: "own", anim: 1, alpha: 1, hitFlash: 0, dead: false, showHp: false,
        });
      }
    }
    return out;
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

    view.units = listUnitsForView();
    drawScene();
    updateHUD();

    if (done > 0) {
      drawLog(labText("combat", "mergeHint") + " (−" + fee + ")", "good");
    }
  }

  /* -------------------------------------------------------------------------
     СЦЕНА
     ---------------------------------------------------------------------------
     Один рисовальщик на оба режима. Во время сборки поле узкое (4×4) и
     показывает только свой отряд, во время боя — широкое (8×4), слева игрок,
     справа противник. Раньше это были две разные функции, и они разошлись:
     бой рисовался отдельно, без полос здоровья и без видимого противника.

     Сцена читает состояние из view, а не из сетки напрямую: иначе отрисовка
     боя и сборки всё равно остались бы разными ветками кода.
     ------------------------------------------------------------------------- */
  var view = { mode: "build", cols: BALANCE.board.cols, rows: BALANCE.board.rows, units: [], floating: [] };

  /* Боевое состояние. Живёт отдельно от сетки сборки: сетка — это то, что
     игрок расставил, а здесь — то, что происходит в бою. */
  var fight = null;

  function drawScene() {
    var ctx = els.board.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var rect = els.board.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    if (!w || !h) return;

    els.board.width = Math.round(w * dpr);
    els.board.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var cols = view.cols, rows = view.rows;
    // Ячейка квадратная и вписывается в высоту: иначе на узком экране
    // поле вытягивалось в полосу и юниты наезжали на подписи.
    var cell = Math.floor(Math.min(w / cols, h / rows));
    var pad = Math.round(cell * 0.14);
    var ox = Math.round((w - cell * cols) / 2);
    var oy = Math.round((h - cell * rows) / 2);

    // Подложка поля
    ctx.save();
    roundRect(ctx, ox - pad, oy - pad, cell * cols + pad * 2, cell * rows + pad * 2, cell * 0.28);
    ctx.fillStyle = view.mode === "fight" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.035)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Сетка
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (var c = 1; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cell, oy + cell * 0.1);
      ctx.lineTo(ox + c * cell, oy + cell * rows - cell * 0.1);
      ctx.stroke();
    }
    for (var r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(ox + cell * 0.1, oy + r * cell);
      ctx.lineTo(ox + cell * cols - cell * 0.1, oy + r * cell);
      ctx.stroke();
    }

    // Разделитель между половинами: только в бою. Он и читается как
    // «здесь наши, здесь противник».
    if (view.mode === "fight") {
      var mid = ox + cell * BALANCE.board.cols;
      var grd = ctx.createLinearGradient(0, oy - pad, 0, oy + cell * rows + pad);
      grd.addColorStop(0, "rgba(198,138,31,0)");
      grd.addColorStop(0.5, "rgba(198,138,31,0.35)");
      grd.addColorStop(1, "rgba(198,138,31,0)");
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mid, oy - pad);
      ctx.lineTo(mid, oy + cell * rows + pad);
      ctx.stroke();
    }

    var rad = cell * 0.3;
    for (var i = 0; i < view.units.length; i++) {
      var u = view.units[i];
      // Позиция плавно догоняет цель: юнит не перескакивает между клетками,
      // а шагает, и сближение отрядов читается движением, а не морганием.
      // Промежуточная клетка лежит в dc/dr, целевая — в col/row.
      var px = ox + (u.dc + (u.col - u.dc) * u.anim) * cell + cell / 2;
      var py = oy + (u.dr + (u.row - u.dr) * u.anim) * cell + cell / 2;
      drawUnit(ctx, u, px, py, rad, u.alpha);
      if (u.showHp) drawHp(ctx, u, px, py + rad * 1.34, cell * 0.52);
      if (u.hitFlash > 0) drawUnit(ctx, u, px, py, rad * 1.12, u.hitFlash * 0.5);
    }

    // Всплывающий урон рисуется поверх всего — он и должен читаться первым.
    for (var k = view.floating.length - 1; k >= 0; k--) {
      var f = view.floating[k];
      var fx = ox + f.col * cell + cell / 2;
      var fy = oy + f.row * cell + cell / 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
      ctx.fillStyle = f.color;
      ctx.font = "700 " + Math.round(cell * 0.34) + "px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, fx, fy - rad * 1.2 - f.age * cell * 0.9);
      ctx.restore();
    }
  }

  /* Полоска здоровья. Без неё бой превращается в мельтешение фигур: видно,
     что кто-то кого-то бьёт, но не видно, что это меняет. */
  function drawHp(ctx, u, x, y, w) {
    var share = Math.max(0, Math.min(1, u.hp / u.maxHp));
    var h = Math.max(3, w * 0.16);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, x - w / 2, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = share > 0.5 ? "#7FC98A" : share > 0.22 ? "#E0A33C" : "#D07070";
    roundRect(ctx, x - w / 2, y, w * share, h, h / 2);
    ctx.fill();
    ctx.restore();
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
      ctx.rect(x - rad * 0.84, y - rad * 0.84, rad * 1.68, rad * 1.68);
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

    // У врага обводка сверху: стороны отличаются не только положением,
    // но и видом, иначе в общей свалке их не разобрать.
    if (u.side === "enemy") {
      ctx.strokeStyle = "rgba(208,112,112,0.85)";
      ctx.lineWidth = Math.max(1.5, rad * 0.12);
      ctx.stroke();
    }

    // Тайр — числом в центре: без него игрок не понимает, что собрал.
    ctx.fillStyle = "rgba(12,12,15,0.88)";
    ctx.font = "600 " + Math.round(rad * 0.92) + "px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(u.tier), x, y + 1);

    ctx.restore();
  }

  /* Затемнение цвета. Каналы обязательно округляются: при дробном amt
     сумма получается дробной, toString(16) выдаёт вид «154e82.c28f5»,
     и addColorStop бросает исключение. Рисование падало целиком — поле
     оставалось пустым, а бой не двигался. */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clampChannel((n >> 16) + amt * 255);
    var g = clampChannel(((n >> 8) & 255) + amt * 255);
    var b = clampChannel((n & 255) + amt * 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function clampChannel(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
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
  /* Функция называется startFight, а не fight: рядом в модуле живёт переменная
     fight с состоянием боя, и объявление `var fight = null` перетирало
     одноимённую функцию. Обработчик клика молча вешался на null, и кнопка
     «В бой» не делала ровно ничего. */
  function startFight() {
    var mine = ownSquad();
    if (!mine.squad.length) return;

    // Противник собирается тем же бюджетом — иначе бой показывает
    // не баланс архитектуры, а разницу бюджетов.
    var rng = ENGINE.makeRng(Date.now() % 100000);
    var opp = ENGINE.buildOpponent(rng, mine.spent, BALANCE.board.cols, BALANCE.board.rows);

    var res = ENGINE.simulate(mine.squad, opp.squad, { rng: rng, log: true });
    startPlayback(res);
  }

  /* Кнопка скорости: бои по 12–18 секунд смотреть в темпе реального времени
     скучно, но и мгновенный перескок ничего не объясняет. Поэтому скорость
     переключается, а не спрятана. */
  function cycleSpeed() {
    if (!fight) return;
    fight.speed = fight.speed === 1 ? 2 : fight.speed === 2 ? 4 : 1;
    els.speedBtn.textContent = fight.speed + "×";
  }

  function updateTickLabel() {
    if (!fight || !els.tickLabel) return;
    var last = fight.events.length ? fight.events[fight.events.length - 1].tick : 0;
    var shown = Math.min(last, fight.events.length ? fight.events[fight.index - 1] ? fight.events[fight.index - 1].tick : 0 : 0);
    els.tickLabel.textContent = shown + " / " + last;
  }

  /* -------------------------------------------------------------------------
     ПОВТОР БОЯ
     ---------------------------------------------------------------------------
     Бой посчитан целиком заранее, дальше он проигрывается по событиям.
     Так можно крутить скорость, останавливать и проматывать назад, не
     пересчитывая ничего.

     Повтор идёт в игровом масштабе времени: настоящий бой длится 12–18
     секунд, и показывать его «как в жизни» значит заставить рекрутера
     ждать. Тики идут с ускорением, но порядок и длительность боя в секундах
     остаются настоящими и показываются в отчёте.
     ------------------------------------------------------------------------- */
  var TICK_MS = 110;      // длительность одного тика на экране
  var MAX_FRAME_DT = 120; // иначе после сворачивания вкладки всё проскочит разом

  function startPlayback(res) {
    stopPlayback();

    // Бой уже посчитан, но сцена живёт отдельно: сущности копируются,
    // чтобы анимация не могла испортить отчёт.
    var units = [];
    var byId = {};

    function add(list, side) {
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        var u = {
          id: s.id, arch: s.arch, tier: s.tier,
          col: s.col, row: s.row, dc: s.col, dr: s.row,
          hp: s.hp, maxHp: s.maxHp,
          side: side, anim: 1, alpha: 1, hitFlash: 0, dead: false, showHp: true,
        };
        units.push(u);
        byId[s.id] = u;
      }
    }
    add(res.start.own, "own");
    add(res.start.enemy, "enemy");

    fight = {
      res: res,
      units: units,
      byId: byId,
      events: res.events,
      index: 0,
      last: 0,
      speed: 1,
      paused: false,
      done: false,
      raf: 0,
    };

    view.mode = "fight";
    view.cols = res.start.cols;
    view.rows = res.start.rows;
    view.units = units;
    view.floating = [];

    // Панель боя появляется вместе с широким полем: подписи сторон нужны
    // ровно тогда, когда противник наконец на экране.
    if (els.battleBar) els.battleBar.classList.add("is-visible");
    if (els.sideLabels) els.sideLabels.classList.add("is-visible");
    if (els.tickLabel) els.tickLabel.textContent = "0 / " + (res.events.length ? res.events[res.events.length - 1].tick : 0);

    updateHUD();
    els.board.classList.add("is-fighting");
    els.log.innerHTML = "";
    fight.last = performance.now();
    fight.raf = requestAnimationFrame(stepPlayback);
  }

  function stopPlayback() {
    if (fight && fight.raf) cancelAnimationFrame(fight.raf);
    fight = null;
    els.board.classList.remove("is-fighting");
    if (els.battleBar) els.battleBar.classList.remove("is-visible");
  }

  function stepPlayback(now) {
    if (!fight) return;
    /* dt зажат снизу нулём: отметка первого кадра rAF бывает раньше
       того момента, когда был создан повтор, и разность уходит в минус.
       Отрицательное время уводит счётчик тиков в отрицательную зону,
       и он уже не догоняет единицу — бой зависает на нулевом тике. */
    var dt = Math.max(0, Math.min(now - fight.last, MAX_FRAME_DT));
    fight.last = now;

    if (!fight.paused) {
      var tickMs = TICK_MS / fight.speed;
      var advance = dt / tickMs;
      fight.clock = (fight.clock || 0) + advance;
      // fight проверяется и внутри цикла: applyNextTick на последнем
      // тике вызывает finishPlayback, а та обнуляет переменную. Без
      // проверки следующая итерация читала уже пустой объект.
      while (fight && fight.clock >= 1 && !fight.done) {
        fight.clock -= 1;
        applyNextTick();
      }
    }

    // Повтор мог закончиться прямо в applyNextTick выше.
    if (!fight) return;

    animateUnits(dt);
    drawScene();

    if (!fight.done) {
      fight.raf = requestAnimationFrame(stepPlayback);
    }
  }

  /* Один тик событий. События за тик применяются подряд, поэтому попадания
     одного и того же тика не разлетаются по разным кадрам. */
  function applyNextTick() {
    var evs = fight.events;
    // Граница проверяется ДО обращения к элементу: при исчерпанных
    // событиях evs[fight.index] — это undefined, и чтение .tick падало
    // исключением раньше, чем доходил до проверки. Повтор зависал на
    // последнем тике и никогда не показывал результат.
    if (!evs.length || fight.index >= evs.length) {
      finishPlayback();
      return;
    }

    var tickNo = evs[fight.index].tick;

    while (fight.index < evs.length && evs[fight.index].tick === tickNo) {
      applyEvent(evs[fight.index]);
      fight.index++;
    }

    updateTickLabel();
  }

  function applyEvent(ev) {
    if (ev.type === "move") {
      var m = fight.byId[ev.id];
      if (!m || m.dead) return;
      m.dc = m.col;
      m.dr = m.row;
      m.col = ev.to.col;
      m.row = ev.to.row;
      m.anim = 0;          // плавно догоняет новую клетку
      return;
    }

    if (ev.type !== "hit") return;

    var target = fight.byId[ev.targetId];
    var attacker = fight.byId[ev.id];
    if (!target || target.dead) return;

    target.hp = ev.hpAfter;
    target.hitFlash = 1;

    pushFloat(target, "−" + ev.amount, "#F2A0A0");

    if (ev.dead) {
      target.dead = true;
      pushFloat(target, "✕", "#D07070");
      if (attacker) attacker.hitFlash = 0.5;
    }
  }

  /* Всплывающее число ударного урона. Клетку запоминаем, а не пиксели:
     размер поля меняется при повороте экрана и ресайзе, и сохранённые
     координаты увели бы число не туда. */
  function pushFloat(u, text, color) {
    view.floating.push({
      text: text,
      color: color,
      col: u.col,
      row: u.row,
      age: 0,
      life: 0.9,
    });
  }

  function animateUnits(dt) {
    var k = Math.min(1, dt / 90);
    for (var i = 0; i < view.units.length; i++) {
      var u = view.units[i];
      if (u.anim < 1) u.anim = Math.min(1, u.anim + k);
      if (u.hitFlash > 0) u.hitFlash = Math.max(0, u.hitFlash - dt / 180);
      if (u.dead && u.alpha > 0) {
        // Смерть не исчезает мгновенно: юнит сжимается и гаснет, иначе
        // из сцены вычёркивается половина бойцов без следа.
        u.alpha = Math.max(0, u.alpha - dt / 420);
        u.anim = Math.min(1, u.anim + dt / 500);
      }
    }

    for (var f = view.floating.length - 1; f >= 0; f--) {
      view.floating[f].age += dt / 1000;
      if (view.floating[f].age >= view.floating[f].life) view.floating.splice(f, 1);
    }
  }

  function finishPlayback() {
    if (!fight || fight.done) return;
    fight.done = true;

    var res = fight.res;
    var title = res.winner === "win" ? labText("combat", "victory")
      : res.winner === "loss" ? labText("combat", "defeat") : "—";

    renderCombat(res, title);
    stopPlayback();
    els.fightBtn.disabled = ENGINE.countUnits(grid) === 0;
  }

  function renderCombat(res, title) {
    els.result.className = "lab-result tone-" + (res.winner === "win" ? "good" : res.winner === "loss" ? "bad" : "muted");
    els.result.innerHTML = "";

    var head = document.createElement("div");
    head.className = "result-head";
    head.textContent = title;
    els.result.appendChild(head);

    var meta = document.createElement("div");
    meta.className = "result-meta";
    meta.textContent = res.seconds + " с · " + res.ticks + " тиков · " +
      res.ownLeft + " против " + res.enemyLeft;
    els.result.appendChild(meta);

    els.log.innerHTML = "";
    var lines = res.log.slice(-14);
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
    // Правка работает и посреди боя: иначе выглядело бы, будто таблица
    // подключена не ко всему.
    refreshScene();
    drawPalette();
    drawCharts();
    updateVerdict();
  }

  /* Перерисовка сцены в том режиме, в котором она сейчас живёт:
     узкое поле сборки или широкое поле боя. */
  function refreshScene() {
    if (fight) {
      view.units = fight.units;
      drawScene();
    } else {
      view.units = listUnitsForView();
      drawScene();
    }
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
    refreshScene();
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

    els.fightBtn.addEventListener("click", startFight);
    els.resetBtn.addEventListener("click", resetBoard);
    els.runBtn.addEventListener("click", runSimulation);
    els.restoreBtn.addEventListener("click", restoreDefaults);
    els.copyBtn.addEventListener("click", copyTable);
    els.speedBtn.addEventListener("click", cycleSpeed);

    // Повтор держит собственную петлю кадров, поэтому при ресайзе
    // перерисовываем сцену напрямую: иначе на полпути к остановке
    // картинка оставалась бы в старых размерах.
    window.addEventListener("resize", function () {
      drawScene();
      drawCharts();
    });

    // Уход со вкладки не должен доигрывать весь бой в молчании.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && fight && !fight.done) {
        fight.paused = true;
      }
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
      speedBtn: document.getElementById("labSpeed"),
      tickLabel: document.getElementById("labTick"),
      sideLabels: document.getElementById("labSides"),
      battleBar: document.getElementById("labBattleBar"),
    };
    snapshotDefaults();
    bind();
    rebuild();
  }

  return {
    init: init,
    rebuild: rebuild,
    drawCharts: drawCharts,
    updateVerdict: updateVerdict,
    drawScene: drawScene,
    isFighting: function () { return !!fight; },
    // Отладочный доступ к состоянию боя: без него нельзя понять, что
    // происходит внутри повтора, — снаружи видно только «идёт / не идёт».
    state: function () {
      return fight ? {
        clock: fight.clock, index: fight.index, speed: fight.speed,
        paused: fight.paused, done: fight.done, events: fight.events.length,
        units: fight.units.length,
      } : null;
    },
  };
})();