---
name: obi-1509-driver-tabel
description: Deliveries for OBI stores 1509 and 1535 — the user compiles per-driver табели from daily ОБИ реестры for half-month periods.
sources: [cowork]
aliases: [табель 1509, реестры ОБИ, ОБИ 1509]
---
- [stated] needs to build a drivers' табель (sheet per driver) from daily ОБИ store 1509 delivery реестры, per half-month period (e.g. 16–30.09.2026)
- [stated] ОБИ sends the реестр with sums per their tariff; user checks it against the tariff and fills driver amounts into the табель per a separate driver tariff
- [stated] wants unneeded реестр columns hidden, not deleted; corrections highlighted in color with comments in the реестр; from the 16–31.10 табели on — no comments in the табель («в табеле комментарии не пиши»)
- [stated] wants the driver табель kept in the user's own edited version (with their manual corrections), new days added to it
- [stated] also does the same for OBI store 1535 (separate реестр + табель); for 1535 the реестр comes with zero sums and needs tariff filled in, and no columns/rows should be hidden
- [stated] in 1535 реестры, «Карапунарлы 1ая» and «Карапунарлы 2ая» are the same driver — one sheet «Карапунарлы» in the табель
- [stated] new табель per half-month period (e.g. 01–15.10.2026) for both stores
- [stated] largest vehicle used is a Газель with cargo body 2,10 × 2 × 4,20 м
- [stated] fleet for these deliveries has Lada Largus and Peugeot Boxer vans; user plans routes in Яндекс Маршрутизация (route file built from the ОБИ реестр, accounting for weight, volume, dimensions, zones and time windows)
- [stated] wants to build own routing program (independent of Яндекс): load реестры for ОБИ 1509, 1535 and both Лента stores, auto-split into рейсы by volume/dimensions + district, then upload ready routes into Яндекс Маршрутизация; routes are currently formed manually, max-size first, and vehicles (mixed sizes) are found for routes afterwards; wants exact item dimensions/weight pulled from ОБИ / Лента websites since реестр data sometimes wrong
- [stated] also puts addresses from the daily ТЭК report onto a Яндекс Конструктор карт map, keeping the colour scheme of their example map; map addresses must not include the postal index or the word «Россия»; marker captions must not include «кг» (e.g. «34 пан 2,8»); captions show every delivery window except 08:00–23:00
- [stated] splits the day's map points into per-driver zones (zone colour + surname); the daily schedule photo lists who works that day with their colour
- [stated] driver roster (colour — vehicle): Ковалевский Вячеслав серый Газель 4 м; Леонов Сергей чёрный автобус 2,8 м; Мамараимов зелёный Ларгус; Климов Никита розовый Ларгус; Сатула Сергей жёлтый Газель 4 м; Саймахмуди Маджид / Карапунарлы Виталий / Карапунарлы Илья болотный Газель 4 м; Мазхабов красный автобус 3 м; Гурчунов Дилмод фиолетовый Ларгус; Гаценко Лев коричневый Ларгус; Головков Михаил коричневый Газель 4 м; Батурин Иван голубой Газель 5 м; Каратов Александр светло-зелёный Газель 3 м; Старыш Сергей синий Газель 4 м; also Галаян; said a fuller list will follow
- [stated] routes/zones are built from the main store on Варшавское шоссе (ОБИ 1509, Варшавское ш., 97); the daily schedule photo also gives each driver's loading time
- [stated] zones are routed from the store «пирогом» — rays/slices outward from the depot, one direction per vehicle
- [stated] second loading point: some vehicles are sometimes top-loaded at another store — Красногорск, пгт Отрадное, Пятницкое шоссе, 1с1; user will say when this happens
- [stated] drivers' zones must not overlap each other
- [stated] «Отчёт ТЭК» (daily file, sheet «ТЭК») is the ОБИ реестр itself
- [stated] in the Яндекс Маршрутизация file, the Vehicles tab lists only drivers working that day (per the daily list the user sends)
- [stated] always (every period) pay by a separate driver tariff: Лалаян Богдан, Юсупов Юсуп, Тиханов Евгений, Гуторов, Лобачев Денис, Смолин Александр, Сарсенгалиев, Сметанников Антон, Исакжанов, Магомедов Давид, Смагин Игорь, Тагибеков Тарлан, Казарийчук Василий: курьерская 1 зона 385 / 2 зона 600; МГ 695 / 910; СВ 850 / 1380; выгрузка за 100 кг 180; без выгрузки за 100 кг 165; подъём и ручной пронос за 100 кг 200; дальность 40 ₽/км
- [stated] repeat deliveries of orders from earlier dates must be entered in the табель and paid to both drivers (drivers may have been at the address but the client didn't accept)
