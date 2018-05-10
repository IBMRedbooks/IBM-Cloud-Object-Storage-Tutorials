const express = require("express");
const passport = require("passport");
const serviceManager = require("../services/service-manager");
const common = require("./common");



// Note: We create a new user for every new identity we encounter from an identity provider.
// We will tie policies and claims to a user. In practice, an application should be careful
// to separate user identity from account. What if a user wants to change identity providers,
// link new ones in, or link separate accounts together? Your data model should always
// keep a distinction.
//
// If we were using a transactional database, we might be tempted to use accountId as the
// primary key in for claims and policies. However, that is dangerous to do in non-transactional
// databases like Cloudant, and may be ill-advised in any case. By linking claims and policies
// to users directly, the data model supports linking and re-linking users to accounts at will.
// A further note on transactional vs. non-transactional databases: We would make providers
// be a unique compound primary key on transactional databases, and be guaranteed that only a
// single user would exist per identity. However, non-transactional databases have race conditions
// that cannot guarantee this. So in our example application we assume there could be multiple
// users for a given identity, and we will perform searches that find any claims or any policies
// for that identity.
//
// Note that in this example application when we want to find claims and policies for a logged
// in user, we search only on the userId set we find based on the authenticated identity. In the
// real application, we would want to do this instead:
//
// 1. For an identity, find the set of userIds. There may be multiple because of race conditions.
// 2. Search for all accounts for that set of userIds
// 3. Find the set of userIds for for that set of accounts (which may be a superset if there are linked accounts.
// 4. Find the set of claims or policies (depending on the query) for the final set of userIds.


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
