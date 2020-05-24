// const jwt = require('jsonwebtoken');
// const config = require('config');
// const logger = require('../helpers/logger');

// module.exports = function(req, res, next) {
// 	const token = req.cookies.authToken;
// 	// console.log('req.user', req.user);
// 	try {
// 		const user = jwt.verify(token, config.get('jwtPrivateKey'));
// 		console.log('user', user);
// 		next();
// 	}
// 	catch (ex) {
// 		req.user = false;
// 		logger.error('Failed to get user data (get-user-data.js)');
// 		next();
// 	}
// }