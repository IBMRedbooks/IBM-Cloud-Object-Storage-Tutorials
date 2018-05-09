const express = require("express");
const passport = require("passport");
const serviceManager = require("../services/service-manager");

const faker = require("faker");
const log4js = require("log4js");
const common = require("./common");

const logger = log4js.getLogger("policy-controller");

module.exports = function(app) {
	var router = express.Router();

	// GET a list of all policies for the given user.
	router.get("/", function (req, res) {
		if (req.param("all")) {
			req.cloudant.listAllPolicies().then((policies) => {
				res.json(policies);
			}).catch((err) => {
				logger.info(err);
				res.status(500).send(err);
			});
		} else {
			req.cloudant.listUserPolicies(req.userAccount.userId).then((policies) => {
				res.json(policies);
			}).catch((err) => {
				logger.info(err);
				res.status(500).send(err);
			});
		}
	});



	// Create a dummy policy for the current authenticated user
	// TODO: Chage to POST
	router.get("/create", function(req, res) {

		var policyDetails = {
			userId : req.userAccount.userId,
			car: {
				color: faker.commerce.color(),
				make: faker.company.companyName()
			}
		};

		req.cloudant.createPolicy(policyDetails).then((policyId) => {
			logger.info("Created policy ", policyId);
			return req.cloudant.getPolicy(policyId);
		}).then((policyDetails) => {
			res.json(policyDetails);
		}).catch((err) => {
			logger.info(err);
			res.status(500).send(err);
		});
	});




	// Register the route /claim
	app.use("/policy",
		passport.authenticate(serviceManager.get("appid-web-strategy-name")),
		common.cloudantInjector,
		common.userInjector,
		router);
};
