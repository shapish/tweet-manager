/*

// To test logger functionality
- - - - - - - - - - - - - - - -

// Express error
- - -
// Add this to express operation in routes/xxx.js
// or in middleware/error.js if centralized
res.status(500).send('something failed'); // <-- 

// Exception
- - -
// Add to index.js
throw new Error('Oops something failed!');

// Unhandled promise rejection
- - -
// Add to index.js
const p = Promise.reject(new Error('Something failed miserably'));
p.then(() => console.log('done')) // no catch;

*/

const { createLogger, format, transports } = require('winston');
require('winston-mongodb');
const config = require('config');

// Each error level can be called as logged.<level>():
// - error
// - warn
// - info
// - verbose
// - debug
// - silly

module.exports = createLogger({
	level: 'info',
	format: format.json(),
	transports: [
		// - Write to all logs with level 'info' and below to 'combined.log' 
		// - Write all error logs (and below) to 'error.log'
		// - Write to console
		// - Write to database
		new transports.File({ filename: './logs/error.log', level: 'error'}),
		new transports.File({ filename: './logs/combined.log' }),
		new transports.Console({
			format: format.combine(
				format.colorize(),
				format.splat(),
				format.simple(),
				format.prettyPrint()
			),
			handleExceptions: true
		}),
		new transports.MongoDB({
			db: config.get('db'),
			level: 'error',
			options: {
				useUnifiedTopology: true // Supress deprecation warning
			}
			// For some reason "meta" is not being logged unfortunately, check documentation
		})
	],
	exceptionHandlers: [
		// We don't have a console transport here because it doesn't get properly formatted
		// However the (handleExceptions: true) under the general transports takes care of that
		new transports.File({ filename: './logs/exceptions.log'}),
		new transports.File({ filename: './logs/combined.log' }),
		new transports.MongoDB({
			db: config.get('db'),
			level: 'error',
			options: {
				useUnifiedTopology: true // Supress deprecation warning
			},
			collection: 'log_exceptions'
			// For some reason "meta" is not being logged unfortunately, check documentation
		})
	]
});