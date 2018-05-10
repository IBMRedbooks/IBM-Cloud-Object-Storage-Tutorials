const express = require("express");

module.exports = function(app) {
	const router = express.Router();


	//POST a dummy claim back to the client

	router.post("/", function(req, res) {
		res.setHeader("Location", "/claim/ComingInModule5");
		res.status(201).end();
	});

	// GET a list of claims
	router.get("/", function (req, res) {
		const claims = {"claims": "ComingInModule5"};
		res.json(JSON.stringify(claims));
	});


	app.use("/claim",
		router);

};
