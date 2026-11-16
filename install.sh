#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f package.json || ! -f src-tauri/Cargo.toml ]]; then
  echo "Error: ejecuta este script desde una copia completa del repositorio LocalTube." >&2
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]] || ! command -v apt-get >/dev/null 2>&1; then
  echo "Este instalador está preparado para Linux Mint, Ubuntu y Debian." >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
elif command -v sudo >/dev/null 2>&1; then
  SUDO=(sudo)
else
  echo "Error: se necesita sudo para instalar las dependencias del sistema y LocalTube." >&2
  exit 1
fi

for tool in node npm cargo rustc; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta '$tool'. Instala Node.js 20.19 o posterior y Rust (rustup), y vuelve a ejecutar este script." >&2
    exit 1
  fi
done

node_version="$(node -p 'process.versions.node.split(".").map(Number).slice(0, 2).join(".")')"
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
  echo "Error: Vite necesita Node.js 20.19 o posterior; detectado: $node_version." >&2
  exit 1
fi

echo "Instalando dependencias de compilación de Tauri..."
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y \
  build-essential \
  curl \
  file \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  patchelf

echo "Instalando dependencias de Node..."
npm install

echo "Compilando el paquete Debian de LocalTube..."
npm run tauri -- build --bundles deb

deb_file="$(find "$PROJECT_DIR/src-tauri/target/release/bundle/deb" -maxdepth 1 -type f -name '*.deb' -print -quit)"
if [[ -z "$deb_file" ]]; then
  echo "Error: la compilación terminó, pero no se encontró el paquete .deb." >&2
  exit 1
fi

echo "Instalando $deb_file..."
"${SUDO[@]}" apt-get install -y "$deb_file"

echo "LocalTube quedó instalado. Puedes abrirlo desde el menú de aplicaciones."
