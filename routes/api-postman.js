// EXCLUSIVELY FOR POSTMAN TO RESET OR UPDATE DATA

// Modules
const express = require('express');
const router = express.Router();
const ejs = require('ejs');

const Tweet = require('../models/tweet');
const Chapter = require('../models/chapter');
const {User} = require('../models/user');

const {createPath} = require('../functions/general');


// Update tweets
router.put('/update-tweets', async (req, res) => {
	const tweets = await Tweet.updateMany({}, {
		// $unset: { archive: 1 },
		stars: null
	});

	res.send(['done']);
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


// Fix users poth
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


// Seed database
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
		const data = await Tweet.create(batches[j]);
		result.push(...data);
		j++;
	}
	console.log('- - - - - - - - - done');
	console.log('')
	console.log(seedData.length + ' items added');

	
	res.send([`successfully added ${seedData.length} documents`]);
});




module.exports = router;