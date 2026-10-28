# Как перенести работу в проект на claude.ai

1. claude.ai → Projects → «Create project». Название: «Хроники Эрбориана — книга 2».
2. Instructions: вставить целиком текст из `claude_project/INSTRUKCII_PROEKTA.md`.
3. Project knowledge → загрузить файлы (из архива `erborian_kniga2_proekt.zip` или из GitHub-репозитория):
   - CLAUDE.md
   - BIBLIYA.md
   - plan/glavy.md
   - plan/svyazi_s_knigoy1.md
   - FAKTY.md
   - Kniga1_svodka.md
   - tekst/00_prolog_savan.md
   - Kniga1_Razorvannoe_koltso.txt — по желанию (≈730 тыс. знаков; проект ищет по нему сам, но он занимает много места в знаниях).
4. После каждой главы: сохранить главу как файл `tekst/NN_nazvanie.md`, вставить блок «Обновление FAKTY.md» в FAKTY.md и перезагрузить FAKTY.md в знания проекта (иначе проект не увидит новые факты).
5. Новые решения автора — дописывать в BIBLIYA.md и тоже перезагружать.

Чем проект отличается от этой сессии Claude Code: в проекте нет git — файлы не сохраняются сами, их обновляет автор вручную. Репозиторий на GitHub остаётся резервной копией.
