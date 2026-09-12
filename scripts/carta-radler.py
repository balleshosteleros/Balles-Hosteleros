"""
Radler: la copa de barril con unos limones al lado.

La Radler es cerveza con limon, y en la carta se distingue de la caña normal
justo por eso. La foto de catalogo de la Radler que hay en Agora mide 252x200
y lleva un barril de fondo que no pega con el resto, asi que se monta: se coge
la MISMA copa de barril que la caña y se le ponen los limones delante.
"""
import sys
sys.path.insert(0, '.')
from PIL import Image, ImageFilter, ImageDraw
import humo2

def recortado(ruta):
    im = humo2.quitar_fondo(Image.open(ruta))
    bb = im.getbbox()
    return im.crop(bb) if bb else im

def recorta_limon(ruta):
    """
    El limon se recorta por COLOR, no por claridad: su fondo es gris de
    estudio, no blanco, asi que el recorte normal no lo veia como fondo. Lo
    que sí separa a un limon de un fondo gris es el amarillo saturado.
    """
    im = Image.open(ruta).convert('RGB')
    r, g, b = im.split()
    from PIL import ImageChops
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    sat = ImageChops.subtract(mx, mn)
    mascara = sat.point(lambda v: 255 if v > 45 else 0)
    mascara = mascara.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    mascara = mascara.filter(ImageFilter.GaussianBlur(1.2))
    im = im.convert('RGBA')
    im.putalpha(mascara)
    bb = im.getbbox()
    return im.crop(bb) if bb else im

copa = recortado('ag/2417.jpg')
limon = recorta_limon('lim_Lemon_Fruit.jpg')

W, H = 700, 1050                       # 2:3, como el resto de bebidas
fondo = humo2.fondo_humo(W, H, 2418)

# La copa, centrada y algo a la derecha para dejar sitio a la fruta.
alto = int(H * 0.70)
copa = copa.resize((max(1, round(copa.width * alto / copa.height)), alto), Image.LANCZOS)
cx = (W - copa.width) // 2 + int(W * 0.10)
cy = int(H * 0.14)

def poner(base, img, x, y, sombra=True):
    if sombra:
        s = Image.new('L', base.size, 0)
        ImageDraw.Draw(s).ellipse(
            [x + img.width * .10, y + img.height - 12, x + img.width * .90, y + img.height + 22], fill=150)
        s = s.filter(ImageFilter.GaussianBlur(18))
        base = Image.composite(Image.new('RGB', base.size, (0, 0, 0)), base, s)
    base.paste(img, (x, y), img)
    return base

fondo = poner(fondo, copa, cx, cy)

# Dos limones a los pies de la copa: uno delante y otro detrás, más pequeño,
# para que se lean como fruta suelta en la barra y no como un adorno pegado.
base_y = cy + copa.height
for escala, dx, dy, espejo in ((0.155, -0.62, 0.005, False), (0.125, -0.30, 0.02, True)):
    l = limon.copy()
    if espejo:
        l = l.transpose(Image.FLIP_LEFT_RIGHT)
    alto_l = int(H * escala)
    l = l.resize((max(1, round(l.width * alto_l / l.height)), alto_l), Image.LANCZOS)
    fondo = poner(fondo, l, int(cx + copa.width * dx), int(base_y - l.height + H * dy))

fondo.save('radler_montaje.jpg', 'JPEG', quality=90, optimize=True)
print('listo', fondo.size)
