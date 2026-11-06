---
name: dns-tabel-fuel-deduction
description: Half-month "Отчет ДНС" driver pay табель (wide table, drivers as columns, days as rows) — filling the Топливо deduction row from fuel-card reports and subtracting it in the final payout formula.
sources: [chat]
aliases: [табель топливо, Отчет ДНС табель, вычесть топливо]
---

- [stated] user builds/edits a half-month "Отчет ДНС" табель: drivers as columns, days as rows, with ИТОГО (дневная выручка), Процент (20%), then deduction rows Топливо/Грузчики/Штрафы/Премии/Авансы/Лизинг/Каско-Осаго, and a final ИТОГО payout row
- [stated] fuel-card report holder names are often placeholders/wrong; user maintains a separate ФИО↔карта соответствие file (per half-month period) giving the real driver name for each card, which is matched to the табель's driver columns by surname to fill the Топливо row
- [stated] user reviews and corrects this ФИО↔карта mapping file themselves (reassigning which card belongs to which driver) rather than trusting the fuel report's own holder labels
- related: [[dns-reestr-check]], [[obi-1509-driver-tabel]], [[driver-income-app]] — same ДНС delivery operation, different per-document task
