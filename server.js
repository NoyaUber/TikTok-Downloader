const app = require("./api/index");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("========================================");
  console.log(`🚀 TikDown v2.0 berjalan di: http://localhost:${PORT}`);
  console.log("========================================");
});
