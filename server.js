const path = require("path");
const express = require("express");
const { handleDownload, handleProxy, handleHealth } = require("./lib/handlers");

const app = express();
const publicPath = path.join(__dirname);

app.use(express.json({ limit: "1mb" }));

app.all("/api/download", handleDownload);
app.all("/api/proxy", handleProxy);
app.all("/api/health", handleHealth);

app.use(express.static(publicPath, { extensions: ["html"] }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server aktif di http://localhost:${PORT}`));
}

module.exports = app;
