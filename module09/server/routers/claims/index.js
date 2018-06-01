const express = require("express");
const passport = require("passport");
const serviceManager = require("../../services/service-manager");

const log4js = require("log4js");
const common = require("../common");
const postClaimImage = require("./postClaimImage").init;
const getClaimImage = require("./getClaimImage").init;

const bodyParser = require("body-parser");
const logger = log4js.getLogger("claim-controller");


module.exports = function(app) {
	const router = express.Router();

	postClaimImage(router);
	getClaimImage(router);
	// Ensures claim exist and attaches it to the request
	const claimInjector = function (req, res, next) {
		// get the claimId from the request parameters
		const claimId = req.params.claimId;

		req.cloudant.getClaim(claimId).then((claimDetails) => {
			if (claimDetails) {
				req.claim = claimDetails;
				next();
			} else {
				res.status(404).send("Claim does not exist");
			}
		}).catch((err) => {
			logger.error(err);
			res.status(500).send("Something broke!");
		});
	};

	// GET the details of a claim by :claimId
	router.get("/:claimId", claimInjector, function (req, res) {
		res.json(req.claim);
	});

	router.post("/", function(req, res) {
		req.cloudant.createClaim(req.body).then((claimId) => {
			// Tell caller the location of the created resource
			res.setHeader("Location", `/claim/${claimId}`);
			res.status(201).end();
		}).catch((err) => {
			logger.error(err);
			res.status(500).send("Something broke!");
		});
	});

	router.patch("/:claimId", claimInjector, function(req, res) {
		const append = Object.assign({},req.body,{claimId: req.params.claimId});

		req.cloudant.appendClaim(append).then(() => {
			res.status(200).end();
		}).catch((err) => {
			logger.error(err);
			res.status(500).send("Something broke!");
		});
	});

	router.post("/:claimId/archive", claimInjector, function(req, res) {
		if (req.claim.state === "archived") {
			res.status(400).send("Claim is already archived");
		}
		req.cloudant.archiveClaim(req.params.claimId).then(() => {
			res.status(200).end();
		}).catch((err) => {
			logger.error("Failed to archive claim:",err);
			res.status(500).send("Something broke!");
		});
	});




	// GET a list of claims
	router.get("/", function (req, res) {
		req.cloudant.listAllClaims().then((claims) => {
			res.json(claims);
		}).catch((err) => {
			logger.error(err);
			res.status(500).send("Something broke!");
		});
	});

	// Register the route /claim
	app.use("/claim",
		bodyParser.json(),
		common.cloudantInjector,
		router);
};
