var express = require("express");
const serviceManager = require("../services/service-manager");

module.exports = function(app) {
	var router = express.Router();

	router.get("/", function (req, res) {
		if(serviceManager.get("cloudant")) {
			res.json({ status: "UP" });
		} else {
			res.json({ status: "DOWN" });
		}
	});

	app.use("/health", router);
};
