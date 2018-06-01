const serviceManager = require("../services/service-manager");
const log4js = require("log4js");
const logger = log4js.getLogger("common-controller");


module.exports.cloudantInjector = function (req, res, next) {
	req.cloudant = serviceManager.get("cloudant");
	if (!req.cloudant) {
		res.status(500).send("Cloudant not configured, cannot search!");
	}
	next();
};
