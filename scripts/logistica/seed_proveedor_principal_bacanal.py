#!/usr/bin/env python3
"""
Seed Incremento 1 (Bacanal) — proveedor principal + stock máximo provisional.

Siembra `ingredientes_proveedor` (es_preferido=true = principal) para los productos
de compra que aparecen en los albaranes reales 18-19/06/2026, y fija un stock máximo
PROVISIONAL plano (=10) para que "reponer almacén por stock" devuelva propuestas.

- Precio = el del último albarán (valor inicial de ficha, editable; NO se repisa luego).
- Stock máximo provisional plano = 10 (placeholder; lo reemplaza el Manual/Auto de Iván).
- Idempotente: no duplica ingredientes_proveedor (salta pares ya existentes).
- Reversible: modo `revert` borra los pares sembrados y devuelve los máximos a 0
  (estado previo medido: stock_maximo=0 y cantidad_maxima=0 en todos).

Uso:  python3 seed_proveedor_principal_bacanal.py [dry|live|revert]   (default dry)
Lee credenciales de .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
Regla de Seguridad Ágora: ante cualquier error HTTP, para y muestra el error exacto.
"""
import sys, json, os, urllib.request, urllib.error

BAC = "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47"
MAX_PROVISIONAL = 10

# proveedor BD -> [(nombre EXACTO producto BD, precio último albarán)]
SEED = {
 "DITHER": [("Mango",4.99),("Piña",1.99),("Limones",1.50),("Limas",3.99),("Zanahoria",0.89),
            ("Cebolla Roja",1.50),("Pimiento Rojo",1.50),("Pimiento Verde",2.50),("Tomate Cherry",1.99),
            ("Lechuga romana",0.99),("Patata Agria",0.80),("Cilantro",1.50),("Cebollino",1.50),
            ("Albahaca",1.99),("Hierbabuena",3.90),("Choclo",4.99),("Pamplinas",4.99),("Naranjas",1.50)],
 "BELMONTE": [("Tinto de Verano La Casera",8.98),("Alma Rosado",3.44),("Pazo San Mauro",13.30),
              ("Alma Blanco",3.44),("Licor de Manzana S/A",3.80)],
 "ENCINAR DE HUMIENTA": [("Filete de vaca para cachopo",20.00),("Tomahawk de aguja",20.90),
                         ("Hamburguesa artesana angus ( 200 gr)",16.50)],
 "ANTONIO DE MIGUEL": [("Jamon de cebo iberico 50% loncheado",6.88),("Croquetas de jamon con panko",49.20),
                       ("Queso Burratina",11.00)],
 "GARCIMAR": [("Vieira media",13.11),("Cazon Adobo enharinado",7.97),("Base de arroz de carne",87.00)],
}

def load_env():
    url=key=None
    for line in open(".env.local", encoding="utf-8"):
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="): url=line.split("=",1)[1].strip().strip('"')
        elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="): key=line.split("=",1)[1].strip().strip('"')
    if not url or not key: sys.exit("Faltan credenciales en .env.local")
    return url, key

URL, KEY = load_env()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def req(method, path, body=None, prefer=None):
    headers = dict(H)
    if prefer: headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + "/rest/v1/" + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        # Regla de Seguridad: parar y mostrar el error exacto
        sys.exit(f"\n❌ ERROR HTTP {e.code} en {method} {path}\n{e.read().decode()[:400]}\nDETENIDO. No se continúa.")

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "dry"
    prov = req("GET", f"proveedores?empresa_id=eq.{BAC}&select=id,nombre_comercial&limit=300")
    prod = req("GET", f"productos?tipo=eq.compra&estado=eq.Activo&empresa_id=eq.{BAC}&select=id,nombre&limit=5000")
    stock = req("GET", f"stock?empresa_id=eq.{BAC}&select=id,producto_id&limit=5000")
    ip = req("GET", "ingredientes_proveedor?select=producto_id,proveedor_id&limit=20000")
    prov_by = {p["nombre_comercial"].strip().upper(): p["id"] for p in prov}
    prod_by = {p["nombre"].strip(): p["id"] for p in prod}
    stockrow_by = {s["producto_id"]: s["id"] for s in stock if s.get("producto_id")}
    existing = {(r["producto_id"], r["proveedor_id"]) for r in ip}

    plan = []  # (proveedor, producto_nombre, producto_id, proveedor_id, precio, stock_row_id)
    for pname, items in SEED.items():
        pid = prov_by.get(pname.upper())
        if not pid: sys.exit(f"Proveedor no hallado: {pname}")
        for nombre, precio in items:
            prid = prod_by.get(nombre)
            if not prid: sys.exit(f"Producto no hallado: {nombre}")
            plan.append((pname, nombre, prid, pid, precio, stockrow_by.get(prid)))

    print(f"=== modo={mode} · {len(plan)} líneas (BACANAL) ===")
    if mode == "dry":
        for pn, nom, prid, pid, precio, srid in plan:
            ya = (prid, pid) in existing
            print(f"  {'·ya' if ya else '+ '} {pn:20} {nom[:32]:32} precio={precio}")
        print("(dry-run, sin escribir)")
        return

    if mode == "revert":
        for pn, nom, prid, pid, precio, srid in plan:
            req("DELETE", f"ingredientes_proveedor?producto_id=eq.{prid}&proveedor_id=eq.{pid}")
        ids = ",".join(p[2] for p in plan)
        req("PATCH", f"productos?id=in.({ids})", {"stock_maximo": 0})
        srids = ",".join(p[5] for p in plan if p[5])
        if srids: req("PATCH", f"stock?id=in.({srids})", {"cantidad_maxima": 0})
        print("REVERT hecho: pares IP borrados y máximos a 0.")
        return

    if mode == "live":
        nuevos = [{"producto_id": prid, "proveedor_id": pid, "precio_unitario": precio, "es_preferido": True}
                  for pn, nom, prid, pid, precio, srid in plan if (prid, pid) not in existing]
        if nuevos:
            req("POST", "ingredientes_proveedor", nuevos, prefer="return=minimal")
        ids = ",".join(p[2] for p in plan)
        req("PATCH", f"productos?id=in.({ids})", {"stock_maximo": MAX_PROVISIONAL})
        srids = ",".join(p[5] for p in plan if p[5])
        if srids: req("PATCH", f"stock?id=in.({srids})", {"cantidad_maxima": MAX_PROVISIONAL})
        print(f"LIVE hecho: {len(nuevos)} ingredientes_proveedor insertados (es_preferido=true), "
              f"{len(plan)} stock_maximo={MAX_PROVISIONAL} ({len(srids.split(',')) if srids else 0} vía stock).")
        return

    sys.exit(f"Modo desconocido: {mode}")

if __name__ == "__main__":
    main()
