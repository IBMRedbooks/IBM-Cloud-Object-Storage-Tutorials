var VisualRecognitionV3 = require("watson-developer-cloud/visual-recognition/v3");
var _ = require("lodash");

var visualRecognition = new VisualRecognitionV3({
	version: "2018-03-19",
	api_key: "fb080f8e3f8f54177bfbbf7987b424f044241bd8"
});


// Public methods
module.exports.getCarColor = _get_car_color;
module.exports.getCarPosition = _get_car_position;
module.exports.getCarDamage = _get_car_damage;
module.exports.validateCar = _validate_car;

function _validate_car(image) {
	return new Promise(function(resolve, reject) {

		var car_classifier_ids = ["default"];
		var car_threshold = 0;

		var params_carcol = {
			images_file: image,
			classifier_ids: car_classifier_ids,
			threshold: car_threshold
		};

		visualRecognition.classify(params_carcol, function(err, response) {
			if (err) {
				reject(err);
			}
			else {
				var car_validation = _.filter(response.images[0].classifiers[0].classes, function(filter_car) {
					return filter_car.class.includes("car");
				});
				var car_validation_sorted = _.orderBy(car_validation, ["score", "class"], ["desc", "asc"]);
				resolve(car_validation_sorted);
			}
		});
	});
}

function _get_car_color(image) {
	return new Promise(function(resolve, reject) {

		var carcol_classifier_ids = ["default"];
		var carcol_threshold = 0;

		var params_carcol = {
			images_file: image,
			classifier_ids: carcol_classifier_ids,
			threshold: carcol_threshold
		};

		visualRecognition.classify(params_carcol, function(err, response) {
			if (err) {
				reject(err);
			}
			else {
				var car_color = _.filter(response.images[0].classifiers[0].classes, function(filter_color) {
					return filter_color.class.includes("color");
				});
				var car_color_sort = _.orderBy(car_color, ["score", "class"], ["desc", "asc"]);
				resolve(car_color_sort);
			}
		});
	});
}

function _get_car_position(image) {
	return new Promise(function(resolve, reject) {

		var carpos_classifier_ids = ["cosredbook_car_right_small3_39505551", "cosredbook_car_left_small5_1133497139", "cosredbook_car_front_small_740382583", "cosredbook_car_back_1854234732"];
		var carpos_threshold = 0;

		var params_carpos = {
			images_file: image,
			classifier_ids: carpos_classifier_ids,
			threshold: carpos_threshold
		};

		visualRecognition.classify(params_carpos, function(err, response) {
			if (err)
				reject(err);
			else
				var car_position = _.orderBy(response.images[0].classifiers, ["classes[0].score", "classes[0].class"], ["desc", "asc"]);
			resolve(car_position);
		});
	});
}

function _get_car_damage(image) {
	return new Promise(function(resolve, reject) {

		var cardam_classifier_ids = ["cosredbook_car_damage_1744820941"];
		var cardam_threshold = 0;

		var params_cardam = {
			images_file: image,
			classifier_ids: cardam_classifier_ids,
			threshold: cardam_threshold
		};

		visualRecognition.classify(params_cardam, function(err, response) {
			if (err) {
				reject(err);
			}
			else {
				var car_damage = _.orderBy(response.images[0].classifiers[0].classes, ["score", "class"], ["desc", "asc"]);
				resolve(car_damage);
			}
		});
	});
}
