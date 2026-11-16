#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f package.json || ! -f src-tauri/Cargo.toml ]]; then
  echo "Error: ejecuta este script desde una copia completa del repositorio LocalTube." >&2
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Error: este instalador solo sirve para Linux." >&2
  exit 1
fi

for tool in node npm cargo rustc; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta '$tool'. Instala Node.js 20.19 o posterior y Rust 1.85 o posterior, y vuelve a ejecutar este script." >&2
    exit 1
  fi
done

node_version="$(node -p 'process.versions.node')"
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
  echo "Error: se requiere Node.js 20.19 o posterior; detectado: $node_version." >&2
  exit 1
fi

rust_version="$(rustc --version | awk '{print $2}')"
if ! awk -v version="$rust_version" 'BEGIN {
  split(version, parts, ".");
  exit !((parts[1] > 1) || (parts[1] == 1 && parts[2] >= 85));
}'; then
  echo "Error: se requiere Rust 1.85 o posterior; detectado: $rust_version." >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Error: no ejecutes este instalador como root; usa tu usuario normal. El script pedirá sudo cuando lo necesite." >&2
  exit 1
fi

if command -v sudo >/dev/null 2>&1; then
  SUDO=(sudo)
else
  echo "Error: sudo es necesario para instalar las dependencias del sistema." >&2
  exit 1
fi

install_system_dependencies() {
  case "$1" in
    apt-get)
      "${SUDO[@]}" apt-get update
      "${SUDO[@]}" apt-get install -y \
        build-essential curl file libayatana-appindicator3-dev \
        librsvg2-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev pkg-config
      ;;
    dnf)
      "${SUDO[@]}" dnf install -y \
        gcc gcc-c++ make curl file libappindicator-gtk3-devel \
        librsvg2-devel openssl-devel pkgconf-pkg-config webkit2gtk4.1-devel \
        libxdo-devel
      ;;
    pacman)
      "${SUDO[@]}" pacman -Sy --needed --noconfirm \
        base-devel curl file libappindicator-gtk3 librsvg openssl \
        pkgconf webkit2gtk-4.1 xdotool
      ;;
    zypper)
      "${SUDO[@]}" zypper --non-interactive refresh
      "${SUDO[@]}" zypper --non-interactive install \
        gcc gcc-c++ make curl file libayatana-appindicator3-devel \
        libopenssl-devel librsvg-devel pkg-config webkit2gtk3-devel libxdo-devel
      ;;
    *)
      echo "Error: no se reconoce un gestor de paquetes compatible." >&2
      echo "Gestores compatibles: apt (Debian/Ubuntu), dnf (Fedora), pacman (Arch) y zypper (openSUSE)." >&2
      echo "Instala las dependencias de desarrollo de GTK3, WebKitGTK 4.1, librsvg, OpenSSL y libxdo manualmente." >&2
      exit 1
      ;;
  esac
}

if command -v apt-get >/dev/null 2>&1; then
  PACKAGE_MANAGER=apt-get
elif command -v dnf >/dev/null 2>&1; then
  PACKAGE_MANAGER=dnf
elif command -v pacman >/dev/null 2>&1; then
  PACKAGE_MANAGER=pacman
elif command -v zypper >/dev/null 2>&1; then
  PACKAGE_MANAGER=zypper
else
  echo "Error: distro no soportada automáticamente." >&2
  echo "Compatible con Debian/Ubuntu (apt), Fedora (dnf), Arch (pacman) y openSUSE (zypper)." >&2
  echo "En otras distros instala GTK3, WebKitGTK 4.1, librsvg, OpenSSL y libxdo de desarrollo manualmente." >&2
  exit 1
fi

echo "Instalando dependencias de Tauri con $PACKAGE_MANAGER..."
install_system_dependencies "$PACKAGE_MANAGER"

echo "Instalando dependencias de Node..."
npm ci

echo "Compilando LocalTube..."
npm run tauri -- build --no-bundle

binary="$PROJECT_DIR/src-tauri/target/release/localtube"
if [[ ! -x "$binary" ]]; then
  echo "Error: no se encontró el ejecutable compilado en $binary." >&2
  exit 1
fi

bin_dir="$HOME/.local/bin"
applications_dir="$HOME/.local/share/applications"
icons_dir="$HOME/.local/share/icons/hicolor/256x256/apps"

install -Dm755 "$binary" "$bin_dir/localtube"
install -Dm644 "$PROJECT_DIR/public/localtube-logo.png" "$icons_dir/localtube.png"
mkdir -p "$applications_dir"
cat > "$applications_dir/localtube.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=LocalTube
Comment=Reproductor y biblioteca de videos locales
Exec="$bin_dir/localtube"
Icon=$icons_dir/localtube.png
Terminal=false
Categories=AudioVideo;Player;Video;
StartupNotify=true
EOF

echo
echo "LocalTube quedó instalado para tu usuario."
echo "Ábrelo desde el menú de aplicaciones o ejecuta: $bin_dir/localtube"
if [[ ":$PATH:" != *":$bin_dir:"* ]]; then
  echo "Nota: $bin_dir no está en PATH; el acceso del menú sí funcionará."
fi
