# LocalTube — app para videos locales

LocalTube es una aplicación de escritorio para organizar y ver videos guardados
en tu equipo, con una biblioteca visual inspirada en YouTube.

## Qué puedes hacer

- Buscar videos en una carpeta local. La búsqueda incluye los archivos que están
  directamente dentro de esa carpeta, no sus subcarpetas.
- Añadir videos desde el selector de archivos o arrastrándolos a la aplicación.
- Ver los videos de la biblioteca en tarjetas y abrirlos con un clic.
- Reproducirlos con controles de reproducción, volumen, velocidad y pantalla
  completa.
- Consultar el tamaño del archivo y su fecha de modificación.

La aplicación admite archivos `.mp4`, `.mkv`, `.webm` y `.mov`. Los videos se
mantienen en tu equipo.

> **Información EXIF:** el panel de detalles está preparado para mostrar
> información del archivo, pero la lectura de metadatos EXIF todavía no está
> implementada. Por ahora se muestra el tamaño y la fecha de modificación; no se
> inventan datos de cámara o ubicación cuando no se han leído del video.

## Ejecutar para desarrollo

Necesitas Node.js 20.19 o posterior y Rust 1.85 o posterior. Desde la carpeta
del proyecto, ejecuta:

```sh
npm install
npm run tauri dev
```

Al iniciar, LocalTube busca una carpeta `Videos`, `Descargas` o `Downloads` en
tu directorio personal. Puedes escribir otra ruta para escanearla.

## Instalar en Linux

El instalador configura las dependencias nativas, compila la aplicación y crea
un acceso en el menú de aplicaciones para tu usuario:

```sh
git clone https://github.com/OdpeYT/localtube.git
cd localtube
./install.sh
```

Se requiere `sudo` para instalar dependencias del sistema. El instalador maneja
automáticamente Debian/Ubuntu (`apt`), Fedora (`dnf`), Arch (`pacman`) y
openSUSE (`zypper`). En otras distribuciones instala manualmente GTK3,
WebKitGTK 4.1, librsvg, OpenSSL y libxdo (paquetes de desarrollo) antes de
ejecutarlo.
