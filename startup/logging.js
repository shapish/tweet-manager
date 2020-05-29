const logger = require('../helpers/logger');

module.exports = function() {
	// Catch/try wrap for all exoress operations
	require('express-async-errors');
	
	// Catch unhandled rejections by making them an exception which gets caught by winston
	process.on('unhandledRejection', (ex) => {
		logger.error('unhandledRejection', ex); // This renders cleaner than throwing exception
		// throw ex;
	});
}