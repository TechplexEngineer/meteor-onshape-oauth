'use strict';

/**
 * Define the base object namespace. By convention we use the service name
 * in PascalCase (aka UpperCamelCase). Note that this is defined as a package global.
 */
Onshape = {};

/**
 * Boilerplate hook for use by underlying Meteor code
 */
Onshape.retrieveCredential = (credentialToken, credentialSecret) => {
	return OAuth.retrieveCredential(credentialToken, credentialSecret);
};

/**
 * Define the fields we want.
 * Note that they come from https://cad.onshape.com/api/users/sessioninfo
 * Note that we *must* have an id. Also, this array is referenced in the
 * accounts-onshape package, so we should probably keep this name and structure.
 */
Onshape.whitelistedFields = ['id', 'email', 'firstName', 'lastName', 'image', 'name'];

/**
 * Register this service with the underlying OAuth handler
 * (name, oauthVersion, urls, handleOauthRequest):
 *  name = 'onshape'
 *  oauthVersion = 2
 *  urls = null for OAuth 2
 *  handleOauthRequest = function(query) returns {serviceData, options} where options is optional
 * serviceData will end up in the user's services.onshape
 */
OAuth.registerService('onshape', 2, null, function(query) {

	/**
	 * Make sure we have a config object for subsequent use (boilerplate)
	 */
	const config = ServiceConfiguration.configurations.findOne({
		service: 'onshape'
	});
	if (!config) {
		throw new ServiceConfiguration.ConfigError();
	}

	/**
	 * Get the token and username (Meteor handles the underlying authorization flow).
	 * Note that the username comes from from this request in Onshape.
	 */
	const response = getTokens(config, query);
	const accessToken = response.accessToken;
	const sessionInfo = getSessionInfo(config, accessToken);
	const username = sessionInfo.name;

	/**
	 * If we got here, we can now request data from the account endpoints
	 * to complete our serviceData request.
	 * The identity object will contain the username plus *all* properties
	 * retrieved from the account and settings methods.
	*/
	const identity = _.extend(
		{username},
		sessionInfo,
		// getSettings(config, username, accessToken)
	);


	/**
	 * Build our serviceData object. This needs to contain
	 *  accessToken
	 *  expiresAt, as a ms epochtime
	 *  refreshToken, if there is one
	 *  id - note that there *must* be an id property for Meteor to work with
	 *  email
	 *  reputation
	 *  created
	 * We'll put the username into the user's profile
	 */
	const serviceData = {
		accessToken,
		expiresAt: (+new Date) + (1000 * response.expiresIn)
	};
	if (response.refreshToken) {
		serviceData.refreshToken = response.refreshToken;
	}
	_.extend(serviceData, _.pick(identity, Onshape.whitelistedFields));

	/**
	 * Return the serviceData object along with an options object containing
	 * the initial profile object with the username.
	 */
	return {
		serviceData: serviceData,
		options: {
			profile: {
				name: username // comes from getSessionInfo
			}
		}
	};
});

/**
 * The following three utility functions are called in the above code to get
 *  the access_token, refresh_token and username (getTokens)
 *  account data (getAccount)
 *  //settings data (getSettings)
 * repectively.
 */

/** getTokens exchanges a code for a token in line with Onshape's documentation
 * Doc: https://dev-portal.onshape.com/doc/oauth.html#exchanging-the-code-for-a-token
 *
 *  returns an object containing:
 *   accessToken        {String}
 *   expiresIn          {Integer}   Lifetime of token in seconds
 *   refreshToken       {String}    If this is the first authorization request
 *   token_type         {String}    Set to 'Bearer'
 *
 * @param   {Object} config       The OAuth configuration object
 * @param   {Object} query        The OAuth query object
 * @return  {Object}              The response from the token request (see above)
 */
const getTokens = function(config, query) {

	const endpoint = 'https://oauth.onshape.com/oauth/token';

	/**
	 * Attempt the exchange of code for token
	 */
	let response;
	try {
		response = HTTP.post(
			endpoint, {
				params: {
					code: query.code,
					client_id: config.clientId,
					client_secret: OAuth.openSecret(config.secret),
					grant_type: 'authorization_code'
				}
			});

	} catch (err) {
		throw _.extend(new Error(`Failed to complete OAuth handshake with Onshape. ${err.message}`), {
			response: err.response
		});
	}

	if (response.data.error) {

		/**
		 * The http response was a json object with an error attribute
		 */
		throw new Error(`Failed to complete OAuth handshake with Onshape. ${response.data.error}`);

	} else {

		/** The exchange worked. We have an object containing
		 *   access_token
		 *   refresh_token
		 *   expires_in
		 *   token_type
		 *
		 * Return an appropriately constructed object
		 */
		return {
			accessToken: response.data.access_token,
			refreshToken: response.data.refresh_token,
			expiresIn: response.data.expires_in
		};
	}
};

/**
 * getSessionInfo gets the basic Onshape account session data
 *
 *  returns an object containing:
 *		id				{String}		Onshape internal use
 *		name			{String}		User's name (OAuth2ReadPII)
 *		href			{String}		Onshape internal use
 *		firstName		{String}		User's first name (OAuth2ReadPII)
 *		lastName		{String}		User's last name (OAuth2ReadPII)
 *		email			{String}		User's email (OAuth2ReadPII)
 *		image			{String}		User's image (OAuth2ReadPII)
 *		state			{Number}		Onshape internal use
 *		oauth2Scopes	{Number}		Onshape internal use
 *		clientId		{String}		application's client ID
 *		role			{Number}		Onshape internal use
 *		roles			{String[]}		User's roles (OAuth2ReadPII)
 *
 * @param   {Object} config       The OAuth configuration object
 * @param   {String} accessToken  The OAuth access token
 * @return  {Object}              The response from the account request (see above)
 */
const getSessionInfo = function(config, accessToken) {

	const endpoint = `https://cad.onshape.com/api/users/sessioninfo`;
	let accountObject;

	/**
	 * HTTP.get returns the object in the response's data property.
	 */
	try {
		accountObject = HTTP.get(
			endpoint, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			}
		).data;
		return accountObject;

	} catch (err) {
		throw _.extend(new Error(`Failed to fetch session data from Onshape. ${err.message}`), {
			response: err.response
		});
	}
};


