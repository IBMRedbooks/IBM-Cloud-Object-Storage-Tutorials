const serviceManager = require("../services/service-manager");
const log4js = require("log4js");
const logger = log4js.getLogger("common-controller");

function _extractAuthIdentity(req) {
	var appIdAuthContext = req.session[serviceManager.get("appid-web-auth-context")];

	if (appIdAuthContext) {
		if (appIdAuthContext.identityTokenPayload.identities.length > 0) {
			return appIdAuthContext.identityTokenPayload.identities[0];
		}
	}

	// If we have not logged in
	return null;
}

module.exports.cloudantInjector = function (req, res, next) {
	req.cloudant = serviceManager.get("cloudant");
	if (!req.cloudant) {
		res.status(500).send("Cloudant not configured, cannot search!");
	}
	next();
};

module.exports.userInjector = function (req, res, next) {

	const identity = _extractAuthIdentity(req);
	if (!req.user) {
		// no user on request, proceed
		next();
		return;
	}
	req.cloudant.findOrCreateUser(req.user.name, identity.provider, identity.id)
		.then((userDetails) => {
			req.userAccount = userDetails;
			next();
			return;
		}).catch((err) => {
			logger.info(err);
			res.status(500).send(err);
		});


};
