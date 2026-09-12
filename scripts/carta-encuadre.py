"""Recorta una foto al formato que pide su categoria, sin deformarla."""
from PIL import Image

RATIOS = {"cuadrada": 1.0, "horizontal": 4/3, "vertical": 3/4}

def recortar(src, dst, formato, ancho_max=1000):
    r = RATIOS[formato]
    im = Image.open(src).convert("RGB")
    actual = im.width / im.height
    if actual > r:                            # sobra ancho: se quita por los lados
        ancho = int(round(im.height * r))
        x = (im.width - ancho) // 2
        im = im.crop((x, 0, x + ancho, im.height))
    elif actual < r:                          # sobra alto: se reparte arriba y abajo
        alto = int(round(im.width / r))
        y = (im.height - alto) // 2
        im = im.crop((0, y, im.width, y + alto))
    if im.width > ancho_max:
        im = im.resize((ancho_max, int(round(ancho_max / r))), Image.LANCZOS)
    im.save(dst, "JPEG", quality=88, optimize=True)
    return im.size
