const cos = require("../../services/cos/index");

module.exports.init = _setupRoute;

function _setupRoute(router) {
	return router.get("/:claimId/image", _getImage);
}

function _getImage(req, res) {
	// get the key of the image from the query parameters
	let key = req.query.key;
	// check to make sure we have a key
	if(key) {
		// read the object from COS
		cos.doReadObject(key).then(image => {
			// set some headers for type, length and disposition
			res.writeHead(200, {
				"Content-Type": image.ContentType,
				"Content-disposition": "attachment;filename=" + key,
				"Content-Length": image.ContentLength
			});
			// return the image to the user
			res.end(image.Body);
		});
	} else {
		// send an error, we don't have a key
		res.status(500).send("Please include query parameter 'key' " +
      "to specify the image key");
	}
}
