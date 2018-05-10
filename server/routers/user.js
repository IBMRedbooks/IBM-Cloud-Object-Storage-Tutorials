const express = require("express");
const passport = require("passport");
const serviceManager = require("../services/service-manager");
const common = require("./common");


module.exports = function(app) {
	var router = express.Router();

	// Get account information for the currently logged in user, creating
	// an account if it doesn't already exist.
	// Note: the injector does all the work here.
	router.get("/", function (req, res) {
		res.json(req.userRecord);
	});


	// Register the route /claim
	app.use("/user",
		passport.authenticate(serviceManager.get("appid-web-strategy-name")),
		common.cloudantInjector,
		common.userInjector,
		router);
};
