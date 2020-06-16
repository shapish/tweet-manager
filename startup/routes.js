// Modules
const express = require('express');
const config = require('config');
var cookieParser = require('cookie-parser');
const error = require('../middleware/error'); // Centralized express error handler

// Routes
const pages = require('../routes/pages');
const search = require('../routes/search');
const chapters = require('../routes/chapters');
const apiChapters = require('../routes/api-chapters');
const apiLabels = require('../routes/api-labels');
const apiTweets = require('../routes/api-search');
const apiUsers = require('../routes/api-users');
const apiLogin = require('../routes/api-login');
const apiPostman = require('../routes/api-postman');

// Development-only
const isProd = process.env.NODE_ENV == 'production';
const apiScraper = isProd ? null : require('../routes/api-scraper');

// Frontend Helpers
const frontendHelpers = require('../helpers/general-global');

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
	
	app.use('/', pages);
	app.use('/search', search);
	app.use('/chapters', chapters);
	app.use('/api/chapters', apiChapters);
	app.use('/api/labels', apiLabels);
	app.use('/api/tweets', apiTweets);
	app.use('/api/users', apiUsers);
	app.use('/api/login', apiLogin);
	app.use('/api/postman', apiPostman);
	app.use('/api/seed', apiPostman);
	app.use(error);
	
	// Development only
	if (apiScraper) app.use('/api/scraper', apiScraper);
}