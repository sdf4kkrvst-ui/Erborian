## Общий график работ водителей (15-е и последний день месяца)

- id: `trig_01L4AdYmLDxVwqqGaY8qrPKv`
- расписание: `CRON_TZ=Europe/Moscow 47 8 15,28-31 * *`
- включена: False
- ended_reason: —
- устройство: —
- режим разрешений: auto
- модель: claude-opus-5-5
- уведомления: {"channel": {"push": true, "email": false}}
- создана: 2026-10-16T23:02:54.043256Z; последний запуск: —

Промпт:

````
Автоматическая задача: собрать «общий график работ» водителей из Google-таблицы «ТК ИП Зуськова\ДНС» и положить Excel-файл на рабочий стол компьютера пользователя (Windows, C:\Users\berez\Desktop). Отвечай и пиши по-русски.

== ШАГ 1. Дата и период ==
Вызови mcp__claude_ai__current_time (время Москвы). Пусть сегодня Y-M-D.
- Если D = 15 → период: с 16-го по последний день ТЕКУЩЕГО месяца (M, Y).
- Если сегодня последний день месяца (D = calendar.monthrange(Y,M)[1]) → период: с 1-го по 15-е СЛЕДУЮЩЕГО месяца (M+1; если M=12 → месяц 1, год Y+1).
- Иначе (28/29/30-е, но не последний день) → ничего не делай, просто заверши задачу без уведомления.
Обозначь: MONTH, YEAR, D1, D2.

== ШАГ 2. Скачай таблицу ==
mcp__Google_Drive__download_file_content, fileId = "1QB4KHRfa0ZOYra_ROReaj2gSgzksGrGfv1ssyI3_iF0", exportMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".
Результат большой и сохранится в файл (JSON с полем content в base64). Через python: json.load → base64.b64decode(d['content']) → запиши в src.xlsx в рабочей папке.
Листы в таблице называются "D.MM" (например "1.10", "16.10"). Колонки: A = ФИО курьера, B = Филиал, C = маршрут/статус.
Если листов за часть дней периода ещё нет — это нормально (график могут заполнять заранее не полностью): собери по тем, что есть, и перечисли отсутствующие даты в уведомлении.

== ШАГ 3. Собери Excel ==
pip install openpyxl --break-system-packages (если нет). Сохрани скрипт ниже как build.py и запусти:
python3 build.py src.xlsx "out/График работ {Месяц} {YEAR} ({D1}-{D2}).xlsx" MONTH YEAR D1 D2
(Месяц по-русски с заглавной: Январь…Декабрь. Например: "График работ Ноябрь 2026 (1-15).xlsx".)
Посмотри вывод скрипта (список водителей). Если видишь, что один и тот же водитель попал двумя строками из-за новой опечатки в фамилии — добавь опечатку в словарь TYPO и перезапусти.

```python
import openpyxl, re, sys, collections
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
src, out, month, year, d1, d2 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
MN={1:'Январь',2:'Февраль',3:'Март',4:'Апрель',5:'Май',6:'Июнь',7:'Июль',8:'Август',9:'Сентябрь',10:'Октябрь',11:'Ноябрь',12:'Декабрь'}
TYPO={'бибоснов':'бибосов','синицарь':'синецарь','тетерярятников':'тетерятников'}
FIRST_NAMES={'вадим'}  # "Вадим Насуллаев" — имя впереди
def clean(s): return re.sub(r'\s+',' ',str(s).replace('+','').replace('ё','е').replace('Ё','Е')).strip()
def key(s):
    t=clean(s).lower().split()
    if len(t)>1 and t[0] in FIRST_NAMES: t=t[1:]
    k=t[0].rstrip('.') if t else ''
    return TYPO.get(k,k)
wb=openpyxl.load_workbook(src,data_only=True)
data=collections.defaultdict(dict); disp={}; raw=[]; missing=[]; variants=collections.defaultdict(collections.Counter)
for d in range(d1,d2+1):
    sn=f'{d}.{month:02d}' if f'{d}.{month:02d}' in wb.sheetnames else f'{d}.{month}'
    if sn not in wb.sheetnames: missing.append(f'{d}.{month:02d}'); continue
    for r in wb[sn].iter_rows(min_row=2,values_only=True):
        if not r or not r[0] or not str(r[0]).strip(): continue
        name=str(r[0]).strip()
        if 'фио' in name.lower(): continue
        k=key(name); c=clean(name)
        variants[k][c]+=1; disp[k]=c
        br=clean(r[1]) if len(r)>1 and r[1] else ''; rt=clean(r[2]) if len(r)>2 and r[2] else ''
        data[k][d]=rt; raw.append((f'{d:02d}.{month:02d}.{year}',c,br,rt))
for k,cnt in variants.items():
    mw=max(len(v.split()) for v in cnt)
    disp[k]=max((v for v in cnt if len(v.split())==mw), key=lambda v: cnt[v])
days=list(range(d1,d2+1))
drivers=sorted(disp, key=lambda k: disp[k].split()[-1] if k=='насуллаев' else disp[k])
wb2=openpyxl.Workbook(); ws=wb2.active; ws.title='График'
H=PatternFill('solid',fgColor='1F4E79'); HF=Font(color='FFFFFF',bold=True,size=10)
OFF=PatternFill('solid',fgColor='F8CBAD'); WORK=PatternFill('solid',fgColor='C6EFCE'); OTH=PatternFill('solid',fgColor='FFEB9C')
th=Side(style='thin',color='999999'); B=Border(left=th,right=th,top=th,bottom=th)
ws.cell(1,1,f'Общий график работ — {MN[month]} {year} ({d1}–{d2})').font=Font(bold=True,size=13)
hdr=['№','ФИО Курьера']+[f'{d:02d}.{month:02d}' for d in days]+['Рабочих дней','Выходных']
for i,h in enumerate(hdr,1):
    c=ws.cell(3,i,h); c.fill=H; c.font=HF; c.border=B; c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
ws.column_dimensions['A'].width=5; ws.column_dimensions['B'].width=26
for i in range(len(days)): ws.column_dimensions[get_column_letter(3+i)].width=14
ws.column_dimensions[get_column_letter(3+len(days))].width=10; ws.column_dimensions[get_column_letter(4+len(days))].width=10
ws.row_dimensions[3].height=30
tot_work=collections.Counter()
for ri,k in enumerate(drivers,4):
    ws.cell(ri,1,ri-3).border=B; c=ws.cell(ri,2,disp[k]); c.border=B; c.font=Font(bold=True,size=10)
    w=o=0
    for ci,d in enumerate(days,3):
        v=data[k].get(d); c=ws.cell(ri,ci,v); c.border=B; c.font=Font(size=9)
        c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
        if v is None: continue
        lv=v.lower()
        if 'выходн' in lv: c.fill=OFF; o+=1
        elif any(x in lv for x in ('маршрут','дежур','экспресс','рио','вегас','краски')): c.fill=WORK; w+=1; tot_work[d]+=1
        else: c.fill=OTH
    for j,val in ((3+len(days),w),(4+len(days),o)):
        c=ws.cell(ri,j,val); c.border=B; c.alignment=Alignment(horizontal='center'); c.font=Font(bold=True)
r=4+len(drivers)
c=ws.cell(r,2,'На линии (машин)'); c.font=Font(bold=True); c.border=B
for ci,d in enumerate(days,3):
    c=ws.cell(r,ci,tot_work[d]); c.font=Font(bold=True); c.border=B; c.alignment=Alignment(horizontal='center')
ws.freeze_panes='C4'
ws.cell(r+2,2,'Зелёный — маршрут/дежурство/экспресс, красный — выходной, жёлтый — прочее (поломка и т.п.)').font=Font(italic=True,size=9)
ws.page_setup.orientation='landscape'; ws.page_setup.fitToWidth=1; ws.sheet_properties.pageSetUpPr.fitToPage=True; ws.page_setup.fitToHeight=0
ws2=wb2.create_sheet('Данные'); ws2.append(['Дата','ФИО Курьера','Филиал','Маршрут'])
for row in raw: ws2.append(list(row))
for col,w in zip('ABCD',(12,26,14,36)): ws2.column_dimensions[col].width=w
wb2.save(out)
print('drivers',len(drivers),'days',len(days),'missing',missing)
print({k:disp[k] for k in drivers})
```

== ШАГ 4. Положи файл на рабочий стол ==
Основной способ (проверен, работает): закодируй готовый xlsx в base64 (base64 -w0) и выполни на компьютере пользователя через инструмент mcp__remote-devices__pc__run_powershell команду вида:
$b="<BASE64>"; $d=[Environment]::GetFolderPath("Desktop"); $p=Join-Path $d "<ИМЯ ФАЙЛА>.xlsx"; [IO.File]::WriteAllBytes($p,[Convert]::FromBase64String($b)); Get-Item $p | Select FullName,Length | Format-List
(Удобно сначала сгенерировать полный текст команды питоном в файл, прочитать его и передать в инструмент целиком.) Если файл с таким именем уже есть — перезапиши.
Запасной способ: mcp__remote-devices__device_commit_files (stagedPath в /mnt/user-data/outputs/, devicePath C:\Users\berez\Desktop\<имя>).
Проверь, что размер файла на компьютере совпадает с локальным.
Если компьютер недоступен (выключен/спит/приложение Claude закрыто) — отправь файл через SendUserFile и сообщи в уведомлении, что на рабочий стол положить не удалось.

== ШАГ 5. Уведомление ==
Push-уведомление (PushNotification), коротко: «График работ {Месяц} {YEAR} ({D1}-{D2}) на рабочем столе. Водителей: N.» + если были отсутствующие листы — «Нет листов за: …».
````
