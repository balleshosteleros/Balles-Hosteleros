"""
Pone la botella sobre un fondo oscuro con humo.

Las fotos del fabricante vienen sobre blanco liso: en una carta de fondo
oscuro cantan como un recorte de catalogo. Se recorta el blanco, se monta
sobre un degradado oscuro con volutas de humo y una luz calida detras de la
botella, que es como se fotografia una botella en barra.
"""
import sys, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W = H = 900

def quitar_fondo(im):
    """El blanco del catalogo pasa a transparente, con borde suave."""
    im = im.convert('RGBA')
    px = im.load()
    w,h = im.size
    # Mascara: lo que se parece al blanco del borde se descarta
    fondo = Image.new('L', im.size, 0)
    fp = fondo.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a = px[x,y]
            claro = min(r,g,b)
            # blanco puro -> fondo; gris claro -> semi
            if claro > 242: fp[x,y] = 255
            elif claro > 228: fp[x,y] = int((claro-228)*255/14)
    # Solo el blanco CONECTADO al borde es fondo (no el de la etiqueta)
    from collections import deque
    visto = Image.new('L', im.size, 0); vp = visto.load()
    q = deque()
    for x in range(w):
        for y in (0,h-1):
            if fp[x,y]>128: q.append((x,y)); vp[x,y]=255
    for y in range(h):
        for x in (0,w-1):
            if fp[x,y]>128: q.append((x,y)); vp[x,y]=255
    while q:
        x,y = q.popleft()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny = x+dx, y+dy
            if 0<=nx<w and 0<=ny<h and vp[nx,ny]==0 and fp[nx,ny]>90:
                vp[nx,ny]=255; q.append((nx,ny))
    visto = visto.filter(ImageFilter.GaussianBlur(0.8))
    alpha = ImageChops.invert(visto)
    im.putalpha(alpha)
    return im

def fondo_humo(seed):
    """
    Fondo de barra: negro con jirones de humo iluminados por detras.

    La clave es que el humo sea DISPERSO y con contraste: manchas separadas
    sobre negro, no una capa uniforme. Una niebla que cubre todo el cuadro
    deja la escena gris y se come las botellas claras, que es justo lo que
    hay que evitar en una carta de fondo oscuro.
    """
    rnd = random.Random(seed)
    base = Image.new('RGB', (W, H), (9, 9, 10))

    # Jirones: pocos, grandes y de intensidad muy dispar, para que haya
    # zonas encendidas y zonas en sombra.
    humo = Image.new('L', (W, H), 0)
    hd = ImageDraw.Draw(humo)
    for _ in range(9):
        cx = rnd.randint(-40, W + 40); cy = rnd.randint(int(H * 0.05), int(H * 0.75))
        rx = rnd.randint(120, 300); ry = rnd.randint(45, 130)
        hd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rnd.randint(150, 255))
    # Niebla baja: asienta la botella sobre la barra.
    for _ in range(5):
        cx = rnd.randint(-60, W + 60); cy = rnd.randint(int(H * 0.78), int(H * 1.02))
        rx = rnd.randint(200, 400); ry = rnd.randint(35, 80)
        hd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rnd.randint(120, 210))
    humo = humo.filter(ImageFilter.GaussianBlur(52))
    # Curva de contraste: hunde los medios y conserva las crestas, que es lo
    # que separa un jiron de humo de una nube plana.
    humo = humo.point(lambda v: int(255 * ((v / 255) ** 2.1)))

    # El humo suma luz calida sobre el negro.
    tinte = Image.merge('RGB', [humo.point(lambda v: int(v * f)) for f in (0.72, 0.66, 0.56)])
    base = ImageChops.add(base, tinte)

    # Contraluz calido detras de la botella.
    halo = Image.new('L', (W, H), 0)
    ImageDraw.Draw(halo).ellipse([W * 0.28, H * 0.16, W * 0.72, H * 0.84], fill=255)
    halo = halo.filter(ImageFilter.GaussianBlur(135))
    base = ImageChops.add(base, Image.merge('RGB',
        [halo.point(lambda v: int(v * f)) for f in (0.30, 0.21, 0.09)]))

    # Vineteado: cierra los bordes y lleva el ojo al centro.
    vin = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vin).ellipse([-W * 0.10, -H * 0.10, W * 1.10, H * 1.10], fill=255)
    vin = vin.filter(ImageFilter.GaussianBlur(160))
    base = Image.composite(base, Image.new('RGB', (W, H), (5, 5, 6)), vin)
    return base

def componer(src, dst, seed=0):
    bot = quitar_fondo(Image.open(src))
    bb = bot.getbbox()
    if bb: bot = bot.crop(bb)
    # Escalar a 76% de alto
    alto = int(H*0.76)
    ratio = alto/bot.height
    bot = bot.resize((max(1,int(bot.width*ratio)), alto), Image.LANCZOS)
    if bot.width > W*0.62:
        r2 = (W*0.62)/bot.width
        bot = bot.resize((int(bot.width*r2), int(bot.height*r2)), Image.LANCZOS)
    fondo = fondo_humo(seed)
    x = (W-bot.width)//2; y = int(H*0.13)
    # Sombra bajo la botella, para que no flote
    som = Image.new('L',(W,H),0)
    ImageDraw.Draw(som).ellipse([x+bot.width*0.1, y+bot.height-18, x+bot.width*0.9, y+bot.height+34], fill=170)
    som = som.filter(ImageFilter.GaussianBlur(26))
    fondo = Image.composite(Image.new('RGB',(W,H),(0,0,0)), fondo, som)
    fondo.paste(bot, (x,y), bot)
    fondo.save(dst, 'JPEG', quality=88, optimize=True)

if __name__ == '__main__':
    componer(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 0)
