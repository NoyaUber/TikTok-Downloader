const path = require("path");
const express = require("express");

const { handleDownload, handleProxy, handleHealth } = require("./lib/handlers");

const app = express();
const publicPath = path.join(__dirname);

app.use(express.json({ limit: "1mb" }));

app.all("/api/download", (req, res) => handleDownload(req, res));
app.all("/api/proxy", (req, res) => handleProxy(req, res));
app.all("/api/health", (req, res) => handleHealth(req, res));

app.use(express.static(publicPath, { extensions: ["html"] }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("========================================");
  console.log(`TikDown v2.0 berjalan di: http://localhost:${PORT}`);
  console.log("========================================");
});
