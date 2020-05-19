// Modules
const express = require('express');
const router = express.Router();

// Models
const Tweet = require('../models/tweet');
const {User} = require('../models/user');
const Foo = require('../models/foo');
const Dup = require('../models/dup');

// Middleware
const {auth} = require('../middleware/auth');


// Star single tweet
router.put('/star/:id', auth, async (req, res) => {
	const {id} = req.params;
	const {level} = req.body;

	const tweet = await Tweet.findByIdAndUpdate(id, {
		stars: level
	});
	res.send(tweet);
});


// Star many tweets
router.put('/star', auth, async (req, res) => {
	const {ids} = req.body;
	const {level} = req.body;

	const tweets = await Tweet.updateMany({
		_id: { $in: ids }
	}, {
		stars: level
	});
	
	res.send(tweets);
});


// Archive single tweet
router.put('/archive/:id', auth, async (req, res) => {
	const {id} = req.params;
	const {doArchive} = req.body;

	const tweet = await Tweet.findByIdAndUpdate(id, {
		archived: doArchive
	});
	res.send(tweet);
});


// Archive many tweets
router.put('/archive', auth, async (req, res) => {
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


// POSTMAN - Manipulate data
router.post('/manipulate', auth, async (req, res) => {
	const tweets = await User.updateMany({}, {
		s_showLabels: true,
		s_showMeta: false,
		s_clipTweets: false,
		s_pageSize: 10,
		s_listPages: 30
	});

	res.send(tweets);
});


// POSTMAN - Seed database
router.post('/seed/:filename', auth, async (req, res) => {
	const seedData = require('../data/' + req.params.filename);

	const batchSize = req.query.bs ? req.query.bs : 100;
	// const interval = req.query.iv ? req.query.iv : 2000;


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
		const data = await Foo.create(batches[j]);
		result.push(...data);
		j++;
	}
	console.log('- - - - - - - - - done');
	console.log('')
	console.log('RESULT:\n ', result);

	
	res.send(result);
});




module.exports = router;