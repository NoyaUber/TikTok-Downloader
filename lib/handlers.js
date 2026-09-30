const { Readable } = require("stream");
const { isTikTokUrl, safeFilename, resolveMedia, buildPayload } = require("./tiktok");

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_BODY_BYTES = 1024 * 1024;

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

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body terlalu besar."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
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

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedHosts = ["localhost", "metadata.google.internal", "169.254.169.254"];
  if (blockedHosts.includes(host)) return true;
  return /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
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

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.statusCode = 400;
    res.end("URL target tidak valid.");
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.statusCode = 400;
    res.end("Protokol URL target tidak diizinkan.");
    return;
  }

  if (isBlockedHost(parsed.hostname)) {
    res.statusCode = 403;
    res.end("Host target tidak diizinkan.");
    return;
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": DESKTOP_UA, Referer: "https://www.tiktok.com/" },
      redirect: "follow"
    });

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
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.end();
      return;
    }

    if (upstream.body) {
      const stream = Readable.fromWeb(upstream.body);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.end(buffer);
  } catch (err) {
    console.error("Proxy error:", err.message);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Gagal mengunduh file media.");
  }
}

function handleHealth(req, res) {
  if (!allowMethods(req, res, ["GET", "HEAD", "OPTIONS"])) return;
  sendJson(res, 200, { ok: true, service: "TikDown", version: "2.0.0" });
}

module.exports = { handleDownload, handleProxy, handleHealth };
