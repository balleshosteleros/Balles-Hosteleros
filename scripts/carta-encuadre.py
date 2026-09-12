"""
Cada foto se queda con SU proporcion, solo acotada.

El marco fijo 4:3 era el problema de raiz: una foto de coctel es vertical
(2:3) y meterla en un hueco horizontal corta la copa si o si —al Desliz de
cobra le cortaba toda la decoracion y solo quedaba el vaso—. Rellenar los
lados tampoco valia: dejaba recuadros.

Asi que manda la foto. Solo se acota entre 3:4 y 4:3 para que la rejilla no
se descuadre con una foto extrema: en ese margen se pierde como mucho un 11%
del original, y lo que se pierde es borde, nunca el producto.
"""
from PIL import Image

MIN_R, MAX_R = 0.75, 4 / 3

def proporcion(im):
    return min(MAX_R, max(MIN_R, im.width / im.height))

def recortar(src, dst, ancho_max=1000):
    im = Image.open(src).convert('RGB')
    r = proporcion(im)
    actual = im.width / im.height
    if actual > r:                       # sobra ancho: se recorta por el centro
        ancho = int(round(im.height * r))
        x = (im.width - ancho) // 2
        im = im.crop((x, 0, x + ancho, im.height))
    elif actual < r:                     # sobra alto: se reparte arriba y abajo
        alto = int(round(im.width / r))  # para no llevarse ni la decoracion de
        y = (im.height - alto) // 2      # arriba ni el pie de la copa
        im = im.crop((0, y, im.width, y + alto))
    if im.width > ancho_max:
        im = im.resize((ancho_max, int(round(ancho_max / r))), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=88, optimize=True)
    return r, im.size
