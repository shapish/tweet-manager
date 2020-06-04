// EXCLUSIVELY FOR POSTMAN TO RESET OR UPDATE DATA

// Modules
const express = require('express');
const router = express.Router();
const ejs = require('ejs');

const Tweet = require('../models/tweet');
const TweetScrape = require('../models/tweet-scrape');
// const Tta = require('../models/tta');
const Chapter = require('../models/chapter');
const {User} = require('../models/user');

const {createPath} = require('../helpers/general');





/**
 * Testing
 */







/**
 * Manipulating Data
 */

// Update tweets
router.put('/update-tweets', async (req, res) => {
	const count = await Tweet.updateMany({}, {
		// $unset: { 
		// 	id_str: 1,
		// },
		deleted: false
	}).count();

	res.send([`Done: ${count} records updated`]);
});

// Update tweets
router.put('/update-tweet-scrapes', async (req, res) => {
	const count = await TweetScrape.find({ deleted: true }).count();
	await TweetScrape.updateMany({
		deleted: true
	}, {
		deleted: false
	});

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
			path: createPath(user.name)
		});
	});
	users = await Promise.all(promises);
	res.send(users);
});





/**
 * Seeding
 */

// Seed database (with tweet ids from tta - Trump twitter archive)
router.post('/seed/:filename', async (req, res) => {
	const seedData = require('../data/' + req.params.filename);
	const batchSize = req.query.bs ? req.query.bs : 100;

	// Organize in batches
	const batches = [];
	for (let i=0; i<seedData.length; i++) {
		if (i % batchSize === 0) {
			batches.push([seedData[i]])
		} else {	
			batches[batches.length - 1].push(seedData[i]);
		}
	}

	let j = 0;
	const result = [];
	
	console.log('')
	console.log('')
	console.log('batches.length: ', batches.length);

	while (batches[j]) {
		console.log('#'+j, batches[j].length);
		batches[j] = batches[j].map(tw => {
			return {
				idTw: tw.id_str,
				source: tw.source
			}
		});
		// console.log(batches[j])
		const data = await TweetScrape.create(batches[j]);
		result.push(...data);
		j++;
	}
	console.log('- - - - - - - - - done');
	console.log('')
	console.log(seedData.length + ' items added');

	
	res.send([`successfully added ${seedData.length} documents`]);
});




module.exports = router;