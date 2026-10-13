// ============================================================================
// ДВИЖОК: слияние, бой по тикам, симуляция.
// ---------------------------------------------------------------------------
// Никаких зависимостей и никакого Math.random в бою: генератор
// детерминированный, поэтому 1000 боёв воспроизводимы до последнего тика.
// Симуляция без этого — способ показать красивую гистограмму, которую
// нельзя перепроверить, а именно перепроверяемость здесь и доказывается.
// ============================================================================

var ENGINE = (function () {
  "use strict";

  /* -------------------------------------------------------------------------
     ГЕНЕРАТОР. xorshift32 — быстрый, сидируемый, достаточно равномерный
     для наших целей. Возвращает числа в [0, 1).
     ------------------------------------------------------------------------- */
  function makeRng(seed) {
    var s = seed >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function pick(rng, arr) { return arr[(rng() * arr.length) | 0]; }

  /* -------------------------------------------------------------------------
     ЮНИТ. Это данные, а не объект с поведением: всё поведение в бою,
     чтобы состояние юнита можно было спокойно копировать в симуляции.
     ------------------------------------------------------------------------- */
  function makeUnit(archId, tier, col, row) {
    var s = BALANCE.statsFor(archId, tier);
    return {
      arch: archId,
      tier: tier,
      col: col,
      row: row,
      hp: s.hp,
      maxHp: s.hp,
      atk: s.atk,
      def: s.def,
      spd: s.spd,
      crit: s.crit,
      range: BALANCE.archetypes[archId].range,
      cost: BALANCE.costFor(archId, tier),
      cd: 0,        // до готовности следующего удара, в тиках
      alive: true,
    };
  }

  function clone(u) {
    return {
      arch: u.arch, tier: u.tier, col: u.col, row: u.row,
      hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def,
      spd: u.spd, crit: u.crit, range: u.range, cost: u.cost,
      cd: 0, alive: true,
    };
  }

  /* -------------------------------------------------------------------------
     СЕТКА. Хранится как двумерный массив клеток: клетка — это юнит или null.
     Так мержается всё сразу: проверил совпадение тиров, убрал обоих,
     поставил нового.
     ------------------------------------------------------------------------- */
  function makeGrid() {
    var g = [];
    for (var r = 0; r < BALANCE.board.rows; r++) g.push(new Array(BALANCE.board.cols).fill(null));
    return g;
  }

  function gridAt(grid, col, row) {
    if (col < 0 || col >= BALANCE.board.cols) return null;
    if (row < 0 || row >= BALANCE.board.rows) return null;
    return grid[row][col];
  }

  function setAt(grid, col, row, u) {
    if (col < 0 || col >= BALANCE.board.cols) return;
    if (row < 0 || row >= BALANCE.board.rows) return;
    grid[row][col] = u;
  }

  function countUnits(grid) {
    var n = 0;
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) if (grid[r][c]) n++;
    }
    return n;
  }

  function listUnits(grid) {
    var out = [];
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) if (grid[r][c]) out.push(grid[r][c]);
    }
    return out;
  }

  function canPlace(grid, col, row) {
    if (col < 0 || col >= BALANCE.board.cols) return false;
    if (row < 0 || row >= BALANCE.board.rows) return false;
    return grid[row][col] === null;
  }

  /* -------------------------------------------------------------------------
     СЛИЯНИЕ. Игрок ставит юнита в клетку; если рядом (по любой из четырёх
     сторон) стоит точно такой же архетип и тир — оба исчезают, а на их
     месте появляется юнит тира выше.
     -------------------------------------------------------------------------
     Важное решение: слияние происходит мгновенно, а не «по очереди». Каскад
     из трёх подряд слитых юнитов разбирается за один проход, иначе игрок
     получает два тира за один ход и правило перестаёт быть правилом.
     ------------------------------------------------------------------------- */
  function placeAndMaybeMerge(grid, unit) {
    setAt(grid, unit.col, unit.row, unit);

    var merges = 0;
    var again = true;

    while (again) {
      again = false;
      for (var r = 0; r < BALANCE.board.rows; r++) {
        for (var c = 0; c < BALANCE.board.cols; c++) {
          var here = gridAt(grid, c, r);
          if (!here) continue;

          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var d = 0; d < dirs.length; d++) {
            var n = gridAt(grid, c + dirs[d][0], r + dirs[d][1]);
            if (!n) continue;
            if (n.arch !== here.arch || n.tier !== here.tier) continue;
            if (here.tier >= BALANCE.tiers) continue; // потолок: выше некуда

            var topTier = here.tier + 1;

            setAt(grid, c, r, null);
            setAt(grid, c + dirs[d][0], r + dirs[d][1], null);

            setAt(grid, c, r, makeUnit(here.arch, topTier, c, r));
            merges++;
            again = true;
            break;
          }
          if (again) break;
        }
        if (again) break;
      }
    }

    return merges;
  }

  /* Копия поля целиком. Нужна для предпросмотра хода: игрок должен знать
     цену слияния ДО того, как поставил юнита, а не после. */
  function cloneGrid(grid) {
    var g = makeGrid();
    for (var r = 0; r < BALANCE.board.rows; r++) {
      for (var c = 0; c < BALANCE.board.cols; c++) {
        g[r][c] = grid[r][c] ? clone(grid[r][c]) : null;
      }
    }
    return g;
  }

  /* Сколько слияний вызовет постановка юнита в клетку. Считается на копии
     поля: настоящую доску трогать нельзя, это только прогноз. */
  function previewMerges(grid, arch, tier, col, row) {
    return placeAndMaybeMerge(cloneGrid(grid), makeUnit(arch, tier, col, row));
  }

  /* -------------------------------------------------------------------------
     ВЫБОР ЦЕЛИ. Сначала ближайший по манхэттену, при равенстве — с меньшим
     тиром (если preferLowTier). Иначе ИИ всегда бьёт в самый жирный юнит,
     и расстановка перестаёт что-то значить.
     ------------------------------------------------------------------------- */
  function chooseTarget(self, foes) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < foes.length; i++) {
      var f = foes[i];
      if (!f.alive) continue;
      var inRange = Math.abs(f.col - self.col) + Math.abs(f.row - self.row) <= self.range;
      if (!inRange) continue;
      var d = Math.abs(f.col - self.col) + Math.abs(f.row - self.row);
      if (d < bestD || (d === bestD && best && BALANCE.target.preferLowTier && f.tier < best.tier)) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  /* -------------------------------------------------------------------------
     ОДИН БОЙ.
     -------------------------------------------------------------------------
     Возвращает отчёт для отрисовки и, если нужно, полные логи для
     симуляции. Бой идёт тиками по BALANCE.tick и заканчивается, когда
     одна сторона пуста или истёк лимит тиков.
     ------------------------------------------------------------------------- */
  var MAX_TICKS = 400; // предохранитель от бесконечной ничьей

  function simulate(ownSquad, enemySquad, opts) {
    opts = opts || {};
    var collect = !!opts.log;
    var rng = opts.rng || makeRng(BALANCE.sim.seed);

    var a = ownSquad.map(clone);
    var b = enemySquad.map(clone);

    var log = [];
    var events = [];
    var ticks = 0;

    function note(tick, text, tone) {
      if (collect) log.push({ tick: tick, text: text, tone: tone || "" });
    }

    while (ticks < MAX_TICKS) {
      var aliveA = a.some(isAlive), aliveB = b.some(isAlive);
      if (!aliveA || !aliveB) break;

      // Все юниты обеих сторон атакуют в этом тике.
      // Очерёдность сторон внутри тика случайна. Раньше своя сторона
      // била всегда первой, и при равных юнитах исход решался не
      // характеристиками, а тем, кто ходит первым: зеркальный состав
      // давал 83–93% вместо честных пятидесяти.
      if (rng() < 0.5) {
        stepSide(a, b, ticks, rng, note, events, collect, "own");
        stepSide(b, a, ticks, rng, note, events, collect, "enemy");
      } else {
        stepSide(b, a, ticks, rng, note, events, collect, "enemy");
        stepSide(a, b, ticks, rng, note, events, collect, "own");
      }

      ticks++;
    }

    var aliveA2 = a.filter(isAlive).length;
    var aliveB2 = b.filter(isAlive).length;

    var winner = "draw";
    if (aliveA2 > 0 && aliveB2 === 0) winner = "win";
    else if (aliveB2 > 0 && aliveA2 === 0) winner = "loss";

    return {
      winner: winner,
      ticks: ticks,
      seconds: +(ticks * BALANCE.tick).toFixed(2),
      ownLeft: aliveA2,
      enemyLeft: aliveB2,
      log: log,
      events: events,
      survivors: a.filter(isAlive),
    };
  }

  function isAlive(u) { return u && u.alive; }

  /* Ближайший противник вообще — не только тот, что в досягаемости.
     Нужен для шага вперёд: если никто не в радиусе, юнит не стоит
     столбом, а сближается, иначе бой не заканчивается никогда. */
  function nearestFoe(self, foes) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < foes.length; i++) {
      var f = foes[i];
      if (!f.alive) continue;
      var d = Math.abs(f.col - self.col) + Math.abs(f.row - self.row);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  /* Шаг к цели: одна клетка по оси с наибольшей разницей.
     Манхэттенское приближение вместо векторного — юниты идут по клеткам,
     как и ходят на настоящем поле боя. */
  function advance(self, foes) {
    var t = nearestFoe(self, foes);
    if (!t) return false;
    var dc = t.col - self.col, dr = t.row - self.row;
    if (dc === 0 && dr === 0) return false;

    // При равенстве расстояний шагаем по горизонтали: так отряд
    // выстраивается в линию и не расползается по диагоналям.
    var nc = self.col, nr = self.row;
    if (Math.abs(dc) >= Math.abs(dr)) nc += Math.sign(dc);
    else nr += Math.sign(dr);

    if (nc < 0 || nc >= BALANCE.board.cols) { nc = self.col; nr += Math.sign(dr) || 1; }
    if (nr < 0 || nr >= BALANCE.board.rows) { nr = self.row; nc += Math.sign(dc) || 1; }
    if (nc === self.col && nr === self.row) return false;

    // Занятую клетку не занимаем: строй упирается в впереди стоящего
    // и упирается в него, а не проходит сквозь.
    var blocked = false;
    for (var i = 0; i < foes.length; i++) {
      if (foes[i].alive && foes[i].col === nc && foes[i].row === nr) { blocked = true; break; }
    }
    if (blocked) return false;

    self.col = nc;
    self.row = nr;
    return true;
  }

  function stepSide(side, foes, tickNo, rng, note, events, collect, sideId) {
    /* Порядок атаки внутри стороны перемешивается каждый тик.
       По фиксированному порядку первый юнит в массиве бьёт всегда, и на
       зеркальном составе исход решался не характеристиками, а тем, кто
       оказался в массиве первым: 83–93% вместо честных пятидесяти. */
    for (var i = side.length - 1; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var tmp = side[i]; side[i] = side[j]; side[j] = tmp;
    }

    for (var k = 0; k < side.length; k++) {
      var u = side[k];
      if (!u.alive) continue;

      if (u.cd > 0) { u.cd -= BALANCE.tick; continue; }

      var target = chooseTarget(u, foes);
      if (!target) {
        // Никого в радиусе — идём вперёд и ждём следующего тика.
        // Иначе бой упирается в MAX_TICKS и рисует ничью там,
        // где на самом деле должно быть решение по урону.
        advance(u, foes);
        u.cd = 1 / u.spd;
        continue;
      }

      var dmg = BALANCE.hit(u, target);
      target.hp -= dmg;
      u.cd = 1 / u.spd;

      if (collect && events) {
        events.push({
          tick: tickNo,
          side: sideId,
          from: { col: u.col, row: u.row },
          to: { col: target.col, row: target.row },
          amount: Math.round(dmg),
          dead: target.hp <= 0,
        });
      }

      if (target.hp <= 0) {
        target.alive = false;
        note(tickNo, translateKill(u, target), "kill");
      }
    }
  }

  /* Имена юнитов — короткие, чтобы лог читался. Берём архетип и тир,
     полное название используется в UI. */
  var SHORT = { melee: "Ближний", ranged: "Стрелок", mounted: "Конница", siege: "Осадная" };

  function translateKill(killer, victim) {
    return (SHORT[killer.arch] || killer.arch) + " T" + killer.tier +
      " убивает " + (SHORT[victim.arch] || victim.arch) + " T" + victim.tier;
  }

  /* -------------------------------------------------------------------------
     СБОР ПРОТИВНИКА.
     ---------------------------------------------------------------------------
     Тот же бюджет, что и у игрока, и то же правило слияния — иначе
     винрейт показывает разницу бюджетов, а не баланс архитектуры.
     ------------------------------------------------------------------------- */
  function buildOpponent(rng, budget, gridCols, gridRows) {
    var grid = makeGrid();
    var spent = 0;
    var guard = 0;

    /* Противник играет грамотно, а не случайно. Раньше он брал случайный
       тир, тратил дорогой ресурс впустую и проигрывал любому разбросу —
       и винрейт показывал не баланс, а его невнимательность.
       Теперь он набирает первый тир и позволяет слияниям случаться самим:
       это ровно то, что сделает внимательный человек, и теперь разницу
       в винрейте даёт именно состав игрока. */
    while (spent < budget && guard++ < 200) {
      var free = [];
      for (var r = 0; r < gridRows; r++) {
        for (var c = 0; c < gridCols; c++) {
          if (!gridAt(grid, c, r)) free.push({ col: c, row: r });
        }
      }
      if (!free.length) break;

      // Ставим рядом с уже занятыми клетками: отряд собирается плотным,
      // иначе слияния почти не случаются и противник остаётся россыпью.
      var anchor = listUnits(grid);
      var slot;
      if (anchor.length) {
        var near = anchor[Math.floor(rng() * anchor.length)];
        var cand = [
          { col: near.col + 1, row: near.row },
          { col: near.col - 1, row: near.row },
          { col: near.col, row: near.row + 1 },
          { col: near.col, row: near.row - 1 },
        ];
        slot = null;
        for (var k = 0; k < cand.length; k++) {
          if (cand[k].col >= 0 && cand[k].col < gridCols &&
              cand[k].row >= 0 && cand[k].row < gridRows &&
              !gridAt(grid, cand[k].col, cand[k].row)) {
            slot = cand[k];
            break;
          }
        }
      }
      if (!slot) slot = free[Math.floor(rng() * free.length)];

      var arch = pick(rng, BALANCE.order);
      var price = BALANCE.costFor(arch, 1);
      if (spent + price > budget) {
        // Дороже не помещается — ищем самый дешёвый архетип первого тира.
        var cheap = null;
        for (var q = 0; q < BALANCE.order.length; q++) {
          var p = BALANCE.costFor(BALANCE.order[q], 1);
          if (spent + p <= budget && (!cheap || p < cheap.p)) {
            cheap = { arch: BALANCE.order[q], p: p };
          }
        }
        if (!cheap) break;
        arch = cheap.arch;
        price = cheap.p;
      }

      spent += price;
      placeAndMaybeMerge(grid, makeUnit(arch, 1, slot.col, slot.row));
    }

    return { grid: grid, spent: spent, squad: listUnits(grid) };
  }

  /* -------------------------------------------------------------------------
     БАЗОВАЯ ЛИНИЯ ДЛЯ ВЕРДИКТА.
     ---------------------------------------------------------------------------
     Тот же профиль тиров, что и у эталона, но из ДРУГИХ архетипов.
     Разница в винрейте тогда показывает ровно одно: как архетипы соотносятся
     между собой. Поставил бы осадной юниту урон — и сразу видно, что
     выросло. Именно эту величину и имеет смысл обсуждать с рекрутером;
     случайный состав вместо этого мерил бы удачу разброса.
     ------------------------------------------------------------------------- */
  function baselineSquad() {
    var profile = ["ranged", "siege", "ranged", "siege"];
    var tiers = [2, 2, 1, 1];
    var squad = [];
    for (var i = 0; i < profile.length; i++) {
      squad.push(makeUnit(profile[i], tiers[i], i % BALANCE.board.cols, (i / BALANCE.board.cols) | 0));
    }
    var spent = 0;
    for (var j = 0; j < squad.length; j++) spent += squad[j].cost;
    return { squad: squad, spent: spent };
  }

  /* -------------------------------------------------------------------------
     ПРОГОН.
     ---------------------------------------------------------------------------
     Один и тот же сид — один и тот же результат. Это то, что отличает
     инструмент от гирляндки: вывод должен быть воспроизводимым, иначе
     спорить о балансе бессмысленно.
     ------------------------------------------------------------------------- */
  function runBatch(ownSquadFactory, battles, seed) {
    var rng = makeRng(seed == null ? BALANCE.sim.seed : seed);
    var wins = 0, losses = 0, draws = 0;
    var totalSeconds = 0;
    var totalTicks = 0;
    var histo = { win: 0, loss: 0, draw: 0 };

    for (var i = 0; i < battles; i++) {
      var own = ownSquadFactory();
      var budget = own.spent;
      var opp = buildOpponent(rng, budget, BALANCE.board.cols, BALANCE.board.rows);

      var res = simulate(own.squad, opp.squad, { rng: rng, log: false });
      totalSeconds += res.seconds;
      totalTicks += res.ticks;

      if (res.winner === "win") { wins++; histo.win++; }
      else if (res.winner === "loss") { losses++; histo.loss++; }
      else { draws++; histo.draw++; }
    }

    return {
      battles: battles,
      wins: wins,
      losses: losses,
      draws: draws,
      winrate: +(wins / battles * 100).toFixed(1),
      avgSeconds: +(totalSeconds / battles).toFixed(2),
      avgTicks: Math.round(totalTicks / battles),
      histogram: histo,
    };
  }

  /* -------------------------------------------------------------------------
     ПРОГОН ОТРЯД ПРОТИВ ОТРЯДА.
     ---------------------------------------------------------------------------
     Отдельный путь для вердикта. Здесь противник не собирается по бюджету:
     обе стороны получают один и тот же профиль тиров, различаются только
     архетипы. Иначе сравнение шло бы не по архитектуре, а по тому, у кого
     случайно выше энергия, и цифра означала бы совсем другое.
     ------------------------------------------------------------------------- */
  /* -------------------------------------------------------------------------
     ПРОГОН ОТРЯД ПРОТИВ ОТРЯДА.
     ---------------------------------------------------------------------------
     Отдельный путь для вердикта. Здесь противник не собирается по бюджету:
     обе стороны получают один и тот же профиль тиров, различаются только
     архетипы. Иначе сравнение шло бы не по архитектуре, а по тому, у кого
     случайно выше энергия, и цифра означала бы совсем другое.

     Прогон разбит на шаги: страница крутит его по кадрам и не подвисает.
     Логика раскладки живёт здесь, а не в интерфейсе — одна копия правил.
     Раньше копия завелась в интерфейсе, и там обе стороны вставали в одни
     клетки: винрейт выходил ровно 100% вместо честных пятидесяти.
     ------------------------------------------------------------------------- */
  function makeBatchVs(ownFactory, enemyFactory, battles, seed) {
    var rng = makeRng(seed == null ? BALANCE.sim.seed : seed);
    var done = 0, wins = 0, losses = 0, draws = 0, seconds = 0, ticks = 0;

    /* Раскладка на противоположные половины поля. */
    function layout(squad, side) {
      var slots = [];
      for (var c = 0; c < BALANCE.board.cols; c++) {
        for (var r = 0; r < BALANCE.board.rows; r++) slots.push({ c: c, r: r });
      }
      // Перемешивание детерминированное: тот же сид — та же раскладка.
      for (var i = slots.length - 1; i > 0; i--) {
        var j = (rng() * (i + 1)) | 0;
        var t = slots[i]; slots[i] = slots[j]; slots[j] = t;
      }
      var half = Math.ceil(slots.length / 2);
      var ownSlots = slots.slice(0, half);
      var foeSlots = slots.slice(half);
      var bank = side === 0 ? ownSlots : foeSlots;
      var out = [];
      for (var k = 0; k < squad.length; k++) {
        var u = clone(squad[k]);
        var pos = bank[k % bank.length];
        u.col = pos.c;
        u.row = pos.r;
        out.push(u);
      }
      return out;
    }

    function oneBattle() {
      var own = layout(ownFactory().squad, 0);
      var foe = layout(enemyFactory().squad, 1);
      var res = simulate(own, foe, { rng: rng, log: false });
      seconds += res.seconds;
      ticks += res.ticks;
      if (res.winner === "win") wins++;
      else if (res.winner === "loss") losses++;
      else draws++;
      done++;
    }

    function result() {
      return {
        battles: battles,
        wins: wins, losses: losses, draws: draws,
        winrate: done ? +(wins / done * 100).toFixed(1) : 0,
        avgSeconds: done ? +(seconds / done).toFixed(2) : 0,
        avgTicks: done ? Math.round(ticks / done) : 0,
        progress: done / battles,
        histogram: { win: wins, loss: losses, draw: draws },
      };
    }

    /* Крутит бои, пока не кончится бюджет времени. Вызывать по кадрам. */
    function step(maxMs) {
      var start = Date.now();
      while (done < battles && (Date.now() - start) < (maxMs || 12)) oneBattle();
      return done >= battles;
    }

    return { step: step, result: result, get done() { return done; } };
  }

  /* Синхронная обёртка — для тестов и для мест, где ждать некуда. */
  function runBatchVs(ownFactory, enemyFactory, battles, seed) {
    var run = makeBatchVs(ownFactory, enemyFactory, battles, seed);
    while (!run.step(1e9)) { /* крутим до конца */ }
    return run.result();
  }

  /* -------------------------------------------------------------------------
     ОТЧЁТ ПО БАЛАНСУ.
     ---------------------------------------------------------------------------
     Считает три вещи: время до убийства по тирам, кривую урона и
     стоимость мержа. Всё — из текущих значений BALANCE, поэтому правка
     таблицы честно отражается в выводе.
     ------------------------------------------------------------------------- */
  function analyse() {
    var ttk = [], dmg = [], cost = [];
    var worstTTK = 0;

    for (var t = 1; t <= BALANCE.tiers; t++) {
      // TTK: равный по тиру противник — эталонный бой.
      // Берём среднее по всем архетипам: один плохой архетип не должен
      // портить оценку кривой целиком.
      var sumSec = 0, n = 0;
      for (var ai = 0; ai < BALANCE.order.length; ai++) {
        var arch = BALANCE.order[ai];
        var a = makeUnit(arch, t, 1, 1);
        var b = makeUnit(arch, t, 2, 1);
        var r = simulate([a], [b], { rng: makeRng(t * 1000 + ai), log: false });
        sumSec += r.seconds; n++;
      }
      var avg = +(sumSec / n).toFixed(2);
      if (avg > worstTTK) worstTTK = avg;
      ttk.push({ tier: t, seconds: avg });

      // Средний урон и стоимость по тиру — тоже среднее по архетипам.
      var sumAtk = 0, sumCost = 0;
      for (var aj = 0; aj < BALANCE.order.length; aj++) {
        var s = BALANCE.statsFor(BALANCE.order[aj], t);
        sumAtk += s.atk;
        sumCost += BALANCE.costFor(BALANCE.order[aj], t);
      }
      dmg.push({ tier: t, atk: Math.round(sumAtk / BALANCE.order.length) });
      cost.push({ tier: t, price: Math.round(sumCost / BALANCE.order.length) });
    }

    return { ttk: ttk, dmg: dmg, cost: cost, worstTTK: worstTTK };
  }

  /* Вердикт. Формулировка не «хорошо/плохо», а что именно сломалось:
     именно это отличает вывод геймдизайнера от ощущения. */
  function verdictFor(batch, report) {
    var th = BALANCE.thresholds;
    var w = batch.winrate;
    var notes = [];

    if (w < th.winMin) {
      notes.push({
        tone: "bad",
        text: "Винрейт " + w + "% — ниже коридора " + th.winMin + "–" + th.winMax +
          "%. Эталонный отряд проигрывает базовой линии чаще, чем выигрывает: " +
          "поднимите урон или здоровье ближнего боя и конницы.",
      });
    } else if (w > th.winMax) {
      notes.push({
        tone: "bad",
        text: "Винрейт " + w + "% — выше коридора " + th.winMin + "–" + th.winMax +
          "%. Эталонный отряд выигрывает почти всегда: стрелок и осадная в таком " +
          "составе уже не могут ответить — усильте их или ослабьте смежные.",
      });
    } else {
      notes.push({
        tone: "good",
        text: "Винрейт " + w + "% лежит в коридоре " + th.winMin + "–" + th.winMax +
          "%. Архетипы соразмерены: эталон выигрывает примерно столько же, сколько " +
          "проигрывает, и исход боя решает расстановка, а не цифры.",
      });
    }

    if (report.worstTTK > th.ttkMax) {
      notes.push({
        tone: "warn",
        text: "Самый долгий бой — " + report.worstTTK + " с, это выше " + th.ttkMax +
          " с. Верхние тиры слишком живучие: бой вязнет, зритель теряет интерес.",
      });
    } else if (report.worstTTK < th.ttkMin) {
      notes.push({
        tone: "warn",
        text: "Самый долгий бой — " + report.worstTTK + " с, это ниже " + th.ttkMin +
          " с. Бой заканчивается быстрее, чем его успевают прочитать.",
      });
    } else {
      notes.push({
        tone: "good",
        text: "Длительность боя в норме: худший случай " + report.worstTTK +
          " с, коридор " + th.ttkMin + "–" + th.ttkMax + " с.",
      });
    }

    // Рост урона должен быть плавным. Ступенька вверх между тирами —
    // это момент, где новый юнит ломает стратегии, собранные под старый.
    var jumps = [];
    for (var i = 1; i < report.dmg.length; i++) {
      var prev = report.dmg[i - 1].atk, cur = report.dmg[i].atk;
      jumps.push(prev ? +((cur / prev - 1) * 100).toFixed(0) : 0);
    }
    var maxJump = Math.max.apply(null, jumps);
    if (maxJump > 55) {
      notes.push({
        tone: "warn",
        text: "Урон между тирами скачет на " + maxJump + "% — слишком круто. " +
          "Между этими тирами один юнит ломает все стратегии, собранные под предыдущий.",
      });
    } else {
      notes.push({
        tone: "good",
        text: "Рост урона плавный: максимальный шаг между тирами — " + maxJump + "%.",
      });
    }

    var tone = notes.some(function (n) { return n.tone === "bad"; }) ? "bad"
      : notes.some(function (n) { return n.tone === "warn"; }) ? "warn" : "good";

    return { tone: tone, notes: notes, jumps: jumps };
  }

  /* -------------------------------------------------------------------------
     ЭТАЛОННЫЙ ОТРЯД.
     ---------------------------------------------------------------------------
     Вердикт считается не по тому, что игрок собрал, а по фиксированному
     тестовому отряду. Причина простая: винрейт зависит от состава так
     сильно, что случайная расстановка даёт разброс в десятки процентов, и
     цифра перестаёт что-либо значить.

     Настоящий прогон баланса выглядит именно так: есть эталонный состав,
     есть базовая линия, есть цифра, которую можно сравнить с прошлой сборкой.
     Игровой бой на вкладке «Бой» остаётся свободным — там важно, чтобы
     было интересно, а не чтобы цифра была повторяемой.
     ------------------------------------------------------------------------- */
  /* Эталон и базовая линия делят поле пополам по архетипам: слева ближний
     бой и конница, справа стрелок и осадная. Все четыре класса задействованы,
     и правка любого из них в таблице двигает цифру — иначе метрика ничего
     бы не измеряла. Профиль тиров у сторон одинаковый (2, 2, 1, 1). */
  var BENCHMARK = [["melee", 2], ["mounted", 2], ["melee", 1], ["mounted", 1]];

  function benchmarkSquad() {
    var squad = [];
    for (var i = 0; i < BENCHMARK.length; i++) {
      squad.push(makeUnit(BENCHMARK[i][0], BENCHMARK[i][1], i % BALANCE.board.cols, (i / BALANCE.board.cols) | 0));
    }
    var spent = 0;
    for (var j = 0; j < squad.length; j++) spent += squad[j].cost;
    return { squad: squad, spent: spent };
  }

  return {
    makeRng: makeRng,
    makeUnit: makeUnit,
    makeGrid: makeGrid,
    gridAt: gridAt,
    setAt: setAt,
    listUnits: listUnits,
    countUnits: countUnits,
    canPlace: canPlace,
    placeAndMaybeMerge: placeAndMaybeMerge,
    previewMerges: previewMerges,
    mergeCostFor: BALANCE.mergeCostFor,
    simulate: simulate,
    buildOpponent: buildOpponent,
    runBatch: runBatch,
    runBatchVs: runBatchVs,
    makeBatchVs: makeBatchVs,
    benchmarkSquad: benchmarkSquad,
    baselineSquad: baselineSquad,
    analyse: analyse,
    verdictFor: verdictFor,
    SHORT: SHORT,
  };
})();