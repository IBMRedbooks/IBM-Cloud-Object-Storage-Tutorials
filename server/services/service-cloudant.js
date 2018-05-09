const IBMCloudEnv = require("ibm-cloud-env");
const client = require("./cloudant");
const log4js = require("log4js");

const logger = log4js.getLogger("cloudant-service");

module.exports = function(app, serviceManager){
	client.init(IBMCloudEnv.getString("cloudant_url")).then(() => {
		serviceManager.set("cloudant", client);
	}).catch((err) => {
		logger.warn("Cloudant service could not be initialized: "+ err);
	});
};
