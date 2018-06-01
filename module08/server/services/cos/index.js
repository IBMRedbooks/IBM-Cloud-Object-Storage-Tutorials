"use strict";

// Modules
const COS = require("ibm-cos-sdk"); // the COS SDK
const IBMCloudEnv = require("ibm-cloud-env"); // access cloud environment vars
const log4js = require("log4js");

// Bucket names - taken from environment variables set in Helm chart
const _originalBucket = IBMCloudEnv.getString("cos_original_bucket");
const _normalizedBucket = IBMCloudEnv.getString("cos_normalized_bucket");

// global logger object
const logger = log4js.getLogger("cos-service");


// Config - Service credentials for the COS instance
const config = {
	endpoint: IBMCloudEnv.getString("cos_endpoint"),
	apiKeyId: IBMCloudEnv.getString("cos_api_key"),
	ibmAuthEndpoint: IBMCloudEnv.getString("cos_ibm_auth_endpoint"),
	serviceInstanceId: IBMCloudEnv.getString("cos_service_instance_id"),
};
const cos = new COS.S3(config);

// Public methods
module.exports.doCreateObject = _doCreateObject;
module.exports.doReadObject = _doReadObject;
module.exports.generatePresignedGet = _generatePresignedGet;
module.exports.originalBucket = _originalBucket;
module.exports.normalizedBucket = _normalizedBucket;

// Private methods

function _doCreateObject(bucketName, mimeType, key, data) {
	let params = {
		Bucket: bucketName,
		// ContentEncoding: 'base64', - optional
		ContentType: mimeType,
		Key: key,
		Body: data
	};
	return new Promise(function(resolve, reject) {
		cos.putObject(params, function(err, data) {
			if(err) {
				reject(err);
			}
			else {
				logger.info(data);
				resolve(data);
			}
		});
	});
}

function _doReadObject(key) {
	logger.info("Getting object with key", key);
	return new Promise(function(resolve, reject) {
		cos.getObject({
			Bucket: _normalizedBucket,
			Key: key
		}, function(err, data) {
			if(err) reject(err);
			resolve(data);
		});
	});
}

// Given a key, generate a pre-signed URL that can be used to GET an image.
// More info on pre-signed URLs here:
function _generatePresignedGet(key) {
	logger.info("Generating presigned GET URL for key", key);
	return new Promise(function(resolve, reject){
		var url = cos.getSignedUrl("getObject", {
			Bucket: _normalizedBucket,
			Key: key
		});
		if (url!= null) {
			resolve(url);
		} else {
			reject("Failed to generate pre-signed URL");
		}
	});
}
