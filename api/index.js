const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "1mb" }));

// Serve static assets from root directory
const publicPath = path.join(__dirname, "..");
app.use(express.static(publicPath));

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

// Provider 1: TikWM
async function fetchTikWM(tiktokUrl) {
  const formData = new URLSearchParams();
  formData.append("url", tiktokUrl);
  formData.append("hd", "1");

  const response = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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

  const makeUrl = (pathStr) => {
    if (!pathStr) return null;
    return pathStr.startsWith("http") ? pathStr : `https://www.tikwm.com${pathStr}`;
  };

  return {
    id: data.id,
    title: data.title || "TikTok Media",
    cover: makeUrl(data.cover || data.origin_cover),
    uploader: {
      name: data.author?.nickname || "TikTok User",
      username: data.author?.unique_id || "",
      avatar: makeUrl(data.author?.avatar)
    },
    stats: {
      views: data.play_count || 0,
      likes: data.digg_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0
    },
    type: isImages ? "image" : "video",
    video: {
      noWatermark: makeUrl(data.play),
      hd: makeUrl(data.hdplay),
      watermark: makeUrl(data.wmplay)
    },
    audio: makeUrl(data.music),
    images: isImages ? data.images.map((img) => makeUrl(img)) : []
  };
}

// Provider 2: Tiklydown Fallback
async function fetchTiklydown(tiktokUrl) {
  const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(tiktokUrl)}`;
  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
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

// Download API
app.post("/api/download", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!url) {
    return res.status(400).json({ error: "URL TikTok tidak boleh kosong." });
  }

  if (!isTikTokUrl(url)) {
    return res
      .status(400)
      .json({ error: "URL TikTok tidak valid. Pastikan format link video TikTok benar." });
  }

  try {
    let result = null;
    let primaryError = null;

    try {
      result = await fetchTikWM(url);
    } catch (err) {
      primaryError = err;
      console.warn("TikWM failed, switching to fallback:", err.message);
    }

    if (!result) {
      try {
        result = await fetchTiklydown(url);
      } catch (fallbackErr) {
        console.error("Fallback provider failed:", fallbackErr.message);
        throw new Error(
          primaryError?.message || "Gagal mengambil data video TikTok. Pastikan video bersifat publik."
        );
      }
    }

    const safeTitle = safeFilename(result.title, "tiktok-media");

    const responsePayload = {
      title: result.title,
      cover: result.cover,
      uploader: result.uploader,
      stats: result.stats,
      type: result.type,
      downloads: {
        noWatermark: result.video.noWatermark
          ? `/api/proxy?url=${encodeURIComponent(result.video.noWatermark)}&filename=${encodeURIComponent(
              safeTitle + ".mp4"
            )}`
          : null,
        hd: result.video.hd
          ? `/api/proxy?url=${encodeURIComponent(result.video.hd)}&filename=${encodeURIComponent(
              safeTitle + "-hd.mp4"
            )}`
          : null,
        watermark: result.video.watermark
          ? `/api/proxy?url=${encodeURIComponent(result.video.watermark)}&filename=${encodeURIComponent(
              safeTitle + "-wm.mp4"
            )}`
          : null,
        audio: result.audio
          ? `/api/proxy?url=${encodeURIComponent(result.audio)}&filename=${encodeURIComponent(
              safeTitle + "-audio.mp3"
            )}`
          : null,
        images: result.images.map((imgUrl, idx) => ({
          url: imgUrl,
          downloadUrl: `/api/proxy?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(
            safeTitle + `-slide-${idx + 1}.jpg`
          )}`
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

    return res.json(responsePayload);
  } catch (error) {
    console.error("API /api/download error:", error.message);
    return res.status(500).json({
      error: error.message || "Gagal memproses permintaan."
    });
  }
});

// Media Proxy Route
app.get("/api/proxy", async (req, res) => {
  const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
  const customFilename = safeFilename(
    typeof req.query.filename === "string" ? req.query.filename : "",
    "download.mp4"
  );

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return res.status(400).send("URL target tidak valid.");
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://www.tiktok.com/"
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("Gagal mengambil file dari CDN.");
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(customFilename)}"`);
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Proxy error:", err.message);
    return res.status(500).send("Gagal mengunduh file media.");
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "TikDown", version: "2.0.0" });
});

module.exports = app;
