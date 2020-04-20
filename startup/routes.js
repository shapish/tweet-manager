// Modules
const express = require('express');
const config = require('config');
var cookieParser = require('cookie-parser');

// Routes
const index = require('../routes/index');

module.exports = function(app) {
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(cookieParser());
	app.use(express.static('public'));
	
	// Template engine + global variables
	app.set('view engine', 'ejs');
	for (let value in config.get('globalEJSVars')) {
		app.locals[value] = config.get('globalEJSVars')[value];
	}

	app.use('/', index);
}