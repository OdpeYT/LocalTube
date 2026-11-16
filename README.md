# LocalTube

LocalTube scans a selected local folder and lists video files with the `.mp4`,
`.mkv`, `.webm`, and `.mov` extensions. It scans only the selected folder, not
its subfolders.

## Run in development

From the project directory, run:

```sh
npm install
npm run tauri dev
```

The app initially checks `Videos`, `Descargas`, or `Downloads` in your home
folder (whichever exists first). Enter another folder path to scan it instead.

## Install on Linux Mint, Ubuntu, or Debian

Install Node.js 20.19 or later and Rust with `rustup`, then run:

```sh
git clone https://github.com/TU_USUARIO/localtube.git
cd localtube
chmod +x install.sh
./install.sh
```

The installer installs Tauri's Debian/Ubuntu build dependencies, builds a `.deb`
package, and installs it. It asks for your administrator password through `sudo`.

## Upload this project to GitHub

Create an empty repository on GitHub (for example, `localtube`), then run these
commands from this project directory, replacing `TU_USUARIO` with your GitHub
username:

```sh
git init
git add .
git commit -m "Initial LocalTube app"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/localtube.git
git push -u origin main
```

Do not upload `node_modules` or compiled `target` files; they are excluded by
the project's `.gitignore`.
