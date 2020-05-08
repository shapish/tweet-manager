// Modules
const express = require('express');
const router = express.Router();

// Models
const Tweet = require('../models/tweet');
const Foo = require('../models/foo');


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








// router.post('/seed/:filename', async (req, res) => {
// 	const seedData = require('../data/' + req.params.filename);

// 	const batchSize = req.query.bs ? req.query.bs : 10;
// 	const interval = req.query.iv ? req.query.iv : 2000;


// 	// Organize in batches
// 	const batches = [];
// 	for (let i=0; i<seedData.length; i++) {
// 		if (i % batchSize === 0) {
// 			batches.push([seedData[i]])
// 		} else {
// 			batches[batches.length - 1].push(seedData[i]);
// 		}
// 	}

// 	let j = 0;
// 	const result = [];
// 	write();
// 	console.log('')
// 	console.log('')
// 	console.log('batches.length: ', batches.length);

// 	async function write() {
// 		console.log('#'+j, batches[j].length);
// 		const data = await Foo.create(batches[j]);
// 		result.push(data);
// 		j++;
// 		if (batches[j]) {
// 			setTimeout(write, interval);
// 		} else {
// 			console.log('- - - - - - - - - done');
// 		}
// 	}
// 	console.log('')
// 	console.log('RESULT:\n ', result);

	
// 	res.send(result);
// });