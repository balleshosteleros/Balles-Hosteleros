#!/usr/bin/env python3
"""
Seed Incremento 1 (HABANA) — proveedor principal + stock máximo provisional.
Hermano de seed_proveedor_principal_bacanal.py (misma lógica), para la empresa Habana.

Siembra `ingredientes_proveedor` (es_preferido=true=principal) para los productos de
compra de los albaranes reales de Habana (Belmon→BELMONTE, Dither→DITHER) y fija un
stock máximo PROVISIONAL plano (=10). Shisha (sin proveedor claro) y Krittikali (menaje)
quedan fuera de este incremento.

Idempotente (no duplica IP) y reversible (modo `revert`: borra pares y máximos a 0).
Uso:  python3 seed_proveedor_principal_habana.py [dry|live|revert]   (default dry)
Regla de Seguridad Ágora: ante cualquier error HTTP, para y muestra el error exacto.
"""
import sys, json, urllib.request, urllib.error

HAB = "00000000-0000-0000-0000-000000000001"
MAX_PROVISIONAL = 10

SEED = {
 "BELMONTE": [("Larios Rose",12.27),("Ron Limon",8.57),("Sifon",9.65),("Tinto de Verano La Casera",8.98),
              ("Seville Orange Licor",8.84),("Seagrams",13.65),("Red Bull",26.16),("Red Label",11.60),
              ("Black Label",22.10),("Ballantines",11.54),("Jaggermaister",14.80),("Alma Blanco",3.44),
              ("Absolut",11.87),("Curacao Azul",7.59),("Cachasa",10.60),("Licor Malibu",10.48),
              ("Oxefruit Maracuya",12.21),("Granadina",4.16),("Oxefruit Coco",12.21),("Oxefruit Piña",12.21),
              ("Oxefruit Sandia",12.21),("Oxefruit Mango",12.21),("Oxefruit Platano",12.21),("Smirnoff",8.99)],
 "DITHER": [("Zumo Piña",1.30),("Azucar Moreno",2.50),("Canela Rama",6.90),("Fresas",3.90),("Hierbabuena",1.50),
            ("Limas",3.99),("Limones",1.50),("Mango",4.99),("Naranjas",1.50),("Piña",1.99),("Platanos",1.99),
            ("Romero",1.50),("Azucar",1.75),("Sandia",2.50)],
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
        sys.exit(f"\n❌ ERROR HTTP {e.code} en {method} {path}\n{e.read().decode()[:400]}\nDETENIDO.")

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "dry"
    prov = req("GET", f"proveedores?empresa_id=eq.{HAB}&select=id,nombre_comercial&limit=300")
    prod = req("GET", f"productos?tipo=eq.compra&estado=eq.Activo&empresa_id=eq.{HAB}&select=id,nombre&limit=5000")
    stock = req("GET", f"stock?empresa_id=eq.{HAB}&select=id,producto_id&limit=5000")
    ip = req("GET", "ingredientes_proveedor?select=producto_id,proveedor_id&limit=20000")
    prov_by = {p["nombre_comercial"].strip().upper(): p["id"] for p in prov}
    prod_by = {p["nombre"].strip(): p["id"] for p in prod}
    stockrow_by = {s["producto_id"]: s["id"] for s in stock if s.get("producto_id")}
    existing = {(r["producto_id"], r["proveedor_id"]) for r in ip}

    plan = []
    for pname, items in SEED.items():
        pid = prov_by.get(pname.upper())
        if not pid: sys.exit(f"Proveedor no hallado: {pname}")
        for nombre, precio in items:
            prid = prod_by.get(nombre)
            if not prid: sys.exit(f"Producto no hallado: '{nombre}'")
            plan.append((pname, nombre, prid, pid, precio, stockrow_by.get(prid)))

    print(f"=== modo={mode} · {len(plan)} líneas (HABANA) ===")
    if mode == "dry":
        for pn, nom, prid, pid, precio, srid in plan:
            print(f"  {'·ya' if (prid,pid) in existing else '+ '} {pn:12} {nom[:32]:32} precio={precio}")
        print("(dry-run, sin escribir)"); return
    if mode == "revert":
        for pn, nom, prid, pid, precio, srid in plan:
            req("DELETE", f"ingredientes_proveedor?producto_id=eq.{prid}&proveedor_id=eq.{pid}")
        ids = ",".join(p[2] for p in plan); req("PATCH", f"productos?id=in.({ids})", {"stock_maximo": 0})
        srids = ",".join(p[5] for p in plan if p[5])
        if srids: req("PATCH", f"stock?id=in.({srids})", {"cantidad_maxima": 0})
        print("REVERT hecho."); return
    if mode == "live":
        nuevos = [{"producto_id": prid, "proveedor_id": pid, "precio_unitario": precio, "es_preferido": True}
                  for pn, nom, prid, pid, precio, srid in plan if (prid, pid) not in existing]
        if nuevos: req("POST", "ingredientes_proveedor", nuevos, prefer="return=minimal")
        ids = ",".join(p[2] for p in plan); req("PATCH", f"productos?id=in.({ids})", {"stock_maximo": MAX_PROVISIONAL})
        srids = ",".join(p[5] for p in plan if p[5])
        if srids: req("PATCH", f"stock?id=in.({srids})", {"cantidad_maxima": MAX_PROVISIONAL})
        print(f"LIVE hecho: {len(nuevos)} ingredientes_proveedor, {len(plan)} stock_maximo={MAX_PROVISIONAL} "
              f"({len(srids.split(',')) if srids else 0} vía stock)."); return
    sys.exit(f"Modo desconocido: {mode}")

if __name__ == "__main__":
    main()
