// EXCLUSIVELY FOR POSTMAN TO RESET OR UPDATE DATA

// Modules
const express = require('express');
const router = express.Router();
const ejs = require('ejs');
const schedule = require('node-schedule');
const fs = require('fs');

// Models
const { Tweet, TweetScrape } = require('../models/tweet');
const Tta = require('../models/tta');
const Chapter = require('../models/chapter');
const {User} = require('../models/user');

// Functions
const { pathEncode, timeout } = require('../helpers/general');
const { prettyNr } = require('../helpers/general-global');
const { extract } = require('../scraper/extract');
const cli = require('../helpers/cli-monitor');
const { gatherIds } = require('../scraper/gather');

// (async () => {
// 	var x = await Tweet.listIndexes();
// 	console.log('@', x)
// })();



/**
 * Testing
 */









/**
 * Manipulating Data
 */

// Update tweets
router.put('/update-tweets', async (req, res) => {
	const Model = Tweet;
	const query = { 'media.0': { $exists: true }  };
	const count = await Model.countDocuments(query);

	await Model.updateMany(query, {
		// $unset: { 
		// 	author: 1,
		// },
	});

	res.send([`Done: ${count} records updated`]);
});


// Delete recent tweets
router.put('/delete-recent-tweets', async (req, res) => {
	const Model = Tweet;
	const query = { date: { $gt: new Date('6-3-2020') } }
	const count = await Model.countDocuments(query);

	await Model.deleteMany(query);


	res.send([`Done: ${count} records updated`]);
});

// Remove chapters
router.put('/clear-chapters', async (req, res) => {
	const chapters = await Chapter.updateMany({}, {
		tweets: []
	});

	const tweets = await Tweet.updateMany({}, {
		// $unset: { chapterId: 1 },
		chapter: null
	});

	res.send(['done']);
});

// Fix chapters
router.put('/fix-chapters', async (req, res) => {
	await Chapter.updateMany({}, {
		// type: '',
		// writer: null,
		// description: '',
		stage: 0,
		// textLink: '',
		// $unset: { alternativeTitles: 1 },
		// wordCount: null,
		// altTitles: ''
	});

	res.send(['done']);
});

// Fix users
router.post('/fix-users', async (req, res) => {
	const users = await User.updateMany({}, {
		// s_showLabels: true,
		// s_showMeta: false,
		// s_clipTweets: false,
		// s_pageSize: 10,
		// s_listPages: 30
	});

	res.send(users);
});

// Fix users path
router.post('/fix-users-path', async (req, res) => {
	let users = await User.find();
	var promises = users.map(user => {
		return User.findByIdAndUpdate(user._id, {
			username: pathEncode(user.name)
		});
	});
	users = await Promise.all(promises);
	res.send(users);
});






module.exports = router;