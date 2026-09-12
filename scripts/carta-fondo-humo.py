"""
Botella de catalogo -> foto de barra, en 4:3.

Dos arreglos sobre la primera version:

1. El recorte del fondo usa los BORDES como barrera. Antes bastaba con "esto
   es casi blanco" y el relleno entraba por dentro de las botellas blancas
   —Malibu salia mordida, como rota—. Ahora el relleno avanza desde el marco
   pero se detiene en el contorno, que en una foto de producto siempre marca.

2. La botella NUNCA se amplia. Moet venia a 173x290 px y estirarla a 900 la
   dejaba borrosa. Ahora el lienzo se adapta al original: si la foto es
   pequena, el resultado es mas pequeno pero NITIDO, con mas fondo alrededor.
"""
import sys, random
from collections import deque
from PIL import Image, ImageDraw, ImageFilter, ImageChops

def quitar_fondo(im):
    """
    Deja transparente el fondo de catalogo, sin morder el producto.

    El umbral se MIDE en el marco de la foto en vez de fijarlo a ojo: en el
    catalogo de Agora el fondo es blanco puro (255) y el cuerpo de una botella
    blanca ronda 242-250. Un umbral fijo de 242 se comia media botella de
    Malibu; midiendo el fondo real, el corte cae justo por encima del producto.

    Los bordes fuertes hacen de barrera adicional: el relleno viene del marco
    y se para en el contorno.
    """
    im = im.convert('RGBA')
    w, h = im.size
    gris = im.convert('L')
    gp = gris.load()

    marco = ([gp[x, 0] for x in range(0, w, 3)] + [gp[x, h - 1] for x in range(0, w, 3)] +
             [gp[0, y] for y in range(0, h, 3)] + [gp[w - 1, y] for y in range(0, h, 3)])
    marco.sort()
    fondo_ref = marco[len(marco) // 2]
    if fondo_ref < 200:
        return im  # el fondo no es claro: no hay nada que recortar
    umbral = 251 if fondo_ref >= 250 else max(226, fondo_ref - 6)

    bordes = gris.filter(ImageFilter.FIND_EDGES)
    # FIND_EDGES deja una orla artificial de 255 en el marco de la imagen; si
    # no se limpia, bloquea las semillas del relleno y no se recorta nada.
    ImageDraw.Draw(bordes).rectangle([0, 0, w - 1, h - 1], outline=0, width=2)
    bp = bordes.load()

    marca = Image.new('L', (w, h), 0)
    mp = marca.load()
    q = deque()

    def sembrar(x, y):
        if mp[x, y] == 0 and gp[x, y] >= umbral and bp[x, y] < 60:
            mp[x, y] = 255
            q.append((x, y))

    for x in range(w):
        sembrar(x, 0); sembrar(x, h - 1)
    for y in range(h):
        sembrar(0, y); sembrar(w - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                sembrar(nx, ny)

    # Se come 1 px del contorno: el antialiasing del catalogo deja una orla
    # casi blanca que, sobre el fondo oscuro, se ve como un halo recortado.
    alpha = ImageChops.invert(marca).filter(ImageFilter.MinFilter(3))
    # En las fotos pequenas el "ringing" del JPEG alrededor del producto mide
    # varios pixeles proporcionalmente, asi que hay que morder un poco mas.
    if max(w, h) < 420:
        alpha = alpha.filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(alpha)
    return im

def fondo_humo(W, H, seed):
    """Negro de barra con jirones de humo calido; el humo SUMA luz."""
    rnd = random.Random(seed)
    base = Image.new('RGB', (W, H), (9, 9, 10))
    humo = Image.new('L', (W, H), 0)
    hd = ImageDraw.Draw(humo)
    esc = max(W, H) / 900
    for _ in range(9):
        cx = rnd.randint(-40, W + 40); cy = rnd.randint(int(H * .05), int(H * .75))
        rx = int(rnd.randint(120, 300) * esc); ry = int(rnd.randint(45, 130) * esc)
        hd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rnd.randint(150, 255))
    for _ in range(5):
        cx = rnd.randint(-60, W + 60); cy = rnd.randint(int(H * .78), int(H * 1.02))
        rx = int(rnd.randint(200, 400) * esc); ry = int(rnd.randint(35, 80) * esc)
        hd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rnd.randint(120, 210))
    humo = humo.filter(ImageFilter.GaussianBlur(52 * esc))
    humo = humo.point(lambda v: int(255 * ((v / 255) ** 2.1)))
    base = ImageChops.add(base, Image.merge('RGB',
        [humo.point(lambda v, f=f: int(v * f)) for f in (.72, .66, .56)]))

    halo = Image.new('L', (W, H), 0)
    ImageDraw.Draw(halo).ellipse([W * .28, H * .16, W * .72, H * .84], fill=255)
    halo = halo.filter(ImageFilter.GaussianBlur(135 * esc))
    base = ImageChops.add(base, Image.merge('RGB',
        [halo.point(lambda v, f=f: int(v * f)) for f in (.30, .21, .09)]))

    vin = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vin).ellipse([-W * .10, -H * .10, W * 1.10, H * 1.10], fill=255)
    vin = vin.filter(ImageFilter.GaussianBlur(160 * esc))
    return Image.composite(base, Image.new('RGB', (W, H), (5, 5, 6)), vin)

def componer(src, dst, seed=0):
    bot = quitar_fondo(Image.open(src))
    bb = bot.getbbox()
    if bb:
        bot = bot.crop(bb)

    # Lienzo 4:3 a la medida del original. La botella ocupa siempre la misma
    # parte del alto, para que todas se vean del mismo tamaño en la rejilla:
    # el Tequila de frutas de la pasion venia a 225 px con mucho margen blanco
    # y, al no ampliarlo nada, salia diminuto al lado de los demas. Se permite
    # un estiron corto (1,4x) que no llega a verse borroso.
    H = max(340, min(900, round(bot.height / 0.78)))
    W = round(H * 4 / 3)
    alto = min(int(bot.height * 1.4), int(H * 0.78))
    ancho = round(bot.width * alto / bot.height)
    if ancho > W * 0.58:
        ancho = int(W * 0.58)
        alto = round(bot.height * ancho / bot.width)
    bot = bot.resize((max(1, ancho), max(1, alto)), Image.LANCZOS)

    fondo = fondo_humo(W, H, seed)
    x = (W - bot.width) // 2
    y = (H - bot.height) // 2

    som = Image.new('L', (W, H), 0)
    ImageDraw.Draw(som).ellipse(
        [x + bot.width * .12, y + bot.height - 14, x + bot.width * .88, y + bot.height + 26], fill=170)
    som = som.filter(ImageFilter.GaussianBlur(22 * (max(W, H) / 900)))
    fondo = Image.composite(Image.new('RGB', (W, H), (0, 0, 0)), fondo, som)
    fondo.paste(bot, (x, y), bot)
    fondo.save(dst, 'JPEG', quality=90, optimize=True)
    return fondo.size

if __name__ == '__main__':
    print(componer(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 0))
