const { Readable } = require("stream");
const { isTikTokUrl, safeFilename, resolveMedia, buildPayload } = require("./tiktok");

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

const ALLOWED_PROXY_HOSTS = [
  "tiktok.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "ibytedtos.com",
  "muscdn.com",
  "tikwm.com",
  "tiklydown.eu.org"
];

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: `Metode ${req.method || "UNKNOWN"} tidak diizinkan.` });
  return false;
}

function getQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    const parsed = new URL(req.url || "/", "http://localhost");
    return Object.fromEntries(parsed.searchParams);
  } catch {
    return {};
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const pre = req.body;
    if (pre !== undefined && pre !== null) {
      if (Buffer.isBuffer(pre)) {
        try {
          resolve(JSON.parse(pre.toString("utf8")));
        } catch {
          resolve({});
        }
        return;
      }
      if (typeof pre === "string") {
        try {
          resolve(JSON.parse(pre));
        } catch {
          resolve({});
        }
        return;
      }
      resolve(pre);
      return;
    }

    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new Error("Request body terlalu besar."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body bukan JSON yang valid."));
      }
    });
    req.on("error", reject);
  });
}

function isAllowedProxyHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_PROXY_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

function validateProxyUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "URL target tidak valid." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Hanya URL HTTPS yang diizinkan." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "URL dengan kredensial tidak diizinkan." };
  }

  if (!isAllowedProxyHost(parsed.hostname)) {
    return { ok: false, error: "Host target tidak diizinkan." };
  }

  return { ok: true, url: parsed };
}

async function fetchProxyTarget(initialUrl, options = {}) {
  let current = initialUrl;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const upstream = await fetch(current.toString(), {
      headers: {
        "User-Agent": DESKTOP_UA,
        Referer: "https://www.tiktok.com/"
      },
      redirect: "manual"
    });

    if (![301, 302, 303, 307, 308].includes(upstream.status)) {
      return upstream;
    }

    const location = upstream.headers.get("location");
    if (!location) return upstream;

    if (redirects === maxRedirects) {
      throw new Error("Terlalu banyak redirect dari server media.");
    }

    const next = new URL(location, current);
    const validation = validateProxyUrl(next.toString());
    if (!validation.ok) {
      throw new Error("Redirect media menuju host yang tidak diizinkan.");
    }
    current = validation.url;
  }

  throw new Error("Gagal mengikuti URL media.");
}

async function handleDownload(req, res) {
  if (!allowMethods(req, res, ["POST", "OPTIONS"])) return;

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
    return;
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url) {
    sendJson(res, 400, { error: "URL TikTok tidak boleh kosong." });
    return;
  }

  if (!isTikTokUrl(url)) {
    sendJson(res, 400, {
      error: "URL TikTok tidak valid. Pastikan format link video TikTok benar."
    });
    return;
  }

  try {
    const result = await resolveMedia(url);
    sendJson(res, 200, buildPayload(result));
  } catch (error) {
    console.error("API /api/download error:", error.message);
    sendJson(res, 500, { error: error.message || "Gagal memproses permintaan." });
  }
}

async function handleProxy(req, res) {
  if (!allowMethods(req, res, ["GET", "HEAD", "OPTIONS"])) return;

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const query = getQuery(req);
  const targetUrl = typeof query.url === "string" ? query.url : "";
  const filename = safeFilename(
    typeof query.filename === "string" ? query.filename : "",
    "download.mp4"
  );

  const validation = validateProxyUrl(targetUrl);
  if (!validation.ok) {
    res.statusCode = validation.error === "Host target tidak diizinkan." ? 403 : 400;
    res.end(validation.error);
    return;
  }

  try {
    const upstream = await fetchProxyTarget(validation.url);

    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.end("Gagal mengambil file dari CDN.");
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.end();
      return;
    }

    if (upstream.body) {
      const stream = Readable.fromWeb(upstream.body);
      stream.on("error", () => {
        if (!res.destroyed) res.destroy();
      });
      stream.pipe(res);
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.end(buffer);
  } catch (err) {
    console.error("Proxy error:", err.message);
    if (!res.headersSent) res.statusCode = 502;
    res.end("Gagal mengunduh file media.");
  }
}

function handleHealth(req, res) {
  if (!allowMethods(req, res, ["GET", "HEAD", "OPTIONS"])) return;
  sendJson(res, 200, { ok: true, service: "TikDown", version: "2.0.0" });
}

module.exports = { handleDownload, handleProxy, handleHealth };
