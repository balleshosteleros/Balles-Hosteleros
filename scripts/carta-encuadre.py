"""
Recorte 4:3 centrado en el PLATO, no en el centro geometrico de la foto.

La tarjeta y la ficha muestran la foto en 4:3. Las fotos de coctel vienen en
vertical con la copa abajo, asi que recortar por el centro cortaba la copa y
solo se veia el humo. Aqui se busca la franja con mas "contenido" —bordes mas
saturacion, que es donde esta la comida o la copa— y se recorta ahi.

Guardar la foto ya en 4:3 tiene otra ventaja: como el hueco tambien es 4:3,
la pantalla no vuelve a recortar nada y lo que se ve es exactamente esto.
"""
from PIL import Image, ImageFilter, ImageChops

RATIO = 4 / 3

def _energia(im, vertical=True):
    """Perfil de interes por fila (o columna): bordes + saturacion."""
    ch = im.convert('L').filter(ImageFilter.FIND_EDGES)
    r, g, b = im.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    sat = ImageChops.subtract(mx, mn)
    mezcla = ImageChops.add(ch, sat.point(lambda v: v // 2))
    px = mezcla.load()
    w, h = mezcla.size
    if vertical:
        return [sum(px[x, y] for x in range(0, w, 2)) for y in range(h)]
    return [sum(px[x, y] for y in range(0, h, 2)) for x in range(w)]

def _centro(perf, sesgo):
    """
    Punto de la foto donde esta el asunto, como fraccion de 0 a 1.

    Se usa el percentil de la energia acumulada, NO el maximo. Buscar la franja
    de maxima energia mandaba el recorte a la llama del flambeado y dejaba la
    copa fuera —justo lo que se queria evitar—. El percentil reparte: cae entre
    el destello y el cuerpo del producto, asi que entran los dos.
    """
    total = sum(perf) or 1
    objetivo = total * sesgo
    acum = 0
    for i, v in enumerate(perf):
        acum += v
        if acum >= objetivo:
            return i / max(1, len(perf) - 1)
    return 0.5

def recuadro(im, sesgo=0.70):
    w, h = im.size
    actual = w / h
    if abs(actual - RATIO) < 0.02:
        return (0, 0, w, h)

    chico = im.resize((max(8, w // 4), max(8, h // 4)))

    if actual < RATIO:                     # vertical: elegimos la franja
        alto = int(round(w / RATIO))
        if alto >= h:
            return (0, 0, w, h)
        c = _centro(_energia(chico, vertical=True), sesgo)
        y = int(round(c * h - alto / 2))
        y = min(h - alto, max(0, y))
        return (0, y, w, y + alto)

    ancho = int(round(h * RATIO))          # apaisada
    if ancho >= w:
        return (0, 0, w, h)
    c = _centro(_energia(chico, vertical=False), 0.5)
    x = int(round(c * w - ancho / 2))
    x = min(w - ancho, max(0, x))
    return (x, 0, x + ancho, h)

def recortar(src, dst, ancho_max=1200):
    im = Image.open(src).convert('RGB')
    im = im.crop(recuadro(im))
    if im.width > ancho_max:
        im = im.resize((ancho_max, int(round(ancho_max / RATIO))), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=90, optimize=True)
    return im.size


def encajar(src, dst, ancho_max=1200):
    """
    Copa entera dentro del marco 4:3, con el propio fondo difuminado detras.

    Una foto vertical de coctel mide 2:3; al recortarla a 4:3 se pierde la
    mitad de la altura y la copa sale partida —"fuera del marco"—. Aqui la
    foto se mete ENTERA y el hueco de los lados se rellena con ella misma,
    ampliada y desenfocada, que es como se presenta una copa alta en las
    cartas buenas: se ve el trago completo y el marco no queda con bandas.
    """
    im = Image.open(src).convert('RGB')
    W = ancho_max
    H = int(round(W / RATIO))

    # Fondo: la propia foto llenando el marco, borrosa y algo apagada.
    fe = max(W / im.width, H / im.height)
    fondo = im.resize((max(1, int(im.width * fe)), max(1, int(im.height * fe))), Image.LANCZOS)
    izq = (fondo.width - W) // 2
    arr = (fondo.height - H) // 2
    fondo = fondo.crop((izq, arr, izq + W, arr + H)).filter(ImageFilter.GaussianBlur(28))
    fondo = Image.blend(fondo, Image.new('RGB', (W, H), (12, 12, 14)), 0.35)

    # Delante, la foto completa.
    fd = min(W / im.width, H / im.height)
    frente = im.resize((max(1, int(im.width * fd)), max(1, int(im.height * fd))), Image.LANCZOS)
    fondo.paste(frente, ((W - frente.width) // 2, (H - frente.height) // 2))
    fondo.save(dst, 'JPEG', quality=90, optimize=True)
    return fondo.size
