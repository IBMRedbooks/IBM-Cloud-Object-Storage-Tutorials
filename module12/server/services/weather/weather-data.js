const IBMCloudEnv = require("ibm-cloud-env");
const request = require("request");
const log4js = require("log4js");

const logger = log4js.getLogger("weather-service");

// Public methods
module.exports.getWeatherSituation = _getWeatherSituation;

// Private methods
function _getWeatherSituation(lat, lon) {
	return new Promise(function(resolve, reject) {

		const config = {
			username: IBMCloudEnv.getString("weather_company_data_username"),
			password: IBMCloudEnv.getString("weather_company_data_password"),
			url: IBMCloudEnv.getString("weather_company_data_url"),
			hours: "23"
		};

		let url = `${config.url}:443/api/weather/v1/geocode/${lat}/${lon}/observations/timeseries.json?units=e&hours=${config.hours}`;

		request(url, function(err, response, body) {
			if (err) {
				logger.info("error:", err);
				reject(err);
			} else {
				logger.info("statusCode:", response && response.statusCode);
				resolve(JSON.parse(body));
			}
		});
	});
}
