const IBMCloudEnv = require("ibm-cloud-env");
const fs = require("fs");
const passport = require("passport");
const session = require("express-session");
const path = require("path");
const AppIdAPIStrategy = require("bluemix-appid").APIStrategy;
const WebAppStrategy = require("bluemix-appid").WebAppStrategy;
const userAttributeManager = require("bluemix-appid").UserAttributeManager;
const log4js = require("log4js");

// global logger object
const logger = log4js.getLogger("appid-service");


module.exports = function(app, serviceManager){

	// The APIStrategy will be used when wrapping API calls. It is fairly simple
	// and will just ensure a user is logged in.  We do not use this strategy
	// in this tutorial, but this is how you would enable the JSON Web Token
	// authentication method.
	let apiStrategy = new AppIdAPIStrategy({
		oauthServerUrl: IBMCloudEnv.getString("appid_oauth_server_url")
	});

   // We will define some constants to provide redirects for the Web App Strategy.
   // The LOGIN_URL is the where we will redirect the browser to start signon.
   // The CALLBACK_URL is the endpoint where App ID will redirect the browser
   // when signon is done.
	const CALLBACK_URL = "/ibm/bluemix/appid/callback";
	const LOGIN_URL = "/ibm/bluemix/appid/login";



	var APPID_REDIRECT_URI = IBMCloudEnv.getString("appid_app_external_address") + CALLBACK_URL;
	logger.info("APPID_REDIRECT_URI: " + APPID_REDIRECT_URI);

	// The WebAppStrategy will allow our app's UI pages to redirect a user
	// to the App ID login widget if they are not currently logged in.
	// We will use this strategy on all of the pages except the welcome screen.
	let webStrategy = new WebAppStrategy({
		tenantId: IBMCloudEnv.getString("appid_tenant_id"),
		clientId: IBMCloudEnv.getString("appid_client_id"),
		secret: IBMCloudEnv.getString("appid_secret"),
		oauthServerUrl: IBMCloudEnv.getString("appid_oauth_server_url"),
		redirectUri: APPID_REDIRECT_URI,
		allowAnonymousLogin: true,
		passReqToCallback: true
	});

	userAttributeManager.init({profilesUrl: IBMCloudEnv.getString("appid_profiles_url")});

	serviceManager.set("appid-web-strategy", webStrategy);
	serviceManager.set("appid-web-strategy-name", WebAppStrategy.STRATEGY_NAME);
	serviceManager.set("appid-web-auth-context", WebAppStrategy.AUTH_CONTEXT);
	serviceManager.set("appid-api-strategy", apiStrategy);
	serviceManager.set("appid-api-strategy-name", AppIdAPIStrategy.STRATEGY_NAME);
	serviceManager.set("appid-user-attribute-manager", userAttributeManager);
	serviceManager.set("appid-redirect-uri", APPID_REDIRECT_URI);
	serviceManager.set("appid-callback-url", CALLBACK_URL);
	serviceManager.set("appid-login-url", LOGIN_URL);


	// Set up session and passport to be used by our routers

	// Note: You should use a persistent session store in practice, such as Redis.
	app.use(session({
		secret: "1234",
		resave: false,
		saveUninitialized: true,
		cookie: {
			httpOnly: false,
			secure: false,
			maxAge: (4 * 60 * 60 * 1000)
		}
	}));

	app.use(passport.initialize());
	app.use(passport.session());

	passport.use(webStrategy);
	passport.use(apiStrategy);


	// Configure passportjs with user serialization/deserialization. This is required
	// for authenticated session persistence accross HTTP requests. See passportjs docs
	// for additional information http://passportjs.org/docs
	passport.serializeUser(function(user, cb) {
		cb(null, user);
	});

	passport.deserializeUser(function(obj, cb) {
		cb(null, obj);
	});


	//app.get(LOGIN_URL, passport.authenticate(serviceManager.get('appid-web-strategy-name'), {
	//  forceLogin: true
	//}));

	// Set up the callback URL that will receive the JWT token from App ID.
	// Note: This is the path portion of the Redirect URI that you must configure in App ID.
	app.get(CALLBACK_URL, passport.authenticate(serviceManager.get("appid-web-strategy-name"),
		{allowAnonymousLogin: true}));


	// Set up a logout URL that can be called from the UI. This destroys the
	// current session. Note that it will not necessarily log a user out of
	// their SSO session with their chosen provider.

	app.get("/logout", function(req, res) {
		//stringify(req);
		req.session.destroy(function() {
			res.clearCookie("connect.sid");
			res.redirect("/");
		});
	});


};
