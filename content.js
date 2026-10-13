/* ============================================================================
   КОНТЕНТ резюме. Весь текст — и русский, и английский — живёт здесь.
   Код его не дублирует: правишь этот файл, страница меняется.
   ---------------------------------------------------------------------------
   Ключи обращаются как CONTENT.ru.hero.title, в разметке — data-i18n="hero.title".
   Числа, которые меняются от прогона к прогону, помечены шаблоном {{...}}.
   ========================================================================== */

var CONTENT = {
  /* --------------------------------------------------------------------------
     РУССКИЙ
     -------------------------------------------------------------------------- */
  ru: {
    langButton: "EN",
    htmlLang: "ru",
    role: "геймдизайнер · баланс систем",

    meta: {
      title: "Ярослав Кукар — геймдизайнер, баланс систем",
      description:
        "Интерактивное резюме геймдизайнера: рабочий баланс-тюнер merge-автобатлера " +
        "в браузере. Симулятор боёв, редактируемая таблица характеристик, графики " +
        "TTK и винрейта. Отклик на вакансию Game Designer в Top App Games.",
    },

    nav: {
      hero: "Отклик",
      lab: "Баланс-лаборатория",
      about: "О себе",
      education: "Образование",
      projects: "Проекты",
      process: "Метод",
      skills: "Навыки",
      contacts: "Контакты",
      text: "Резюме текстом",
    },

    langs: {
      native: "Русский — родной",
      english: "Английский — A2, продолжаю",
    },

    hero: {
      kicker: "Отклик на вакансию Game Designer · Top App Games",
      title: "Считаю баланс, а не описываю его",
      sub:
        "Ниже — не список достижений, а рабочий инструмент: merge-автобатлер, " +
        "который можно собрать руками, посмотреть в бою и пересчитать. " +
        "Каждая цифра в нём подписана — почему именно столько и что она проверяет.",
      cta: "Открыть лабораторию",
      ctaAlt: "Сначала почитать",
      stats: [
        { k: "Плейтестов", v: "15+", note: "итераций по циклу разбора" },
        { k: "Фракций", v: "4", note: "с балансом юнитов между ними" },
        { k: "Симуляций боя", v: "1000", note: "прогоняется прямо здесь" },
      ],
    },

    lab: {
      heading: "Баланс-лаборатория",
      lead:
        "Три вкладки смотрят в одну модель данных: правка характеристики в таблице " +
        "мгновенно меняет юнита в бою и перестраивает графики. Так же устроен настоящий " +
        "пайплайн — источник правды один.",
      tabs: {
        combat: "Бой",
        table: "Таблица",
        stats: "Графики",
      },
      combat: {
        title: "Соберите отряд и запустите бой",
        text:
          "Нажмите на юнита, чтобы поставить его в клетку. Два одинаковых рядом " +
          "сливаются в юнит тира выше — это и есть механика, вокруг которой " +
          "построена экономика. Потратив всю энергию, нажмите «В бой».",
        energy: "Энергия",
        buy: "Поставить юнита",
        merge: "Слить два одинаковых",
        fight: "В бой",
        reset: "Сбросить",
        enemy: "Противник",
        you: "Ваш отряд",
        tier: "Тир",
        waiting: "Расставьте юнитов и нажмите «В бой»",
        victory: "Победа",
        defeat: "Поражение",
        log: "Ход боя",
        prompt: "Нажмите на юнита, чтобы поставить его в клетку",
        mergeHint: "Два одинаковых рядом сольются в юнит тира выше",
        none: "Отряд пуст",
      },
      table: {
        title: "Таблица характеристик",
        text:
          "Правьте числа прямо в ячейках — они не картинка, а рабочая таблица. " +
          "Изменение сразу видно в бою и на графиках. Это тот же способ, которым " +
          "балансируют в Google Sheets, только правая кнопка рядом.",
        reset: "Вернуть исходные значения",
        export: "Скопировать таблицу",
        copied: "Скопировано",
        note:
          "Правка одной характеристики меняет весь расклад: юнит в бою, кривые " +
          "на графиках и вердикт по винрейту пересчитываются одновременно.",
      },
      stats: {
        title: "Что с этим балансом",
        text:
          "Графики пересчитываются по текущим значениям таблицы. Метка вердикта " +
          "объясняет, что именно сломалось и какое значение это чинит.",
        run: "Симулировать 1000 боёв",
        running: "Считаю…",
        runNote:
          "Прогон сравнивает эталонный отряд с базовой линией: у обеих сторон " +
          "одинаковый профиль тиров, но разные архетипы — ближний бой с конницей " +
          "против стрелка с осадной. Так винрейт измеряет одно: как архетипы " +
          "соотносятся между собой. Случайный состав вместо этого мерил бы " +
          "разброс тиров, а его разброс достигает десятков процентов.",
        ttk: "Время до убийства",
        dmg: "Урон по тирам",
        cost: "Кривая стоимости",
        winrate: "Винрейт",
        verdict: "Вердикт",
        hist: "Распределение исходов",
        win: "Победа",
        loss: "Поражение",
        draw: "Ничья",
        sample: "выборка",
        ttkNote:
          "Показывает, сколько длится бой против равного по тиру противника. " +
          "Схлопывание кривой означает, что высокие тиры умирают слишком быстро.",
        dmgNote:
          "Рост урона по тирам должен быть плавным. Ступенька вверх — это " +
          "момент, где новый юнит ломает старые стратегии.",
        costNote:
          "Стоимость мержа растёт быстрее силы юнита — иначе играть выгодно " +
          "только в одном тире. Кривая обязана быть крутой.",
      },
      units: {
        melee: "Ближний бой",
        ranged: "Стрелок",
        mounted: "Конница",
        siege: "Осадная",
      },
      params: {
        hp: "Здоровье",
        atk: "Атака",
        def: "Защита",
        spd: "Скорость",
        crit: "Крит",
        cost: "Энергия",
      },
    },

    about: {
      heading: "О себе",
      lead:
        "Начинающий геймдизайнер с профильным техническим образованием в игровой " +
        "индустрии. Хорошо понимаю основные игровые механики и особенно интересуюсь " +
        "балансом боевых характеристик, экономикой и влиянием изменений на игровой процесс.",
      body:
        "Имею аналитический и системный склад мышления, техническую базу в " +
        "программировании и работе с данными. Самостоятельно изучаю геймдизайн, " +
        "баланс и анализ игровых систем и развиваю собственные проекты. " +
        "Техническое образование позволяет понимать взаимосвязь между дизайном " +
        "механики и её реализацией, а опыт тестирования — системно искать " +
        "проблемы и проверять изменения, а не гадать, что именно сломалось.",
      gap:
        "Коммерческого опыта в геймдизайне пока нет — и это честно. Зато есть " +
        "привычка доводить: три законченных проекта, один из них с пятнадцатью " +
        "плейтест-сессиями и итеративной балансировкой по итогам каждой. " +
        "Лаборатория выше — тот же цикл работы, просто сделанный настолько, " +
        "чтобы его можно было проверить руками.",
      wantTitle: "Почему LUDUS",
      want: [
        "Мерж-автобатлер — это ровно та петля, которую я разбирал в «Королевствах Эридора»: слияние, ресурс, решение по цене и силе",
        "Студия публикует метрики и разбирает игровые решения открыто — такой подход мне близок",
        "Проект в продакшене, а не в прототипе: значит решения принимаются под нагрузкой на живых игроках",
      ],
    },

    education: {
      heading: "Образование",
      degree: "Белорусский государственный университет информатики и радиоэлектроники",
      field: "Информационные системы и технологии в игровой индустрии",
      degreeShort: "Бакалавр, инженер-программист",
      years: "2023 — 2027",
      lead:
        "Специальность на стыке инженерии и игровой индустрии: часть программы — " +
        "программирование и работа с данными, часть — игровые системы. " +
        "Поэтому проектирование механики я сразу считаю вместе с реализацией, " +
        "а не «нарисую и передам в разработку».",
      langsTitle: "Языки",
    },

    projects: {
      heading: "Проекты",
      items: [
        {
          n: "01",
          title: "Концепт-документ компьютерной игры",
          kind: "GDD · стратегия с элементами градостроительного симулятора",
          text:
            "Описал игровые механики, прогрессию, баланс ресурсов и арт-стиль. " +
            "Документ структурирован под передачу в команду разработки: разделы идут " +
            "в том порядке, в котором их читают.",
          facts: ["Механики и прогрессия", "Баланс ресурсов", "Арт-стиль"],
        },
        {
          n: "02",
          title: "«Королевства Эридора» — настольная тактика",
          kind: "Варгейм · пошаговая стратегия на 4 фракции",
          text:
            "Спроектировал с нуля: боевые механики, захват территорий, баланс юнитов. " +
            "Провёл 15+ плейтест-сессий, собирал обратную связь и итеративно правил " +
            "характеристики — по тому же циклу, что и разбор события после релиза.",
          facts: ["4 фракции", "15+ плейтестов", "Итеративный баланс"],
        },
        {
          n: "03",
          title: "Unity-проект с производственными механиками",
          kind: "Собственная разработка · Unity",
          text:
            "Система заказов, производственные цепочки и несколько игровых локаций, " +
            "где игрок считывает следующее действие из сцены. Дополнительно — " +
            "небольшой браузерный игровой прототип.",
          facts: ["Система заказов", "Производственные цепочки", "Несколько локаций"],
        },
      ],
    },

    process: {
      heading: "Как я принимаю решения",
      lead:
        "Каждое число в проекте имеет причину, и она записана рядом с ним — " +
        "чтобы через полгода можно было вспомнить, что именно проверялось.",
      rules: [
        {
          t: "Одно изменение — одно наблюдение",
          d: "Правлю две вещи разом и не пойму, что сработало. Это медленнее, зато вывод не врёт.",
        },
        {
          t: "Сначала дёшево",
          d: "Бумага и прототип до того, как что-то полируется. Дорогую работу не начинаю, пока не знаю, что идея вообще работает.",
        },
        {
          t: "Глаз не считается проверкой",
          d: "«Мне кажется, так лучше» — не аргумент. Аргумент — замер и разница до и после.",
        },
      ],
      exampleTitle: "Пример из прототипа",
      exampleBody:
        "В башенном прототипе башня крутилась со скоростью 63°/s. Играть было " +
        "неудобно: курс менялся быстрее, чем игрок успевал оценить, куда встала " +
        "машина. Снизил до 40°/s — разворот читается, но с весом. Одно число, " +
        "одно наблюдение, один комментарий в коде.",
    },

    skills: {
      heading: "Навыки",
      lead: "Каждая строка — не самооценка, а то, чем это подтверждено.",
      groups: [
        {
          name: "Баланс и системы",
          items: [
            { t: "Боевой баланс по TTK и DPS", d: "разобрано на графиках выше" },
            { t: "Экономика ресурсов и кривые стоимости", d: "модель мержа и энергии в лаборатории" },
            { t: "Математика, теория вероятностей, статистика", d: "профильная специальность" },
            { t: "Симуляция и прогноз винрейта", d: "1000 боёв по кнопке" },
          ],
        },
        {
          name: "Реализация",
          items: [
            { t: "Unity", d: "собственный проект с производственными механиками" },
            { t: "C#, C++, JavaScript", d: "прототипы и эта страница целиком" },
            { t: "SQL, работа с данными", d: "разбор логов и метрик" },
            { t: "Excel / Google Sheets", d: "баланс-таблицы, версии, история правок" },
          ],
        },
        {
          name: "Документация",
          items: [
            { t: "GDD под передачу в разработку", d: "концепт-документ, проект 01" },
            { t: "Обоснование каждого числа", d: "комментарий рядом с параметром" },
            { t: "Git", d: "история решений видна в коммитах" },
            { t: "Таск-трекеры", d: "задачи, статусы, приоритеты" },
          ],
        },
      ],
    },

    contacts: {
      heading: "Давайте познакомимся",
      sub: "Готов к любому формату: звонок, созвон или тестовое прямо из переписки.",
      telegram: "Telegram",
      email: "Почта",
      phone: "Телефон",
      github: "GitHub",
      note: "Работа удалённая, часовой пояс UTC+3 — студия в пяти часовых поясах, сходимся легко.",
      pdf: "Сохранить в PDF",
    },

    changelog: {
      heading: "changelog",
      lead: "Резюме как релиз. Каждая строка — что изменилось и зачем.",
      lines: [
        { v: "v0.4", t: "Бой показан целиком: противник на своём поле, полосы здоровья, урон по тикам", d: "результат без процесса ничего не доказывает" },
        { v: "v0.3", t: "Добавлен прогон 1000 боёв и вердикт по винрейту", d: "визуализация проблемы" },
        { v: "v0.2", t: "Таблица характеристик стала редактируемой", d: "проверка гипотез руками, а не на словах" },
        { v: "v0.1", t: "Первая версия лаборатории: сетка, мерж, бой по тикам", d: "показать, как считается баланс" },
      ],
    },

    footer: {
      note: "Сделано без фреймворков и без сборки — весь код в шести файлах.",
      backToTop: "Наверх",
    },
  },

  /* --------------------------------------------------------------------------
     ENGLISH
     -------------------------------------------------------------------------- */
  en: {
    langButton: "RU",
    htmlLang: "en",
    role: "game designer · systems balance",

    meta: {
      title: "Yaroslav Kukar — game designer, systems balance",
      description:
        "An interactive game designer's resume: a working balance tuner for a " +
        "merge-autobattler in the browser. Combat simulation, an editable stats " +
        "table, TTK and winrate charts. Applying for Game Designer at Top App Games.",
    },

    nav: {
      hero: "Application",
      lab: "Balance lab",
      about: "About",
      education: "Education",
      projects: "Projects",
      process: "Method",
      skills: "Skills",
      contacts: "Contacts",
      text: "Résumé as text",
    },

    langs: {
      native: "Russian — native",
      english: "English — A2, in progress",
    },

    hero: {
      kicker: "Applying for Game Designer · Top App Games",
      title: "I calculate the balance instead of describing it",
      sub:
        "Below is not a list of achievements but a working tool: a merge-autobattler " +
        "you can build by hand, watch in combat and recalculate. Every number in it " +
        "is annotated — why exactly this value, and what it is testing.",
      cta: "Open the lab",
      ctaAlt: "Read it first",
      stats: [
        { k: "Playtests", v: "15+", note: "iterations through the review cycle" },
        { k: "Factions", v: "4", note: "with unit balance between them" },
        { k: "Combat sims", v: "1000", note: "runs right here" },
      ],
    },

    lab: {
      heading: "Balance lab",
      lead:
        "Three tabs read from one data model: editing a stat in the table instantly " +
        "changes the unit in combat and redraws the charts. That is how a real " +
        "pipeline works — there is a single source of truth.",
      tabs: {
        combat: "Combat",
        table: "Table",
        stats: "Charts",
      },
      combat: {
        title: "Build a squad and start a fight",
        text:
          "Tap a unit to place it on the grid. Two identical units next to each " +
          "other merge into one of a higher tier — that is the mechanic the whole " +
          "economy is built around. Once you have spent your energy, press “Fight”.",
        energy: "Energy",
        buy: "Place unit",
        merge: "Merge two identical",
        fight: "Fight",
        reset: "Reset",
        enemy: "Opponent",
        you: "Your squad",
        tier: "Tier",
        waiting: "Place your units and press “Fight”",
        victory: "Victory",
        defeat: "Defeat",
        log: "Combat log",
        prompt: "Tap a unit to place it on a cell",
        mergeHint: "Two identical units side by side merge into a higher tier",
        none: "Empty squad",
      },
      table: {
        title: "Stats table",
        text:
          "Edit the numbers straight in the cells — these are working cells, not an " +
          "image. A change shows up in combat and on the charts immediately. This is " +
          "the same way balance is kept in Google Sheets, except the right column is " +
          "right there.",
        reset: "Restore default values",
        export: "Copy the table",
        copied: "Copied",
        note:
          "Changing one stat reshapes the whole picture: the unit in combat, the " +
          "curves on the charts and the winrate verdict all recalculate at once.",
      },
      stats: {
        title: "What this balance says",
        text:
          "The charts are recalculated from the current table values. The verdict " +
          "explains exactly what is broken and which value fixes it.",
        run: "Simulate 1000 battles",
        running: "Calculating…",
        runNote:
          "The run compares a standard squad against a baseline: both sides " +
          "have the same tier profile but different archetypes — melee and " +
          "mounted against ranged and siege. The winrate then measures one " +
          "thing: how the archetypes relate to each other. A random squad " +
          "would measure tier luck instead, and that spread reaches dozens of " +
          "percentage points.",
        ttk: "Time to kill",
        dmg: "Damage by tier",
        cost: "Cost curve",
        winrate: "Winrate",
        verdict: "Verdict",
        hist: "Outcome distribution",
        win: "Win",
        loss: "Loss",
        draw: "Draw",
        sample: "sample",
        ttkNote:
          "Shows how long a fight lasts against an equal-tier opponent. A curve " +
          "that flattens means high tiers die too quickly.",
        dmgNote:
          "Damage growth across tiers should be smooth. A step upward is the moment " +
          "a new unit breaks old strategies.",
        costNote:
          "Merge cost grows faster than unit power — otherwise only one tier is " +
          "worth playing. The curve has to be steep.",
      },
      units: {
        melee: "Melee",
        ranged: "Ranged",
        mounted: "Mounted",
        siege: "Siege",
      },
      params: {
        hp: "Health",
        atk: "Attack",
        def: "Defense",
        spd: "Speed",
        crit: "Crit",
        cost: "Energy",
      },
    },

    about: {
      heading: "About me",
      lead:
        "Junior game designer with a technical degree in game development. I read game " +
        "mechanics well and am especially interested in combat balance, economy, and how " +
        "a single change ripples through gameplay.",
      body:
        "I have an analytical, systems-oriented way of thinking and a technical base " +
        "in programming and working with data. I study game design, balance and " +
        "analytics on my own and keep building my own projects along the way. The " +
        "technical degree lets me understand how a mechanic turns into an " +
        "implementation, and testing experience lets me find problems systematically " +
        "and check changes instead of guessing what broke.",
      gap:
        "I have no commercial game design experience yet, and I would rather say so " +
        "plainly. What I do have is a habit of finishing things: three completed " +
        "projects, one of them with fifteen playtest sessions and iteration based on " +
        "each of them. The lab above is that same working cycle, built so carefully " +
        "that you can check it by hand.",
      wantTitle: "Why LUDUS",
      want: [
        "A merge-autobattler is exactly the loop I broke down in Kings of Eridor: merging, a resource, and a trade-off between cost and power",
        "The studio publishes metrics and reviews its design decisions openly — that approach is close to mine",
        "The project is in production, not prototype: decisions get made under the load of real players",
      ],
    },

    education: {
      heading: "Education",
      degree: "Belarusian State University of Informatics and Radioelectronics",
      field: "Information systems and technologies in the game industry",
      degreeShort: "Bachelor, software engineer",
      years: "2023 — 2027",
      lead:
        "The degree sits between engineering and game development: part of the " +
        "programme is programming and data work, part is game systems. That is why I " +
        "design a mechanic together with its implementation rather than handing it " +
        "off as a drawing.",
      langsTitle: "Languages",
    },

    projects: {
      heading: "Projects",
      items: [
        {
          n: "01",
          title: "Game design document",
          kind: "GDD · strategy with city-building elements",
          text:
            "Designed the mechanics, progression, resource balance and art " +
            "direction. The document is structured for handover to a dev team: " +
            "sections run in the order they are read.",
          facts: ["Mechanics and progression", "Resource balance", "Art direction"],
        },
        {
          n: "02",
          title: "“Kings of Eridor” — tabletop tactics",
          kind: "Wargame · turn-based strategy, four factions",
          text:
            "Designed from scratch: combat mechanics, territory capture, unit " +
            "balance. Ran 15+ playtest sessions, collected feedback and iterated on " +
            "the numbers — on the same cycle as a post-launch event review.",
          facts: ["4 factions", "15+ playtests", "Iterative balancing"],
        },
        {
          n: "03",
          title: "Unity project with production mechanics",
          kind: "Own project · Unity",
          text:
            "An order system, production chains and several locations where the " +
            "player reads the next action off the scene itself. Plus a small " +
            "browser game prototype.",
          facts: ["Order system", "Production chains", "Several locations"],
        },
      ],
    },

    process: {
      heading: "How I make decisions",
      lead:
        "Every number in a project has a reason, and the reason is written next " +
        "to it — so that in six months you can still recall what was actually " +
        "being tested.",
      rules: [
        {
          t: "One change, one observation",
          d: "Fix two things at once and you cannot tell which one worked. Slower, but the conclusion does not lie.",
        },
        {
          t: "Cheap first",
          d: "Paper and a prototype before anything gets polished. I do not start expensive work until I know the idea works.",
        },
        {
          t: "Looking is not testing",
          d: "“I think it feels better” is not an argument. A measurement is.",
        },
      ],
      exampleTitle: "Example from a prototype",
      exampleBody:
        "In a tower prototype the turret traversed at 63°/s. It was awkward to " +
        "play: the heading changed faster than the player could read where the " +
        "tank had settled. I brought it down to 40°/s — the turn reads clearly but " +
        "still has weight. One number, one observation, one comment in the code.",
    },

    skills: {
      heading: "Skills",
      lead: "Every line is not a self-assessment but what backs it up.",
      groups: [
        {
          name: "Balance and systems",
          items: [
            { t: "Combat balance via TTK and DPS", d: "broken down on the charts above" },
            { t: "Resource economy and cost curves", d: "the merge and energy model in the lab" },
            { t: "Maths, probability, statistics", d: "my degree field" },
            { t: "Simulation and winrate forecasting", d: "1000 battles, one click" },
          ],
        },
        {
          name: "Implementation",
          items: [
            { t: "Unity", d: "own project with production mechanics" },
            { t: "C#, C++, JavaScript", d: "prototypes and this entire page" },
            { t: "SQL, working with data", d: "log and metrics analysis" },
            { t: "Excel / Google Sheets", d: "balance tables, versions, edit history" },
          ],
        },
        {
          name: "Documentation",
          items: [
            { t: "GDDs written for handover", d: "concept document, project 01" },
            { t: "Every number justified", d: "a comment next to the parameter" },
            { t: "Git", d: "the history of decisions is in the commits" },
            { t: "Task trackers", d: "tasks, statuses, priorities" },
          ],
        },
      ],
    },

    contacts: {
      heading: "Let us talk",
      sub: "Happy with any format: a call, a video chat, or a test straight in chat.",
      telegram: "Telegram",
      email: "Email",
      phone: "Phone",
      github: "GitHub",
      note: "Remote work, UTC+3 — the studio spans five time zones and we overlap easily.",
      pdf: "Save as PDF",
    },

    changelog: {
      heading: "changelog",
      lead: "The résumé as a release. Every line is what changed and why.",
      lines: [
        { v: "v0.4", t: "The fight is shown in full: opponent on its own side, health bars, damage by tick", d: "a result without the process proves nothing" },
        { v: "v0.3", t: "Added the 1000-battle run and the winrate verdict", d: "making the problem visible" },
        { v: "v0.2", t: "The stats table became editable", d: "testing hypotheses by hand, not in words" },
        { v: "v0.1", t: "First version of the lab: grid, merge, tick-based combat", d: "showing how balance is calculated" },
      ],
    },

    footer: {
      note: "Built with no frameworks and no build step — six files in total.",
      backToTop: "Back to top",
    },
  },
};

/* Метрики вида {{size}} и {{ttf}} подставляет main.js: это не выдуманные
   цифры, а реальный размер файлов и реальное время до первого кадра. */