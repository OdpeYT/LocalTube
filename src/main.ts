import { convertFileSrc, invoke } from "@tauri-apps/api/core";

interface VideoMetadata {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  objectUrl?: string;
}

const $ = <T extends HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(selector);

const folderInput = $<HTMLInputElement>("#folder-path");
const scanForm = $<HTMLFormElement>("#scan-form");
const scanButton = $<HTMLButtonElement>("#scan-button");
const scanStatus = $<HTMLElement>("#scan-status");
const videoGrid = $<HTMLDivElement>("#videoGrid");
const emptyState = $<HTMLDivElement>("#emptyState");
const countBadge = $<HTMLSpanElement>("#videoCountBadge");
const searchInput = $<HTMLInputElement>("#searchInput");
const clearSearchButton = $<HTMLButtonElement>("#clearSearchBtn");
const uploadInput = $<HTMLInputElement>("#localVideoUpload");
const player = $<HTMLVideoElement>("#mainVideoPlayer");
const libraryView = $<HTMLElement>("#libraryView");
const playerView = $<HTMLElement>("#playerView");
const snackbar = $<HTMLDivElement>("#m3Snackbar");

const posterPalettes = [
  ["#3b82f6", "#1d4ed8"],
  ["#10b981", "#047857"],
  ["#8b5cf6", "#6d28d9"],
  ["#ec4899", "#be185d"],
  ["#f59e0b", "#c2410c"],
  ["#06b6d4", "#1d4ed8"],
];

let scannedVideos: VideoMetadata[] = [];
let importedVideos: VideoMetadata[] = [];
let activeFilter = "all";
let currentVideoId: string | null = null;
let snackbarTimer: number | undefined;
let speedIndex = 0;
const speeds = [1, 1.25, 1.5, 2, 0.75];
const favorites = new Set<string>(
  JSON.parse(localStorage.getItem("localtube-favorites") ?? "[]") as string[],
);

function allVideos(): VideoMetadata[] {
  return [...scannedVideos, ...importedVideos];
}

function isFavorite(video: VideoMetadata): boolean {
  return favorites.has(video.id);
}

function saveFavorites(): void {
  localStorage.setItem("localtube-favorites", JSON.stringify([...favorites]));
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return "--:--";
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function paletteFor(video: VideoMetadata): string[] {
  const hash = [...video.name].reduce((value, char) => value + char.charCodeAt(0), 0);
  return posterPalettes[hash % posterPalettes.length] ?? posterPalettes[0]!;
}

function showSnackbar(message: string): void {
  if (!snackbar) return;
  snackbar.textContent = message;
  snackbar.classList.add("visible");
  window.clearTimeout(snackbarTimer);
  snackbarTimer = window.setTimeout(() => snackbar.classList.remove("visible"), 2600);
}

function filteredVideos(): VideoMetadata[] {
  const query = searchInput?.value.trim().toLocaleLowerCase() ?? "";
  return allVideos().filter((video) => {
    const extension = video.name.split(".").pop()?.toLowerCase();
    const matchesExtension = activeFilter === "all"
      || (activeFilter === "favorites" ? isFavorite(video) : extension === activeFilter);
    return matchesExtension && video.name.toLocaleLowerCase().includes(query);
  });
}

function createVideoCard(video: VideoMetadata): HTMLElement {
  const card = document.createElement("article");
  card.className = "video-card liquid-glass";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Reproducir ${video.name}`);

  const poster = document.createElement("div");
  poster.className = "video-poster";
  const [colorA, colorB] = paletteFor(video);
  poster.style.setProperty("--poster-a", colorA ?? "#3b82f6");
  poster.style.setProperty("--poster-b", colorB ?? "#1d4ed8");

  const play = document.createElement("span");
  play.className = "poster-play";
  play.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';

  const favoriteButton = document.createElement("button");
  favoriteButton.className = `favorite-button${isFavorite(video) ? " is-favorite" : ""}`;
  favoriteButton.type = "button";
  favoriteButton.title = isFavorite(video) ? "Quitar de favoritos" : "Añadir a favoritos";
  favoriteButton.setAttribute("aria-label", favoriteButton.title);
  favoriteButton.innerHTML = `<span class="material-symbols-rounded">${isFavorite(video) ? "favorite" : "favorite_border"}</span>`;
  favoriteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(video);
  });

  const duration = document.createElement("span");
  duration.className = "poster-duration";
  duration.textContent = formatDuration(undefined);

  const info = document.createElement("div");
  info.className = "video-card-info";
  const typeIcon = document.createElement("span");
  typeIcon.className = "video-type-icon";
  typeIcon.innerHTML = '<span class="material-symbols-rounded">movie</span>';

  const text = document.createElement("span");
  text.className = "video-card-text";
  const title = document.createElement("strong");
  title.textContent = video.name;
  title.title = video.path;
  const metadata = document.createElement("small");
  metadata.textContent = `${formatSize(video.sizeBytes)} · ${video.modifiedAt}`;
  text.append(title, metadata);
  info.append(typeIcon, text);
  poster.append(play, favoriteButton, duration);
  card.append(poster, info);

  const open = (): void => void openPlayer(video);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });

  const previewVideo = document.createElement("video");
  previewVideo.preload = "metadata";
  previewVideo.muted = true;
  previewVideo.src = sourceFor(video);
  previewVideo.addEventListener("loadedmetadata", () => {
    duration.textContent = formatDuration(previewVideo.duration);
    previewVideo.removeAttribute("src");
    previewVideo.load();
  }, { once: true });

  return card;
}

function renderGrid(): void {
  if (!videoGrid || !emptyState || !countBadge) return;
  const videos = filteredVideos();
  videoGrid.replaceChildren(...videos.map(createVideoCard));
  countBadge.textContent = `${allVideos().length} ${allVideos().length === 1 ? "video" : "videos"}`;
  emptyState.classList.toggle("hidden", videos.length > 0);
  videoGrid.classList.toggle("hidden", videos.length === 0);
}

function sourceFor(video: VideoMetadata): string {
  return video.objectUrl ?? convertFileSrc(video.path);
}

function toggleFavorite(video: VideoMetadata): void {
  if (favorites.has(video.id)) {
    favorites.delete(video.id);
    showSnackbar("Eliminado de favoritos");
  } else {
    favorites.add(video.id);
    showSnackbar("Añadido a favoritos");
  }
  saveFavorites();
  renderGrid();
  if (currentVideoId === video.id) updateFavoriteButton(video);
}

function updateFavoriteButton(video: VideoMetadata): void {
  const icon = $("#playerFavIcon");
  const text = $("#playerFavText");
  const button = $("#playerFavBtn");
  if (icon) icon.textContent = isFavorite(video) ? "favorite" : "favorite_border";
  if (text) text.textContent = isFavorite(video) ? "En favoritos" : "Favorito";
  button?.classList.toggle("is-favorite", isFavorite(video));
}

function formatClock(dateString: string): string {
  if (dateString === "Desconocida") return dateString;
  return dateString;
}

function updateProgress(): void {
  if (!player) return;
  const percent = player.duration ? (player.currentTime / player.duration) * 100 : 0;
  const fill = $("#progressFill");
  const thumb = $("#progressThumb");
  const currentTime = $("#currentTimeText");
  const totalTime = $("#totalDurationText");
  if (fill) fill.style.width = `${percent}%`;
  if (thumb) thumb.style.left = `${percent}%`;
  if (currentTime) currentTime.textContent = formatDuration(player.currentTime);
  if (totalTime) totalTime.textContent = formatDuration(player.duration);
}

function setPlayerVideo(video: VideoMetadata, autoplay: boolean): void {
  if (!player) return;
  currentVideoId = video.id;
  player.src = sourceFor(video);
  player.playbackRate = speeds[speedIndex] ?? 1;
  const title = $("#playerTitle");
  const date = $("#playerDate");
  const size = $("#playerSizeBadge");
  if (title) title.textContent = video.name;
  if (date) date.textContent = `Modificado ${formatClock(video.modifiedAt)}`;
  if (size) size.textContent = formatSize(video.sizeBytes);
  const location = $("#exifLocation");
  const time = $("#exifTime");
  const device = $("#exifDevice");
  if (location) location.textContent = "No disponible en este archivo";
  if (time) time.textContent = video.modifiedAt;
  if (device) device.textContent = "No disponible en este archivo";
  updateFavoriteButton(video);
  renderQueue();
  updateProgress();
  if (autoplay) {
    void player.play().catch(() => showSnackbar("No se pudo reproducir este archivo de video."));
  }
}

async function openPlayer(video: VideoMetadata): Promise<void> {
  if (!libraryView || !playerView || !player) return;
  libraryView.classList.add("hidden");
  playerView.classList.remove("hidden");
  setPlayerVideo(video, true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToLibrary(): void {
  player?.pause();
  if (player) {
    player.removeAttribute("src");
    player.load();
  }
  currentVideoId = null;
  playerView?.classList.add("hidden");
  libraryView?.classList.remove("hidden");
}

function renderQueue(): void {
  const queue = $("#queueList");
  if (!queue) return;
  queue.replaceChildren();

  for (const [index, video] of allVideos().entries()) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `queue-item${video.id === currentVideoId ? " active" : ""}`;

    const poster = document.createElement("span");
    poster.className = "queue-poster";
    poster.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
    const text = document.createElement("span");
    text.className = "queue-text";
    const title = document.createElement("strong");
    title.textContent = video.name;
    const subtitle = document.createElement("small");
    subtitle.textContent = `${formatSize(video.sizeBytes)} · ${video.modifiedAt}`;
    text.append(title, subtitle);
    item.append(poster, text);
    item.addEventListener("click", () => setPlayerVideo(video, true));

    const [colorA, colorB] = posterPalettes[index % posterPalettes.length] ?? ["#3b82f6", "#1d4ed8"];
    poster.style.background = `linear-gradient(135deg, ${colorA}, ${colorB})`;
    queue.append(item);
  }
}

function changeFilter(filter: string): void {
  activeFilter = filter;
  document.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.classList.toggle("liquid-glass", !active);
  });
  renderGrid();
}

async function scanVideos(): Promise<void> {
  if (!folderInput || !scanButton || !scanStatus) return;
  const folderPath = folderInput.value.trim();
  if (!folderPath) {
    scanStatus.textContent = "Escribe la ruta de una carpeta para buscar videos.";
    return;
  }

  scanButton.disabled = true;
  scanStatus.textContent = "Buscando videos…";
  try {
    const results = await invoke<Array<Omit<VideoMetadata, "id" | "sizeBytes" | "modifiedAt"> & {
      size_bytes: number;
      modified_at: string;
    }>>("scan_local_storage", { folderPath });
    scannedVideos = results.map((video) => ({
      id: video.path,
      name: video.name,
      path: video.path,
      sizeBytes: video.size_bytes,
      modifiedAt: video.modified_at,
    }));
    scanStatus.textContent = scannedVideos.length
      ? `Se encontraron ${scannedVideos.length} videos en esta carpeta.`
      : "No se encontraron archivos MP4, MKV, WebM o MOV en esta carpeta.";
  } catch (error) {
    scanStatus.textContent = `No se pudo escanear la carpeta: ${String(error)}`;
  } finally {
    scanButton.disabled = false;
    renderGrid();
  }
}

function addUploadedFiles(files: FileList | File[]): void {
  const videoFiles = Array.from(files).filter((file) =>
    file.type.startsWith("video/")
    || /\.(mp4|mkv|webm|mov)$/i.test(file.name)
  );
  if (videoFiles.length === 0) {
    showSnackbar("No se seleccionaron archivos de video compatibles.");
    return;
  }

  for (const file of videoFiles) {
    const url = URL.createObjectURL(file);
    importedVideos.push({
      id: url,
      name: file.name,
      path: file.name,
      objectUrl: url,
      sizeBytes: file.size,
      modifiedAt: new Intl.DateTimeFormat("es", { dateStyle: "short" }).format(file.lastModified),
    });
  }
  renderGrid();
  renderQueue();
  showSnackbar(`${videoFiles.length} ${videoFiles.length === 1 ? "video añadido" : "videos añadidos"} a la biblioteca.`);
}

function setTab(tab: "queue" | "exif"): void {
  const isQueue = tab === "queue";
  $("#queueTabContent")?.classList.toggle("hidden", !isQueue);
  $("#exifTabContent")?.classList.toggle("hidden", isQueue);
  $("#tabQueueBtn")?.classList.toggle("active", isQueue);
  $("#tabExifBtn")?.classList.toggle("active", !isQueue);
}

function setImageAdjustments(): void {
  const brightness = $("#brightnessSlider") as HTMLInputElement | null;
  const contrast = $("#contrastSlider") as HTMLInputElement | null;
  const brightnessValue = $("#brightnessVal");
  const contrastValue = $("#contrastVal");
  if (!brightness || !contrast || !player) return;
  if (brightnessValue) brightnessValue.textContent = `${brightness.value}%`;
  if (contrastValue) contrastValue.textContent = `${contrast.value}%`;
  player.style.filter = `brightness(${brightness.value}%) contrast(${contrast.value}%)`;
}

window.addEventListener("DOMContentLoaded", async () => {
  scanForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void scanVideos();
  });

  $("#home-button")?.addEventListener("click", returnToLibrary);
  $("#back-button")?.addEventListener("click", returnToLibrary);
  $("#upload-button")?.addEventListener("click", () => uploadInput?.click());
  $("#queue-add-button")?.addEventListener("click", () => uploadInput?.click());
  $("#dropZone")?.addEventListener("click", () => uploadInput?.click());
  uploadInput?.addEventListener("change", () => {
    if (uploadInput.files) addUploadedFiles(uploadInput.files);
    uploadInput.value = "";
  });

  $("#reset-library-button")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (clearSearchButton) clearSearchButton.classList.add("hidden");
    changeFilter("all");
  });

  searchInput?.addEventListener("input", () => {
    clearSearchButton?.classList.toggle("hidden", !searchInput.value);
    renderGrid();
  });
  clearSearchButton?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    clearSearchButton.classList.add("hidden");
    searchInput?.focus();
    renderGrid();
  });

  document.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => changeFilter(button.dataset.filter ?? "all"));
  });

  $("#theme-button")?.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    document.documentElement.classList.toggle("dark", !isLight);
    const icon = $("#themeIcon");
    if (icon) icon.textContent = isLight ? "dark_mode" : "light_mode";
    localStorage.setItem("localtube-theme", isLight ? "light" : "dark");
  });
  if (localStorage.getItem("localtube-theme") === "light") {
    document.body.classList.add("light-theme");
    document.documentElement.classList.remove("dark");
    const icon = $("#themeIcon");
    if (icon) icon.textContent = "dark_mode";
  }

  document.querySelectorAll<HTMLButtonElement>(".side-tab").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab === "exif" ? "exif" : "queue"));
  });

  $("#playerFavBtn")?.addEventListener("click", () => {
    const video = allVideos().find((item) => item.id === currentVideoId);
    if (video) toggleFavorite(video);
  });

  if (player) {
    player.addEventListener("timeupdate", updateProgress);
    player.addEventListener("loadedmetadata", updateProgress);
    player.addEventListener("durationchange", updateProgress);
    player.addEventListener("play", () => {
      const icon = $("#mainPlayPauseIcon");
      if (icon) icon.textContent = "pause";
    });
    player.addEventListener("pause", () => {
      const icon = $("#mainPlayPauseIcon");
      if (icon) icon.textContent = "play_arrow";
    });
    player.addEventListener("error", () => showSnackbar("El reproductor no pudo abrir este archivo."));
  }

  $("#mainPlayPauseBtn")?.addEventListener("click", () => {
    if (!player) return;
    if (player.paused) void player.play().catch(() => showSnackbar("No se pudo reproducir este archivo."));
    else player.pause();
  });
  $("#prev-button")?.addEventListener("click", () => moveInQueue(-1));
  $("#next-button")?.addEventListener("click", () => moveInQueue(1));
  $("#volumeButton")?.addEventListener("click", () => {
    if (!player) return;
    player.muted = !player.muted;
    const icon = $("#volumeIcon");
    if (icon) icon.textContent = player.muted ? "volume_off" : "volume_up";
  });
  const volumeSlider = $("#volumeSlider") as HTMLInputElement | null;
  volumeSlider?.addEventListener("input", () => {
    if (player && volumeSlider) {
      player.volume = Number(volumeSlider.value);
      player.muted = false;
      const icon = $("#volumeIcon");
      if (icon) icon.textContent = "volume_up";
    }
  });
  $("#speedBtn")?.addEventListener("click", (event) => {
    speedIndex = (speedIndex + 1) % speeds.length;
    const speed = speeds[speedIndex] ?? 1;
    if (player) player.playbackRate = speed;
    (event.currentTarget as HTMLButtonElement).textContent = `${speed.toFixed(2).replace(/\.00$/, ".0")}x`;
  });
  $("#fullscreen-button")?.addEventListener("click", () => {
    const viewport = $(".video-viewport");
    if (!viewport) return;
    if (!document.fullscreenElement) void viewport.requestFullscreen();
    else void document.exitFullscreen();
  });
  $("#scrubberWrapper")?.addEventListener("click", (event) => {
    if (!player?.duration) return;
    const scrubber = event.currentTarget as HTMLElement;
    const rect = scrubber.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    player.currentTime = ratio * player.duration;
  });

  $("#brightnessSlider")?.addEventListener("input", setImageAdjustments);
  $("#contrastSlider")?.addEventListener("input", setImageAdjustments);

  const dropZone = $("#dropZone");
  dropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-active");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drag-active"));
  dropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-active");
    if (event.dataTransfer?.files) addUploadedFiles(event.dataTransfer.files);
  });

  if (folderInput && scanStatus) {
    try {
      folderInput.value = await invoke<string>("default_video_directory");
      await scanVideos();
    } catch (error) {
      scanStatus.textContent = `No se pudo preparar la biblioteca: ${String(error)}`;
    }
  }
});

function moveInQueue(direction: -1 | 1): void {
  const videos = allVideos();
  if (videos.length === 0) return;
  const currentIndex = videos.findIndex((video) => video.id === currentVideoId);
  const nextIndex = (currentIndex + direction + videos.length) % videos.length;
  const video = videos[nextIndex];
  if (video) setPlayerVideo(video, true);
}
