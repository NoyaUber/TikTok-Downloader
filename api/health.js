const { handleHealth } = require("../lib/handlers");

module.exports = (req, res) => handleHealth(req, res);
