/**
 * Quick API call to retrieve a user's ID
 * or other information based on their handle.
 * - - -
 * Currently not used, but required for gather-web-api
 */

const got = require('got');
const twAuth = new (require('./tw-auth'))();

module.exports = async function getUserData(userHandle, dataPoint, cb) {
	if (!userHandle) return console.log('getUserData requires a user handle');

	let result;
	await twAuth.refresh();
	try {
		result = await got(`https://api.twitter.com/1.1/users/show.json?screen_name=${userHandle}`, { headers: twAuth.getHeaders() });
	} catch (error) {
		resonse = 'Error getting user id';
		result += (error.response && error.response.body) ? ' ' + error.response.body : '';
		return;
	}

	result = JSON.parse(result.body);
	result = dataPoint ? result[dataPoint] : result;
	if (cb) cb(result);
	return result;
}