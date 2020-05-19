const config = require('config');

module.exports = function() {
	if (!config.get('jwtPrivateKey')) {
		throw new Error('FATAL ERROR: twm_jwtPrivateKey not defined. Terminal: export twm_jwtPrivateKey=xyz');
	}
}