// Modules
const express = require('express');
const router = express.Router();

// Models
const Label = require('../models/label');
const Tweet = require('../models/tweet');
const Test = require('../models/test');


// Star single tweet
router.put('/star/:id', async (req, res) => {
	const {id} = req.params;
	const {level} = req.body;

	const tweet = await Tweet.findByIdAndUpdate(id, {
		star: level
	});
	res.send(tweet);
});


// Star many tweets
router.put('/star', async (req, res) => {
	const {ids} = req.body;
	const {level} = req.body;
	
	let tweets = ids.map(id => {
		return Tweet.findByIdAndUpdate(id, {
			star: level
		});
	});
	tweets = await Promise.all(tweets);
	res.send(tweets);
});


// Archive single tweet
router.put('/archive/:id', async (req, res) => {
	const {id} = req.params;
	const {doArchive} = req.body;

	const tweet = await Tweet.findByIdAndUpdate(id, {
		archived: doArchive
	});
	res.send(tweet);
});


// Archive many tweets
router.put('/archive', async (req, res) => {
	const {ids} = req.body;
	const {doArchive} = req.body;
	
	let tweets = ids.map(id => {
		return Tweet.findByIdAndUpdate(id, {
			archived: doArchive
		});
	});
	tweets = await Promise.all(tweets);
	res.send(tweets);
});

// Seed database
router.post('/seed/:filename', async (req, res) => {
	const seedData = require('../data/' + req.params.filename);
	const data = await Test.create(seedData);
	res.send(data);
});




module.exports = router;