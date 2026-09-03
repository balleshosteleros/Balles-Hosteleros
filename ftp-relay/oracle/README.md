# Relay FTP en Oracle Cloud (gratis)

Cómo poner en marcha el relay FTP en el **Always Free Tier** de Oracle Cloud,
sin coste. Es el plan de arranque para HABANA y BACANAL; en enero, al empezar a
vender el software, se migra a un VPS de pago (~4,50 €/mes) por fiabilidad.

## Por qué Oracle y no un VPS de pago

La instancia ARM gratuita da **4 vCPU / 24 GB / 10 TB de tráfico**, muy por
encima de lo que consume el relay (dos locales usan ~2%). Es gratis "para
siempre", sin periodo de prueba.

El riesgo real, para tenerlo presente: Oracle puede suspender cuentas gratuitas
sin demasiado aviso. Si eso pasa, se deja de subir vídeo a la nube — pero **el
grabador sigue guardando en su disco local**, así que se pierde el respaldo de
esos días, no las imágenes.

## Paso 1 — Crear la cuenta

En https://cloud.oracle.com → *Start for free*.

- Pide **tarjeta** para verificar identidad. Hace un cargo de ~1 € que devuelve.
  No cobra nada mientras te quedes en recursos Always Free.
- **Elige bien la región**: no se puede cambiar después. Madrid o Frankfurt para
  España (cuanto más cerca del local, mejor la subida del grabador).
- Al terminar, en la consola busca *Compute → Instances* para comprobar acceso.

## Paso 2 — Instalar la CLI y configurarla

```bash
# Instalar la CLI de Oracle
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"

# Configurar el acceso (pide tenancy, usuario y región; genera claves API)
oci setup config
```

`oci setup config` te pedirá el **OCID de tu usuario** y el **de la tenancy**.
Ambos salen en la consola de Oracle: menú de perfil (arriba a la derecha) →
*Tenancy* y *User settings*. Al final genera una clave API que hay que **subir a
la consola** en *User settings → API keys → Add API key* (pega el contenido de
`~/.oci/oci_api_key_public.pem`).

Comprueba que funciona:

```bash
oci iam region list
```

## Paso 3 — Red y clave SSH

En la consola: *Networking → Virtual Cloud Networks → Start VCN Wizard* →
**"VCN with Internet Connectivity"**. Acepta los valores por defecto. Eso crea
una VCN con una **subred pública**, que es la que necesitas.

Clave SSH para entrar a la máquina:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/oracle-relay -N ''
```

## Paso 4 — Pescar la instancia

Las instancias ARM gratuitas **casi siempre están agotadas**: Oracle responde
*"Out of host capacity"*. El script reintenta hasta que una queda libre — puede
tardar horas o días, así que déjalo corriendo.

Necesitas dos identificadores de la consola:

- `COMPARTMENT_ID`: *Identity → Compartments* (el compartimento raíz sirve).
- `SUBNET_ID`: la subred **pública** creada en el paso 3.

```bash
export COMPARTMENT_ID="ocid1.compartment.oc1..xxxxx"
export SUBNET_ID="ocid1.subnet.oc1.eu-madrid-1.xxxxx"

./crear-instancia.sh
```

Cuando lo consiga, imprime la **IP pública**. Esa IP es lo único que hace falta
para el siguiente paso.

## Paso 5 — Abrir los puertos del FTP

Dos sitios, y hay que hacer **los dos** (olvidar el segundo es el fallo típico):

1. **Security List de la VCN** (consola de Oracle): reglas de entrada para
   **TCP 21** y **TCP 30000-30009**, origen `0.0.0.0/0`.
2. **Cortafuegos de Ubuntu**, dentro de la máquina:

```bash
sudo iptables -I INPUT -p tcp --dport 21 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 30000:30009 -j ACCEPT
sudo netfilter-persistent save
```

> Conviene restringir el origen a las IP de los routers de Habana y Bacanal en
> vez de `0.0.0.0/0`, ya que el FTP viaja sin cifrar. Se puede afinar después.

## Paso 6 — Desplegar el relay

Con la IP pública en la mano, esto lo hago yo. Es instalar Docker, copiar
`ftp-relay/`, rellenar el `.env` con `FTP_PASV_URL` = esa IP, y levantarlo.

## Paso 7 — Configurar cada grabador

En el XVR Dahua (`DH-XVR4116HS-I`), desde su pantalla o interfaz web:

- *Almacenamiento → FTP*: dirección = la IP de la instancia, puerto 21, y el
  usuario/contraseña del conector (el `device_token` del emparejamiento).
- *Evento → Detección de movimiento*: activar en las cámaras que interese, y
  marcar la subida FTP como acción del evento.

Detalle importante: **la caja conviene dejarla en grabación continua**, no por
movimiento. Es donde luego se reclama y donde no puedes permitirte un hueco.
