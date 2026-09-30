const form = document.getElementById("downloadForm");
const urlInput = document.getElementById("url");
const pasteBtn = document.getElementById("pasteBtn");
const submitBtn = document.getElementById("submitBtn");
const submitText = document.getElementById("submitText");
const statusBox = document.getElementById("status");

const resultBox = document.getElementById("result");
const resultCover = document.getElementById("resultCover");
const uploaderAvatar = document.getElementById("uploaderAvatar");
const uploaderName = document.getElementById("uploaderName");
const uploaderHandle = document.getElementById("uploaderHandle");
const resultTitle = document.getElementById("resultTitle");

const statLikes = document.getElementById("statLikes");
const statViews = document.getElementById("statViews");
const statComments = document.getElementById("statComments");

const actionButtons = document.getElementById("actionButtons");
const imageGallery = document.getElementById("imageGallery");
const galleryGrid = document.getElementById("galleryGrid");

function setStatus(message, type = "loading") {
  statusBox.className = `status ${type}`;
  statusBox.textContent = message;
}

function clearStatus() {
  statusBox.className = "status hidden";
  statusBox.textContent = "";
}

function isTikTokUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "vm.tiktok.com" ||
      host === "vt.tiktok.com"
    );
  } catch {
    return false;
  }
}

function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      urlInput.focus();
    }
  } catch {
    urlInput.focus();
    setStatus("Silakan tempel URL secara manual.", "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  resultBox.classList.add("hidden");
  imageGallery.classList.add("hidden");
  actionButtons.innerHTML = "";
  galleryGrid.innerHTML = "";
  clearStatus();

  if (!isTikTokUrl(url)) {
    setStatus("Masukkan URL TikTok yang valid.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitText.textContent = "Memproses...";
  setStatus("Mengambil data video. Mohon tunggu sebentar...", "loading");

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Gagal memproses URL TikTok.");
    }

    // Populate metadata
    resultCover.src = data.cover || "";
    uploaderAvatar.src = data.uploader.avatar || "https://www.tiktok.com/favicon.ico";
    uploaderName.textContent = data.uploader.name || "TikTok User";
    uploaderHandle.textContent = data.uploader.username ? `@${data.uploader.username}` : "";
    resultTitle.textContent = data.title || "TikTok Video";

    statLikes.textContent = `❤️ ${formatNumber(data.stats.likes)}`;
    statViews.textContent = `👁️ ${formatNumber(data.stats.views)}`;
    statComments.textContent = `💬 ${formatNumber(data.stats.comments)}`;

    // Populate buttons
    const { downloads } = data;

    if (data.type === "video") {
      if (downloads.noWatermark) {
        const btn = document.createElement("a");
        btn.className = "btn-download btn-primary";
        btn.href = downloads.noWatermark;
        btn.innerHTML = "🚀 Download No Watermark";
        actionButtons.appendChild(btn);
      }

      if (downloads.hd) {
        const btn = document.createElement("a");
        btn.className = "btn-download btn-secondary";
        btn.href = downloads.hd;
        btn.innerHTML = "📺 Download HD";
        actionButtons.appendChild(btn);
      }

      if (downloads.watermark) {
        const btn = document.createElement("a");
        btn.className = "btn-download btn-secondary";
        btn.href = downloads.watermark;
        btn.innerHTML = "💧 Download With Watermark";
        actionButtons.appendChild(btn);
      }
    }

    if (downloads.audio) {
      const btn = document.createElement("a");
      btn.className = "btn-download btn-audio";
      btn.href = downloads.audio;
      btn.innerHTML = "🎵 Download Audio (MP3)";
      actionButtons.appendChild(btn);
    }

    // Populate images if type === 'image'
    if (data.type === "image" && downloads.images && downloads.images.length > 0) {
      imageGallery.classList.remove("hidden");
      downloads.images.forEach((imgObj, idx) => {
        const item = document.createElement("div");
        item.className = "gallery-item";
        item.innerHTML = `
          <img src="${imgObj.url}" alt="Slide ${idx + 1}">
          <a class="btn-download btn-primary" href="${imgObj.downloadUrl}">Unduh #${idx + 1}</a>
        `;
        galleryGrid.appendChild(item);
      });
    }

    resultBox.classList.remove("hidden");
    setStatus("Media berhasil diekstrak! Klik tombol di bawah untuk mengunduh.", "success");
  } catch (error) {
    setStatus(error.message || "Terjadi kesalahan.", "error");
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Proses";
  }
});
