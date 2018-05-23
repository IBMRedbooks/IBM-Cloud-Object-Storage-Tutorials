var express = require("express");
const serviceManager = require("../services/service-manager");

module.exports = function(app) {
	var router = express.Router();

	router.get("/", function (req, res) {
		res.json({status: "UP"});
	});

	app.use("/health", router);
};
