// Modules
const express = require('express');
const router = express.Router();

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
	res.render('chapters');
});

// Labels
router.get('/labels', async (req, res) => {
	res.render('labels');
});

module.exports = router;