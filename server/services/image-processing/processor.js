"use strict";

const im = require("imagemagick");
const which = require("which");
const dms2dec = require("dms2dec");
const log4js = require("log4js");

// global logger object
const logger = log4js.getLogger("image-service");

// Public methods

// guard function to ensure imageMagick is there before we call the im package
const _checkImageMagick = (func, ...args) => {
	// check if preconditions are met (imagemagick is installed)
	if (!which.sync("convert", {nothrow: true})) {
		throw new Error("ImageMagick does not appear to be installed, please install it!");
	}
	return func(...args);
};

module.exports.resize = (...args) => _checkImageMagick(_resize,...args);

// Private methods

function _resize(imageData) {
	return isImagePortrait(imageData).then(isPortrait => {
		// define our width and heigh to resize to
		let width = 1024;
		let height = 768;
		// if the image is portrait, swap values of width and height so we can
		// maintain the ratio
		if(isPortrait) {
			logger.info("Resize: swapping width & height values to maintain ratio");
			width = 768;
			height = 1024;
		}
		return new Promise(function(resolve, reject) {
			im.resize({
				srcPath: imageData,
				width: width,
				height: height
			}, function(err, stdout) {
				if (err) {
					reject(err);
				} else {
					logger.info("resized image to fit within 768px");
					// Convert the string data from the resize function to a binary buffer
					var buff = Buffer.from(stdout, "binary");
					resolve(buff);
				}
			});
		});
	});
}

function getImageDimensions(imageData) {
	return new Promise(function(resolve) {
		im.identify(["-format", "%wx%h", imageData], function(err, output){
			if (err) resolve(err);
			let dimensions = output.split("x");
			resolve(dimensions);
		});
	});
}

function isImagePortrait(imageData) {
	return getImageDimensions(imageData).then(dimensions => {
		let ratio = dimensions[0] / dimensions[1];
		if(ratio < 1) return true;
		return false;
	});
}
