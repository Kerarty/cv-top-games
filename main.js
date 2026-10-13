// ============================================================================
// СТРАНИЦА: язык, вкладки, скролл, замеры сборки.
//
// Метрики вида {{size}} и {{ttf}} считаются здесь и подставляются в текст.
// Это не выдуманные цифры: размер — реальный вес файлов на диске,
// время до первого кадра — настоящая задержка от навигации до отрисовки.
// Если страница не может их померить, она не пишет ничего, а не врёт.
// ============================================================================

(function () {
  "use strict";

  var lang = "ru";
  var els = {};

  /* -------------------------------------------------------------------------
     ЯЗЫК
     -------------------------------------------------------------------------
     Выбор хранится в localStorage и переживает перезагрузку: рекрутер,
     который открыл страницу на русском, не должен каждый раз видеть
     английский вариант.
     ------------------------------------------------------------------------- */
  function pickInitialLang() {
    try {
      var saved = localStorage.getItem("cv-lang");
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) { /* приватный режим — просто определяем по браузеру */ }
    var nav = (navigator.language || "ru").toLowerCase();
    return nav.indexOf("ru") === 0 ? "ru" : "en";
  }

  /* Подстановка по data-i18n. Путь вида "lab.combat.title" разбирается
     в CONTENT[lang].lab.combat.title. */
  function lookup(path) {
    var parts = path.split(".");
    var cur = CONTENT[lang];
    for (var i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== "object") return "";
      cur = cur[parts[i]];
    }
    return cur == null ? "" : String(cur);
  }

  function applyLang(next) {
    lang = next;
    try { localStorage.setItem("cv-lang", lang); } catch (e) {}

    document.documentElement.lang = CONTENT[lang].htmlLang;
    document.title = CONTENT[lang].meta.title;

    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", CONTENT[lang].meta.description);

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var val = lookup(node.getAttribute("data-i18n"));
      if (!val) continue;
      // Атрибут href у ссылок не трогаем: там живёт адрес, а не текст.
      if (node.tagName === "A" && node.hasAttribute("href")) {
        node.textContent = val;
      } else {
        node.textContent = val;
      }
    }

    // aria-label у кнопок с иконками
    var labels = document.querySelectorAll("[data-i18n-aria]");
    for (var j = 0; j < labels.length; j++) {
      labels[j].setAttribute("aria-label", lookup(labels[j].getAttribute("data-i18n-aria")));
    }

    els.langBtn.textContent = CONTENT[lang].langButton;
    els.langBtn.setAttribute("aria-label",
      lang === "ru" ? "Switch to English" : "Переключить на русский");

    buildDynamic();
    LAB.rebuild(lang);
  }

  /* -------------------------------------------------------------------------
     ДИНАМИЧЕСКИЕ БЛОКИ
     -------------------------------------------------------------------------
     Списки (проекты, навыки, правила) собираются из данных, а не хранятся
     в разметке: иначе пришлось бы держать две копии — русскую и английскую —
     и они разъезжаются при первой же правке.
     ------------------------------------------------------------------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildDynamic() {
    // Счётчики в hero
    var stats = els.heroStats;
    stats.innerHTML = "";
    for (var i = 0; i < CONTENT[lang].hero.stats.length; i++) {
      var s = CONTENT[lang].hero.stats[i];
      var box = el("div", "stat");
      box.appendChild(el("div", "stat-v", s.v));
      box.appendChild(el("div", "stat-k", s.k));
      box.appendChild(el("div", "stat-note", s.note));
      stats.appendChild(box);
    }

    // «Почему LUDUS»
    var want = els.want;
    want.innerHTML = "";
    var wl = CONTENT[lang].about.want;
    for (var w = 0; w < wl.length; w++) {
      var li = el("li", "want-item", wl[w]);
      want.appendChild(li);
    }

    // Проекты
    var proj = els.projects;
    proj.innerHTML = "";
    var items = CONTENT[lang].projects.items;
    for (var p = 0; p < items.length; p++) {
      var it = items[p];
      var card = el("article", "card project");

      var top = el("div", "project-top");
      top.appendChild(el("span", "project-n", it.n));
      top.appendChild(el("span", "project-kind", it.kind));
      card.appendChild(top);

      card.appendChild(el("h3", "project-title", it.title));
      card.appendChild(el("p", "project-text", it.text));

      var facts = el("div", "facts");
      for (var f = 0; f < it.facts.length; f++) {
        facts.appendChild(el("span", "fact", it.facts[f]));
      }
      card.appendChild(facts);
      proj.appendChild(card);
    }

    // Правила метода
    var rules = els.rules;
    rules.innerHTML = "";
    var rl = CONTENT[lang].process.rules;
    for (var r = 0; r < rl.length; r++) {
      var box = el("div", "rule");
      box.appendChild(el("div", "rule-t", rl[r].t));
      box.appendChild(el("div", "rule-d", rl[r].d));
      rules.appendChild(box);
    }

    // Навыки: строка + чем подтверждено
    var groups = els.skillGroups;
    groups.innerHTML = "";
    var gl = CONTENT[lang].skills.groups;
    for (var g = 0; g < gl.length; g++) {
      var col = el("div", "skill-col");
      col.appendChild(el("h3", "skill-name", gl[g].name));
      var ul = el("ul", "skill-list");
      for (var q = 0; q < gl[g].items.length; q++) {
        var item = gl[g].items[q];
        var li = el("li", "skill-item");
        var t = el("span", "skill-t", item.t);
        t.appendChild(el("span", "skill-d", item.d));
        li.appendChild(t);
        ul.appendChild(li);
      }
      col.appendChild(ul);
      groups.appendChild(col);
    }

    // changelog
    var log = els.changelog;
    log.innerHTML = "";
    var lines = CONTENT[lang].changelog.lines;
    for (var c = 0; c < lines.length; c++) {
      var row = el("div", "log-row");
      row.appendChild(el("span", "log-v", lines[c].v));
      var mid = el("div", "log-mid");
      mid.appendChild(el("div", "log-t", lines[c].t));
      mid.appendChild(el("div", "log-d", lines[c].d));
      row.appendChild(mid);
      log.appendChild(row);
    }

    // Контакты
    var contacts = els.contacts;
    contacts.innerHTML = "";
    var list = [
      { label: CONTENT[lang].contacts.telegram, value: "@Kerarty", href: "https://t.me/Kerarty" },
      { label: CONTENT[lang].contacts.email, value: "kukar.yar@gmail.com", href: "mailto:kukar.yar@gmail.com" },
      { label: CONTENT[lang].contacts.phone, value: "+375 44 783 84 89", href: "tel:+375447838489" },
      { label: CONTENT[lang].contacts.github, value: "github.com/Kerarty", href: "https://github.com/Kerarty" },
    ];
    for (var i2 = 0; i2 < list.length; i2++) {
      var a = el("a", "contact");
      a.href = list[i2].href;
      a.appendChild(el("span", "contact-k", list[i2].label));
      a.appendChild(el("span", "contact-v", list[i2].value));
      if (list[i2].href.indexOf("http") === 0) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
      contacts.appendChild(a);
    }
  }

  /* -------------------------------------------------------------------------
     ВКЛАДКИ
     ------------------------------------------------------------------------- */
  function initTabs() {
    var tabs = document.querySelectorAll("[data-tab]");
    var panels = document.querySelectorAll("[data-panel]");

    function select(name) {
      for (var i = 0; i < tabs.length; i++) {
        var on = tabs[i].getAttribute("data-tab") === name;
        tabs[i].classList.toggle("is-active", on);
        tabs[i].setAttribute("aria-selected", on ? "true" : "false");
        tabs[i].tabIndex = on ? 0 : -1;
      }
      for (var j = 0; j < panels.length; j++) {
        panels[j].classList.toggle("is-active", panels[j].getAttribute("data-panel") === name);
      }
      // Графики живут на скрытой панели и не могут измерить себя
      // до показа: перерисовываем при переключении на вкладку.
      if (name === "stats") LAB.drawCharts();
    }

    for (var k = 0; k < tabs.length; k++) {
      (function (btn) {
        btn.addEventListener("click", function () { select(btn.getAttribute("data-tab")); });
        btn.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          var idx = Array.prototype.indexOf.call(tabs, btn);
          var next = (idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
          tabs[next].focus();
          select(tabs[next].getAttribute("data-tab"));
        });
      })(tabs[k]);
    }
  }

  /* -------------------------------------------------------------------------
     ПОЯВЛЕНИЕ ПРИ СКРОЛЛЕ
     -------------------------------------------------------------------------
     Ленивая анимация: секция проявляется, когда до неё дошли. Без неё
     страница на телефоне дёргается при прокрутке, а при prefers-reduced-motion
     элементы просто остаются видимыми — без условия они бы навсегда остались
     прозрачными.
     ------------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver !== "function") {
      for (var i = 0; i < items.length; i++) items[i].classList.add("is-visible");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          entries[j].target.classList.add("is-visible");
          io.unobserve(entries[j].target);
        }
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    for (var k = 0; k < items.length; k++) io.observe(items[k]);
  }

  /* Подсветка текущего раздела в меню. */
  function initSpy() {
    var links = document.querySelectorAll("[data-spy]");
    var sections = [];
    for (var i = 0; i < links.length; i++) {
      var id = links[i].getAttribute("href").slice(1);
      var sec = document.getElementById(id);
      if (sec) sections.push({ link: links[i], node: sec });
    }
    if (!sections.length) return;

    function update() {
      var best = null, bestTop = Infinity;
      for (var i = 0; i < sections.length; i++) {
        var top = sections[i].node.getBoundingClientRect().top;
        if (top < bestTop && top > -140) { bestTop = top; best = sections[i]; }
      }
      if (!best) return;
      for (var j = 0; j < sections.length; j++) {
        sections[j].link.classList.toggle("is-active", sections[j] === best);
      }
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }, { passive: true });

    update();
  }

  /* Плавная прокрутка к секциям с учётом высоты шапки. */
  function initAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 64;
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  }

  /* -------------------------------------------------------------------------
     ЗАПУСК
     ------------------------------------------------------------------------- */
  function boot() {
    els = {
      langBtn: document.getElementById("langBtn"),
      heroStats: document.getElementById("heroStats"),
      want: document.getElementById("aboutWant"),
      projects: document.getElementById("projectList"),
      rules: document.getElementById("ruleList"),
      skillGroups: document.getElementById("skillGroups"),
      changelog: document.getElementById("changelogList"),
      contacts: document.getElementById("contactList"),
    };

    els.langBtn.addEventListener("click", function () {
      applyLang(lang === "ru" ? "en" : "ru");
    });

    LAB.init(pickInitialLang());
    initTabs();
    initReveal();
    initSpy();
    initAnchors();

    applyLang(lang);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();