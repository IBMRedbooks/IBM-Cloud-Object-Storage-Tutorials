const util = require("util");
const fs = require("fs");
const uuid = require("uuid/v1");
const cos = require("../../services/cos/index");
const vrService = require("../../services/visual-recognition/vr");
const imageProcessor = require("../../services/image-processing/processor");
const weather = require("../../services/weather/weather-data");
const __ = require("lodash");
const multer = require("multer");

const log4js = require("log4js");

const logger = log4js.getLogger("claim-post-image");

function _setupRoute(router) {
	return router.post("/:claimId/image", upload.any(), _processImage);
}

module.exports.init = _setupRoute;
/*
 * Filters which files multer should accept to be uploaded
 * Only accept .jpg or .png files
 */
function multerFileFilter(req, fileDetails, cb) {
	let file = fileDetails.originalname;
	let fileName = file
		.substring(file.lastIndexOf("/") + 1, file.lastIndexOf("."));
	let extension = file
		.substring(file.lastIndexOf("."), file.length).toLowerCase();
	logger.info(fileName, extension);
	if (extension == ".jpg" || extension == ".png" || extension == ".jpeg") {
		// accept the file
		cb(null, true);
	} else {
		// reject the file, not a jpg or png
		cb(null, false);
	}
}

// configure multer - multipart upload for form-data
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		// create the dir to store the images on disk
		var dir = "/tmp/image-uploads";
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir);
		}
		cb(null, dir);
	},
	filename: function (req, file, cb) {
		cb(null, uuid() + "-" + file.originalname);
	}
});
const upload = multer({
	storage: storage,
	fileFilter: multerFileFilter
});

// Gets the weather observation in weatherSituation that is closest to the
// dateTime provided
function getClosestWeatherObservation(dateTime, weatherSituation) {
	const imageTime = dateTime / 1000;
	// sort observations by their distance to image time
	const closestObservation = __.sortBy(weatherSituation.observations, (observation) => Math.abs(imageTime - observation.valid_time_gmt));

	// Weather api only returns data from last 24h.
	// A correct implementation would not add data if the image is outside of that window
	// for the sake of this demo, we're still adding the weather closest to the time
	// the picture has been taken
	logger.info("Weather:" + closestObservation[0]);
	return closestObservation[0];
}

/*
 * 1. Receive image
 * 2. Extract metadata
 * 3. Resize image
 * 4. Send image to VR service
 * 5. Store images in COS
 * 6. Reassemble JSON from various API calls and store in Cloudant
 */
function _processImage(req,res) {

	// create a unique identifier to use as the key of the images object
	// so we can use it as a reference
	const imageId = uuid();
	let image = {};
	let imageContainer = {};
	imageContainer[imageId] = image;

	const append = {
		claimId: req.params.claimId,
		userId: req.userAccount.userId,
		images: [imageContainer]
	};

	image.vrClassification = {};

	// create a timestamp to use when uploading the images
	let dateTime = Date.now();

	let file = req.files[0];

	// read the uploaded image file from the tmp directory
	new Promise((resolve, reject) => {
		fs.readFile(file.path, (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		})
	})
	.then(data => {
		// create a unique key for object storage
		let origKey = `original/${req.params.claimId}/${dateTime}/${file.filename}`;
		// store key of original image in claimImageRecord for later retrieval
		image.original = origKey;

		// store the original user-uploaded image in a COS bucket
		return cos.doCreateObject(cos.originalBucket, file.mimetype, origKey, data);
	})
	.then(() => {
		logger.info("Uploaded original image to COS");

		// get the exif metadata from the uploaded image
		return imageProcessor.getMetadata(file.path);
	})
	.then(metadata => {
			// some images don't contain exif metadata, so let's check
			if (metadata.exif) {
				logger.info("Extracted image metadata");
				image.imageMetadata = metadata.exif;

				// get the lat,lon from the image metadata
				const latLon = imageProcessor.getLatLon(image.imageMetadata);
				if (!latLon) {
					return;
				}
				logger.info("exif lat,lon", latLon);

				logger.info(`getting weather situation for lat:${latLon[0]} lon:${latLon[1]} @ time: ${image.imageMetadata.dateTimeOriginal}`);
				return weather.getWeatherSituation(latLon[0], latLon[1]);
			}
			// we don't have any metadata to use for weather so just return;
			logger.warn("No image metadata, skipping Weather API");
			return;
		})
		.then((weatherSituation) => {

			if (weatherSituation) {
				image.weatherData = getClosestWeatherObservation(
					image.imageMetadata.dateTimeOriginal, weatherSituation);
			}

			// resize the image to get an normalized thumbnail
			return imageProcessor.resize(file.path);
		})
		.then(resizedImg => {
			return vrService.validateCar(resizedImg)
				.then(isCarProbability => {
					if (isCarProbability.length === 0) {
						throw new Error("Sorry, This is not a car! Nice try though ;)");
					} else if (isCarProbability[0].score < 0.5) {
						throw new Error("Sorry, we don't think this is a car. Nice try though ;)");
					}

					return vrService.getCarDamage(resizedImg);
				})
				.then(carDamage => {
					logger.info("CAR DAMAGE", carDamage[0].class, carDamage[0].score);
					image.vrClassification.carDamage = carDamage;

					return vrService.getCarColor(resizedImg);
				})
				.then(carColor => {
					logger.info("CAR COLOR", carColor[0].class, carColor[0].score);
					image.vrClassification.carColor = carColor;

					// get the position of the car in the image using the VR service
					return vrService.getCarPosition(resizedImg);
				})
				.then(carPosition => {
					logger.info("GOT CAR POSITION");

					// add the VR classification to the claim image record
					image.vrClassification.carPosition = carPosition;

					// assign the top guess of classification for the claim
					append[carPosition[0].classes[0].class] = imageId;

					// store the normalized image in a COS bucket
					let normKey = `normalized/${req.params.claimId}/${dateTime}/${file.filename}`;
					// store key of normalized image in claimImageRecord for later retrieval
					image.normalized = normKey;

					return cos.doCreateObject(cos.normalizedBucket, file.mimetype, normKey, resizedImg);
				})
				.then(function() {
					// append all the data in claimImageRecord to Cloudant
					return req.cloudant.appendClaim(append);
				}).then(() => {
					res.status(200).end();
				});
		})
		.then(() => {
			fs.unlinkSync(file.path);
		})
		.catch((err) => {
			logger.debug("in the CATCH block", err);
			logger.debug(util.inspect(err));
			fs.unlinkSync(file.path);
			res.status(500).send(err.message);
		});
}
