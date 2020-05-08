// Modules
const express = require('express');
const config = require('config');
var cookieParser = require('cookie-parser');
const error = require('../middleware/error'); // Centralized express error handler

// Routes
const index = require('../routes/index');
const apiChapters = require('../routes/api-chapters');
const apiLabels = require('../routes/api-labels');
const apiTweets = require('../routes/api-tweets');

// Frontend Helpers
const frontendHelpers = require('../functions/general-global');

module.exports = function(app) {
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(cookieParser());
	app.use(express.static('public'));
	
	// Template engine + global variables & helpers
	app.set('view engine', 'ejs');
	for (const value in config.get('globalEJSVars')) {
		app.locals[value] = config.get('globalEJSVars')[value];
	}
	for (const helper in frontendHelpers) {
		app.locals[helper] = frontendHelpers[helper];
	}
	
	app.use('/', index);
	app.use('/api/chapters', apiChapters);
	app.use('/api/labels', apiLabels);
	app.use('/api/tweets', apiTweets);
	app.use(error);



	
}