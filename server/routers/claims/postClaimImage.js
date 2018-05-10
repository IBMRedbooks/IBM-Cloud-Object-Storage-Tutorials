const util = require("util");
const fs = require("fs");
const uuid = require("uuid/v1");
const cos = require("../../services/cos/index");
const imageProcessor = require("../../services/image-processing/processor");
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
		images: [imageContainer]
	};

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

			// resize the image to get an normalized thumbnail
			return imageProcessor.resize(file.path);
		})
		.then(resizedImg => {
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
