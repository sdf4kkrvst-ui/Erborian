# Макет обложки «Тененосца»: python3 novyi_mir/oblozhki/maket_tenenosec.py <папка со шрифтами csc.ttf, cg.ttf>
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
F=sys.argv[1].rstrip('/')+'/'
img=Image.open('novyi_mir/oblozhki/tenenosec_art.png').convert('RGB')
W,H=1600,2400
img=img.resize((W,H),Image.LANCZOS)
grad=Image.new('L',(1,H),0)
for y in range(H):
    t=max(0,(y-int(H*0.82))/(H*0.18)); grad.putpixel((0,y),int(210*t))
grad=grad.resize((W,H)); black=Image.new('RGB',(W,H),(6,7,12))
img=Image.composite(black,img,grad)
def font(p,s,var=None):
    f=ImageFont.truetype(F+p,s)
    if var:
        try: f.set_variation_by_name(var)
        except Exception as e: print(e)
    return f
sc=font('csc.ttf',50); big=font('csc.ttf',190); small=font('csc.ttf',38); auth=font('csc.ttf',76)
frost=(222,230,240); ember=(240,140,60)
def center(d,y,text,f,fill,sp=0):
    ws=[d.textlength(c,font=f) for c in text]; tw=sum(ws)+sp*(len(text)-1); x=(W-tw)/2
    for c,w in zip(text,ws):
        d.text((x,y),c,font=f,fill=fill); x+=w+sp
def texts(d,fill,accent):
    center(d,130,'СЛОВО ВО МРАКЕ',sc,fill,sp=18)
    center(d,205,'КНИГА ПЕРВАЯ',small,fill,sp=12)
    center(d,265,'ТЕНЕНОСЕЦ',big,fill,sp=10)
    center(d,H-170,'АЛЕКС ЗАКАРИН',auth,fill,sp=16)
sh=Image.new('RGBA',(W,H),(0,0,0,0)); texts(ImageDraw.Draw(sh),(0,0,0,235),None); sh=sh.filter(ImageFilter.GaussianBlur(9))
tx=Image.new('RGBA',(W,H),(0,0,0,0)); texts(ImageDraw.Draw(tx),frost+(255,),None)
out=img.convert('RGBA'); out.alpha_composite(sh); out.alpha_composite(sh); out.alpha_composite(tx)
d=ImageDraw.Draw(out); d.line([(W/2-110,500),(W/2+110,500)],fill=ember+(230,),width=3)
out.convert('RGB').save('novyi_mir/oblozhki/tenenosec_maket.jpg',quality=93)
print('ok')
