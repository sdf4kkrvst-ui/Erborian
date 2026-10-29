from PIL import Image, ImageDraw, ImageFont, ImageFilter
D='/tmp/claude-0/-home-user-Erborian/81660563-3798-5c41-a7b9-75e3b863bf30/scratchpad/'
img=Image.open('izdatelstvo/oblozhki/kniga2_art.png').convert('RGB')
W,H=1600,2400
img=img.resize((W,H),Image.LANCZOS)
# bottom gradient
grad=Image.new('L',(1,H),0)
for y in range(H):
    t=max(0,(y-int(H*0.80))/(H*0.20)); grad.putpixel((0,y),int(200*t))
grad=grad.resize((W,H)); black=Image.new('RGB',(W,H),(8,8,12))
img=Image.composite(black,img,grad)
def font(path,size,var=None):
    f=ImageFont.truetype(D+path,size)
    if var:
        try: f.set_variation_by_name(var)
        except Exception as e: print(e)
    return f
sc=font('csc.ttf',54); big=font('cg.ttf',190,'SemiBold'); small=font('csc.ttf',40); auth=font('csc.ttf',78)
silver=(226,228,236)
def center(d,y,text,f,fill,spacing=0):
    # manual letter spacing
    widths=[d.textlength(c,font=f) for c in text]; tw=sum(widths)+spacing*(len(text)-1)
    x=(W-tw)/2
    for c,w in zip(text,widths):
        d.text((x,y),c,font=f,fill=fill); x+=w+spacing
def layer(draw_fn):
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); draw_fn(ImageDraw.Draw(sh),(0,0,0,230))
    sh=sh.filter(ImageFilter.GaussianBlur(8))
    tx=Image.new('RGBA',(W,H),(0,0,0,0)); draw_fn(ImageDraw.Draw(tx),silver+(255,))
    return sh,tx
def texts(d,fill):
    center(d,150,'ХРОНИКИ ЭРБОРИАНА',sc,fill,spacing=14)
    center(d,232,'КНИГА ВТОРАЯ',small,fill,spacing=10)
    center(d,300,'Седьмая башня',big,fill)
    center(d,H-180,'АЛЕКС ЗАКАРИН',auth,fill,spacing=16)
sh,tx=layer(texts)
out=img.convert('RGBA'); out.alpha_composite(sh); out.alpha_composite(sh); out.alpha_composite(tx)
d=ImageDraw.Draw(out); d.line([(W/2-120,520),(W/2+120,520)],fill=silver+(200,),width=2)
out.convert('RGB').save('izdatelstvo/oblozhki/kniga2_maket.jpg',quality=93)
