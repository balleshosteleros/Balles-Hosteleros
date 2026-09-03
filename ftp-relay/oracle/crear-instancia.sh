#!/usr/bin/env bash
# ============================================================================
# Pesca una instancia ARM "always free" de Oracle Cloud para el relay FTP.
#
# Las instancias gratuitas ARM (VM.Standard.A1.Flex) casi siempre están
# agotadas: Oracle responde "Out of host capacity". Este script reintenta cada
# pocos minutos hasta que una queda libre, probando todos los dominios de
# disponibilidad de la región.
#
# Uso:
#   ./crear-instancia.sh              # reintenta indefinidamente
#   ESPERA=120 ./crear-instancia.sh   # reintenta cada 2 minutos
#
# Requiere: OCI CLI configurada (~/.oci/config) y las variables de abajo.
# ============================================================================

set -uo pipefail

# --- Configuración (rellenar antes de ejecutar) ------------------------------
# Los tres primeros valores salen de la consola de Oracle. Ver README.md.
COMPARTMENT_ID="${COMPARTMENT_ID:-}"   # OCID del compartimento (raíz vale)
SUBNET_ID="${SUBNET_ID:-}"             # OCID de la subred pública de la VCN
SSH_KEY_PUB="${SSH_KEY_PUB:-$HOME/.ssh/oracle-relay.pub}"

# Imagen: Ubuntu 22.04 ARM. Se resuelve sola si se deja vacío.
IMAGE_ID="${IMAGE_ID:-}"

NOMBRE="${NOMBRE:-balles-ftp-relay}"
# Always Free ARM: hasta 4 OCPU y 24 GB repartidos entre tus instancias.
OCPUS="${OCPUS:-2}"
MEMORIA_GB="${MEMORIA_GB:-12}"
ESPERA="${ESPERA:-180}"                # segundos entre reintentos

# --- Comprobaciones previas --------------------------------------------------
if ! command -v oci >/dev/null 2>&1; then
  echo "ERROR: falta la CLI de Oracle (oci). Instálala con:"
  echo "  bash -c \"\$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)\""
  exit 1
fi

for var in COMPARTMENT_ID SUBNET_ID; do
  if [ -z "${!var}" ]; then
    echo "ERROR: falta $var. Edita este script o expórtala. Ver README.md."
    exit 1
  fi
done

if [ ! -f "$SSH_KEY_PUB" ]; then
  echo "ERROR: no existe la clave pública $SSH_KEY_PUB"
  echo "Créala con: ssh-keygen -t ed25519 -f ${SSH_KEY_PUB%.pub} -N ''"
  exit 1
fi

# Ubuntu 22.04 ARM más reciente de la región, si no se fijó una imagen.
if [ -z "$IMAGE_ID" ]; then
  echo "Buscando la imagen de Ubuntu 22.04 ARM..."
  IMAGE_ID=$(oci compute image list \
    --compartment-id "$COMPARTMENT_ID" \
    --operating-system "Canonical Ubuntu" \
    --operating-system-version "22.04" \
    --shape "VM.Standard.A1.Flex" \
    --sort-by TIMECREATED --sort-order DESC \
    --query 'data[0].id' --raw-output 2>/dev/null)
  if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "ERROR: no se pudo resolver la imagen. Indica IMAGE_ID a mano."
    exit 1
  fi
fi

# Los dominios de disponibilidad se prueban en rotación: la capacidad libre
# aparece en uno u otro sin previo aviso.
# (sin mapfile: el bash 3.2 de macOS no lo trae)
ADS=()
while IFS= read -r ad; do
  [ -n "$ad" ] && ADS+=("$ad")
done < <(oci iam availability-domain list \
  --compartment-id "$COMPARTMENT_ID" --query 'data[].name' --raw-output \
  | tr -d '[]," ')

if [ "${#ADS[@]}" -eq 0 ]; then
  echo "ERROR: no se encontraron dominios de disponibilidad."
  exit 1
fi

echo "============================================================"
echo " Pescando instancia ARM gratuita para el relay FTP"
echo " Nombre:   $NOMBRE  ($OCPUS OCPU / $MEMORIA_GB GB)"
echo " Dominios: ${ADS[*]}"
echo " Reintento cada ${ESPERA}s. Ctrl+C para parar."
echo "============================================================"

intento=0
while true; do
  intento=$((intento + 1))
  for ad in "${ADS[@]}"; do
    printf '[%s] intento %d en %s... ' "$(date +%H:%M:%S)" "$intento" "$ad"

    salida=$(oci compute instance launch \
      --compartment-id "$COMPARTMENT_ID" \
      --availability-domain "$ad" \
      --shape "VM.Standard.A1.Flex" \
      --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEMORIA_GB}" \
      --image-id "$IMAGE_ID" \
      --subnet-id "$SUBNET_ID" \
      --assign-public-ip true \
      --display-name "$NOMBRE" \
      --ssh-authorized-keys-file "$SSH_KEY_PUB" \
      --wait-for-state RUNNING \
      2>&1)
    codigo=$?

    if [ $codigo -eq 0 ]; then
      echo "CONSEGUIDA"
      instance_id=$(echo "$salida" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
      ip=$(oci compute instance list-vnics --instance-id "$instance_id" \
        --query 'data[0]."public-ip"' --raw-output 2>/dev/null)
      echo
      echo "============================================================"
      echo " Instancia lista."
      echo " IP pública: $ip"
      echo
      echo " Siguiente paso: dime esta IP y despliego el relay."
      echo " Acceso:  ssh -i ${SSH_KEY_PUB%.pub} ubuntu@$ip"
      echo "============================================================"
      exit 0
    fi

    # "Out of capacity" es lo normal: seguimos. Otro error, lo mostramos.
    if echo "$salida" | grep -qi "out of host capacity\|OutOfCapacity"; then
      echo "sin capacidad"
    else
      echo "ERROR"
      echo "$salida" | tail -5
      echo
      echo "Este error no es falta de capacidad: revísalo antes de seguir."
      exit 1
    fi
  done
  sleep "$ESPERA"
done
