// Modules
const express = require('express');
const router = express.Router();

// Models
const Chapter = require('../models/chapter');

// Tweets
router.get('/', async (req, res) => {
	res.render('index');
});

// Overview
router.get('/overview', async (req, res) => {
	

	res.render('overview');
});

// Chapters
router.get('/chapters', async (req, res) => {
	const chapters = await Chapter.find()
		.sort('index');

	// console.log(chapters)

	res.render('chapters', {
		chapters: chapters
	});
});

// Labels
router.get('/labels', async (req, res) => {
	res.render('labels');
});

module.exports = router;