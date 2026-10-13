"""Проверка кодировки исходников.

Нужна потому, что один и тот же файл можно испортить, не заметив: если
переписать файл перенаправлением в консоли без явной кодировки, содержимое
прочитается в системной однобайтовой кодировке и запишется обратно уже
испорченным. Браузер покажет «РїСЪЬСЇРѕР°Рї» вместо имени, и это будет
видно только на выложенной странице.

Запуск: python check-encoding.py
"""

import io
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

FILES = ["index.html", "balance.js", "content.js", "engine.js",
         "lab.js", "main.js", "styles.css", "README.md"]

# По одному характерному слову на файл: если файл чистый, слово найдётся.
MARKERS = {
    "index.html": "Ярослав Кукар",
    "balance.js": "АРХЕТИПЫ",
    "content.js": "геймдизайнер",
    "engine.js": "противник вообще",
    "lab.js": "Сцена читает состояние",
    "main.js": "СТРАНИЦА",
    "styles.css": "ТОКЕНЫ",
    "README.md": "BALANCE LAB",
}

# Признаки двойного кодирования UTF-8 → однобайтовая: русские буквы
# появляются парами, потому что каждый байт стал отдельным символом.
MOJIBAKE = ("Рї", "Р°", "Рё", "СЂ", "СЃ", "Рµ", "Рѕ", "Ð")


def strip_comments(text):
    """Убирает комментарии и код в обратных кавычках.

    Это обязательно: в исходниках есть комментарий, где мусорный вид строки
    приводится как пример, и в README такой пример взят в кавычки. Они
    написаны правильно, но проверка принимала их за испорченный файл —
    и срабатывала на собственном описании симптома.
    """
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"/\*\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"`[^`]*`", "", text)
    return text


bad = []
for name in FILES:
    with open(name, "rb") as fh:
        raw = fh.read()

    try:
        text = raw.decode("utf-8")
        decodable = True
    except UnicodeDecodeError:
        text = raw.decode("utf-8", "replace")
        decodable = False

    marker = MARKERS.get(name, "")
    found = marker in text if marker else True
    junk = sum(strip_comments(text).count(ch) for ch in MOJIBAKE)

    ok = decodable and found and junk == 0
    if not ok:
        bad.append(name)
    print(f"{name:14} {'OK' if ok else 'ПРОБЛЕМА':9} utf8={decodable} маркер={found} мусор={junk}")

print()
if bad:
    print("Испорчено файлов:", len(bad))
    print(", ".join(bad))
    sys.exit(1)

print("Все файлы в порядке.")
print("Внимание: переписывать их перенаправлением в консоли без")
print("-Encoding UTF8 нельзя — это и ломает кодировку.")