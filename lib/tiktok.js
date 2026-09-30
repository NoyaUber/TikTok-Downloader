const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

function safeFilename(name, fallback = "tiktok-download") {
  if (!name) return fallback;
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function absoluteUrl(pathStr) {
  if (!pathStr) return null;
  return pathStr.startsWith("http") ? pathStr : `https://www.tikwm.com${pathStr}`;
}

async function fetchTikWM(tiktokUrl) {
  const formData = new URLSearchParams();
  formData.append("url", tiktokUrl);
  formData.append("hd", "1");

  const response = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": DESKTOP_UA,
      Accept: "application/json, text/javascript, */*; q=0.01"
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`TikWM API returned HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || "Gagal mengambil data video dari server utama.");
  }

  const data = json.data;
  const isImages = Array.isArray(data.images) && data.images.length > 0;

  return {
    id: data.id,
    title: data.title || "TikTok Media",
    cover: absoluteUrl(data.cover || data.origin_cover),
    uploader: {
      name: data.author?.nickname || "TikTok User",
      username: data.author?.unique_id || "",
      avatar: absoluteUrl(data.author?.avatar)
    },
    stats: {
      views: data.play_count || 0,
      likes: data.digg_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0
    },
    type: isImages ? "image" : "video",
    video: {
      noWatermark: absoluteUrl(data.play),
      hd: absoluteUrl(data.hdplay),
      watermark: absoluteUrl(data.wmplay)
    },
    audio: absoluteUrl(data.music),
    images: isImages ? data.images.map((img) => absoluteUrl(img)) : []
  };
}

async function fetchTiklydown(tiktokUrl) {
  const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(tiktokUrl)}`;
  const response = await fetch(apiUrl, {
    headers: { "User-Agent": DESKTOP_UA }
  });

  if (!response.ok) {
    throw new Error(`Tiklydown API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data || (!data.video && !data.images)) {
    throw new Error("Tiklydown gagal menemukan media.");
  }

  const isImages = Array.isArray(data.images) && data.images.length > 0;

  return {
    id: data.id || Date.now().toString(),
    title: data.title || "TikTok Media",
    cover: data.cover || "",
    uploader: {
      name: data.author?.name || "TikTok User",
      username: data.author?.unique_id || "",
      avatar: data.author?.avatar || ""
    },
    stats: {
      views: 0,
      likes: data.stats?.likeCount || 0,
      comments: data.stats?.commentCount || 0,
      shares: data.stats?.shareCount || 0
    },
    type: isImages ? "image" : "video",
    video: {
      noWatermark: data.video?.noWatermark || data.video?.watermark || null,
      hd: data.video?.noWatermark || null,
      watermark: data.video?.watermark || null
    },
    audio: data.music?.play_url || null,
    images: isImages ? data.images.map((img) => (typeof img === "string" ? img : img.url)) : []
  };
}

async function resolveMedia(tiktokUrl) {
  let primaryError = null;

  try {
    return await fetchTikWM(tiktokUrl);
  } catch (err) {
    primaryError = err;
    console.warn("TikWM gagal, beralih ke provider cadangan:", err.message);
  }

  try {
    return await fetchTiklydown(tiktokUrl);
  } catch (fallbackErr) {
    console.error("Provider cadangan gagal:", fallbackErr.message);
    throw new Error(
      primaryError?.message || "Gagal mengambil data video TikTok. Pastikan video bersifat publik."
    );
  }
}

function buildPayload(result) {
  const safeTitle = safeFilename(result.title, "tiktok-media");
  const proxyUrl = (target, filename) =>
    target ? `/api/proxy?url=${encodeURIComponent(target)}&filename=${encodeURIComponent(filename)}` : null;

  return {
    title: result.title,
    cover: result.cover,
    uploader: result.uploader,
    stats: result.stats,
    type: result.type,
    downloads: {
      noWatermark: proxyUrl(result.video.noWatermark, `${safeTitle}.mp4`),
      hd: proxyUrl(result.video.hd, `${safeTitle}-hd.mp4`),
      watermark: proxyUrl(result.video.watermark, `${safeTitle}-wm.mp4`),
      audio: proxyUrl(result.audio, `${safeTitle}-audio.mp3`),
      images: result.images.map((imgUrl, idx) => ({
        url: imgUrl,
        downloadUrl: proxyUrl(imgUrl, `${safeTitle}-slide-${idx + 1}.jpg`)
      }))
    },
    directUrls: {
      noWatermark: result.video.noWatermark,
      hd: result.video.hd,
      watermark: result.video.watermark,
      audio: result.audio,
      images: result.images
    }
  };
}

module.exports = {
  isTikTokUrl,
  safeFilename,
  resolveMedia,
  buildPayload
};
