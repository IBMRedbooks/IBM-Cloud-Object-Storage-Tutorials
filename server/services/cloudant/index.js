"use strict";

// Modules
const Cloudant = require("@cloudant/cloudant");
const log4js = require("log4js");
const uuid = require("uuid/v4");
const moment = require("moment");
const __ = require("lodash");
const cos = require("../cos");

// Globals
let db;
const DB_NAME = "car_claims";
const CLAIM_INDEX = require("./claimIndex.json");
const POLICY_INDEX = require("./policyIndex.json");
const USER_INDEX = require("./userIndex.json");
const logger = log4js.getLogger("cloudant-client");

// Public Methods ------------------------------------------------------------->

module.exports.init = _init;
module.exports.createClaim = _createClaim;
module.exports.appendClaim = _appendClaim;
module.exports.getClaim = _getClaim;
module.exports.listAllClaims = _listAllClaims;
module.exports.listUserClaims = _listUserClaims;
module.exports.archiveClaim = _archiveClaim;
module.exports.createUser = _createUser;
module.exports.getUser = _getUser;
module.exports.listUsers = _listUsers;
module.exports.findUserByIdentity = _findUserByIdentity;
module.exports.findOrCreateUser = _findOrCreateUser;
module.exports.createPolicy = _createPolicy;
module.exports.getPolicy = _getPolicy;
module.exports.listAllPolicies = _listAllPolicies;
module.exports.listUserPolicies = _listUserPolicies;


// Private Methods ------------------------------------------------------------>

/**
 * @function _init
 * Sets up cloudant connection, index and alike
 * @param {String} cloudant_url url containing the cloudant configuration
 * @returns {Promise} resolves to true if connection could be made, db is existant and indexes are created
 *
 */
function _init(cloudant_url) {
	if (!cloudant_url) {
		return Promise.reject("Cloudant configuration missing");
	}
	const cloudant = new Cloudant({ url: cloudant_url, plugins: [ "promises"] });

	// list all databases and create ours if it's not present
	return cloudant.db.list().then((db) => {
		const found = db && db.indexOf(DB_NAME) !== -1;
		if (!found) {
			logger.debug(`Database ${DB_NAME} does not exist, creating it`);
			return cloudant.db.create(DB_NAME);
		}
	}).then(() => {
		logger.debug(`Using database ${DB_NAME}`);
		db = cloudant.db.use(DB_NAME);
	}).then(() => db.index(CLAIM_INDEX)) // create the claim index
		.catch(e => {
			logger.warn(e._data);
		}).then(() => db.index(POLICY_INDEX)) // create the policy index
		.catch(e => {
			logger.warn(e._data);
		}).then(() => db.index(USER_INDEX)) // create the user index
		.catch(e => {
			logger.warn(e._data);
		});
}

/**
 * @function _createClaim
 * create a new claim
 * @param {String} claimDetails object holding initial data for the claim
 * @returns {Promise} resolves to claimId when creation was successfull
 */
function _createClaim(claimDetails) {
	// create the document from provided details, generated UUID and created date
	const document = Object.assign({},claimDetails, {type: "claim", claimId: uuid(), created: moment.utc()  });
	// just in case someone tried to set the id
	delete document._id;
	// insert the document and return the claimId
	return db.insert(document).then((d) => {
		logger.debug(d);
		return document.claimId;
	});
}

function _createUser(userDetails) {
	// create the document from provided details, generated UUID and created date
	const document = Object.assign({},userDetails, {type: "user", userId: uuid(), created: moment.utc()});
	// just in case someone tried to set the id
	delete document._id;
	// insert the document and return the claimId
	return db.insert(document).then((d) => {
		logger.debug(d);
		return document.userId;
	});
}

function _createPolicy(policyDetails) {
	// create the document from provided details, generated UUID and created date
	const document = Object.assign({},policyDetails, {type: "policy", policyId: uuid(), created: moment.utc()});
	// just in case someone tried to set the id
	delete document._id;
	// insert the document and return the claimId
	return db.insert(document).then((d) => {
		logger.debug(d);
		return document.policyId;
	});
}

/**
 * @function _appendClaim
 * Add additional data to a claim
 * @param {String} claimAppend object holding additional data for the claim
 * @returns {Promise} resolves when update was successfull
 */
function _appendClaim(claimAppend) {
	// enforce presence of claimId, as this is the field that we use to aggregate
	if (!claimAppend.claimId) {
		return Promise.reject("Missing claimId parameter!");
	}

	// make sure the document has a proper created timestamp
	const document = Object.assign({},claimAppend, {created: moment.utc(), type: "claim"});
	delete document._id;
	// insert the document
	return db.insert(document).then((d) => {
		logger.debug(d);
		return;
	});
}


// TODO: May want to remove this method, use getClaimById or getClaimByUser
/**
 * @function _getClaim
 * Get all the details of a specific claim
 * @param {String} claimId id of the claim
 * @returns {Promise} resolves to claimDetails
 */
function _getClaim(claimId) {
	if (!claimId) {
		return Promise.reject("Missing claimId parameter");
	}
	// Leverage the index we created to sort by claimId and created date
	const query = {
		"selector": {
			"type" : "claim",
			"claimId": claimId
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId": "asc"
			},
			{
				"claimId": "asc"
			},
			{
				"created": "asc"
			}
		]
	};

	// Search all documents for this claim
	return db.find(query).then((docs) =>  {
		// if there are none, return null
		if (!docs || docs.docs.length === 0) {
			return null;
		}

		logger.trace(`Will merge ${docs.docs.length} documents for case`);
		// First, remove all internal properties starting with _, then merge all documents
		const cleanedDoc = __.map(docs.docs, (doc) => __.pickBy(doc, (v,k) => !__.startsWith(k,"_")));
		const unionDocument = __.merge({},...cleanedDoc);
		// created dates of states have a semantically different meaning for the overall case
		unionDocument.created = docs.docs[0].created;
		unionDocument.lastUpdate = docs.docs[docs.docs.length - 1].created;
		return unionDocument;
	});
}


// Note that this method assumes policies are immutable. Any element that is
// mutable would have to use a pattern similar to how the claims worked.
function _getPolicy(policyId) {
	if (!policyId) {
		return Promise.reject("Missing policyId parameter");
	}
	// Leverage the index we created to sort by claimId and created date
	const query = {
		"selector": {
			"type" : "policy",
			"policyId": policyId
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId" : "asc"
			},
			{
				"policyId" : "asc"
			}
		]
	};

	// Search all documents for this claim
	return db.find(query).then((docs) =>  {
		// if there are none, return null
		if (!docs || docs.length === 0) {
			return null;
		}

		return docs.docs[0];
	});
}

// Note that this method assumes policies are immutable. Any element that is
// mutable would have to use a pattern similar to how the claims worked.
function _getUser(userId) {
	if (!userId) {
		return Promise.reject("Missing userId parameter");
	}
	// Leverage the index we created to sort by claimId and created date
	const query = {
		"selector": {
			"type" : "user",
			"userId": userId
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId" : "asc"
			},
			{
				"accountId" : "asc"
			},
			{
				"identity.provider" : "asc"
			},
			{
				"identity.id" : "asc"
			}
		]
	};

	// Search all documents for this claim
	return db.find(query).then((docs) =>  {
		// if there are none, return null
		if (!docs || docs.length === 0) {
			return null;
		}

		return docs.docs[0];
	});
}

function _findOrCreateUser(name, provider, id) {
	if (!name || !provider || !id) {
		return Promise.reject("Missing name, provider, or id parameter");
	}

	return _findUserByIdentity(provider, id).then((userDetails) => {
		if (userDetails) {
			logger.log("Found user by identity ", provider, " ", id);
			return userDetails;
		} else {
			logger.log("Did not find user, creating one for ", provider, " ", id);

			const newUserDetails = {
				"type" : "user",
				"accountId" : null,
				"name" : name,
				"identity" : {
					"provider" : provider,
					"id" : id
				}
			};

			return _createUser(newUserDetails).then((userId) => {
				return userId;
			}).then((userId) => {
				return _getUser(userId);
			});
		}
	});
}

// This function should technically the set of users by an identity, and other search methods should take multiples.
function _findUserByIdentity(provider, id) {
	if (!provider || !id) {
		return Promise.reject("Missing provider or id parameter");
	}
	// Leverage the index we created to sort by claimId and created date
	const query = {
		"selector": {
			"type" : "user",
			"identity.provider": provider,
			"identity.id" : id
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId" : "asc"
			},
			{
				"accountId" : "asc"
			},
			{
				"identity.provider" : "asc"
			},
			{
				"identity.id" : "asc"
			}
		]
	};

	// Search all documents for this claim
	return db.find(query).then((docs) =>  {
		// if there are none, return null
		if (!docs || docs.length === 0) {
			return null;
		}

		return docs.docs[0];
	});
}



/**
 * @function _listAllClaims
 * Returns a list of all claimIds
 * @returns {Promise} resolves to array of claim objects, holding just the claimId
 */
function _listAllClaims() {
	// leverage the index for sorting, but get all documents
	const query = {
		"selector": {
			"type" : "claim"
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId": "asc"
			},
			{
				"claimId": "asc"
			},
			{
				"created": "asc"
			}
		]
	};

	return db.find(query).then((docs) =>  {
		logger.trace(`Found ${docs.docs.length} cases`);
		// First, remove all except caseId, then make things unique
		const cleanedDocs = __.map(docs.docs, (doc) => __.pickBy(doc, (v,k) => !__.startsWith(k,"_")));
		// Second, group by id so that we can merge the changesets
		const groupedDocs = __.groupBy(cleanedDocs, (doc) => doc.claimId);
		// Finally, perform the merge
		const unionDocs = __.map(groupedDocs, (docs) => __.merge({},...docs));
		return unionDocs;
	});
}


// Returns a list of all claimIds for a specific user
function _listUserClaims(userId) {
	const query = {
		"selector": {
			"type" : "claim",
			"userId": userId
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId": "asc"
			},
			{
				"claimId": "asc"
			},
			{
				"created": "asc"
			}
		]
	};

	return db.find(query).then((docs) =>  {
		logger.trace(`Found ${docs.docs.length} cases`);
		// First, remove all except caseId, then make things unique
		const cleanedDocs = __.map(docs.docs, (doc) => __.pickBy(doc, (v,k) => !__.startsWith(k,"_")));
		// Second, group by id so that we can merge the changesets
		const groupedDocs = __.groupBy(cleanedDocs, (doc) => doc.claimId);
		// Finally, perform the merge
		const unionDocs = __.map(groupedDocs, (docs) => __.merge({},...docs));
		return unionDocs;
	});
}


function _listAllPolicies() {
	const query = {
		"selector": {
			"type" : "policy"
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId" : "asc"
			},
			{
				"policyId" : "asc"
			}
		]
	};

	return db.find(query).then((docs) =>  {
		logger.trace(`Found ${docs.docs.length} policies`);
		// First, remove all except caseId, then make things unique
		const cleanedDocs = __.map(docs.docs, (doc) => __.pickBy(doc, (v,k) => !__.startsWith(k,"_")));
		// Second, group by id so that we can merge the changesets
		const groupedDocs = __.groupBy(cleanedDocs, (doc) => doc.policyId);
		// Finally, perform the merge
		const unionDocs = __.map(groupedDocs, (docs) => __.merge({},...docs));
		return unionDocs;
	});
}



function _listUsers() {
	const query = {
		"selector": {
			"type" : "user"
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId" : "asc"
			},
			{
				"accountId" : "asc"
			},
			{
				"identity.provider" : "asc"
			},
			{
				"identity.id" : "asc"
			}
		]
	};

	return db.find(query).then((docs) =>  {
		logger.trace(`Found ${docs.docs.length} users`);
		// First, remove all except caseId, then make things unique
		const cleanedDocs = __.map(docs.docs, (doc) => __.pickBy(doc, (v,k) => !__.startsWith(k,"_")));
		// Second, group by id so that we can merge the changesets
		const groupedDocs = __.groupBy(cleanedDocs, (doc) => doc.policyId);
		// Finally, perform the merge
		const unionDocs = __.map(groupedDocs, (docs) => __.merge({},...docs));
		return unionDocs;
	});
}


function _listUserPolicies(userId) {
	const query = {
		"selector": {
			"userId": userId,
			"type" : "policy"
		},
		"sort": [
			{
				"type" : "asc"
			},
			{
				"userId" : "asc"
			},
			{
				"policyId" : "asc"
			}
		]
	};

	return db.find(query).then((docs) =>  {
		logger.trace(`Found ${docs.docs.length} policies`);
		// First, remove all except caseId, then make things unique
		const cleanedDocs = __.map(docs.docs, (doc) => __.pickBy(doc, (v,k) => !__.startsWith(k,"_")));
		// Second, group by id so that we can merge the changesets
		const groupedDocs = __.groupBy(cleanedDocs, (doc) => doc.policyId);
		// Finally, perform the merge
		const unionDocs = __.map(groupedDocs, (docs) => __.merge({},...docs));
		return unionDocs;
	});
}

/**
 * @function _archiveClaim
 * Takes a claim and stores it as JSON on cos for archival, also updates the claim as archived
 * @param {String} claimId identifier of the claim
 * @returns {Promise} resolves to when archiving was successfull
 */
function _archiveClaim(claimId) {
	// get the claim, store it on COS and update the claim as archived
	return _getClaim(claimId)
		.then((claimDetails) => {
			const data = JSON.stringify(claimDetails);
			logger.trace("Will archive: " + data);
			// prefix object by year, week and claimId, such that hive partitioning may benefit from it
			const now = moment.utc();
			return cos.doCreateObject("claims-archived", `${now.year()}/${now.week()}/${claimId}/data.json`, "application/json", data);
		})
		.then(() => _appendClaim({ claimId: claimId , state: "archived"}));
}
