// EXCLUSIVELY FOR POSTMAN TO RESET OR UPDATE DATA

// Modules
const express = require('express');
const router = express.Router();
const ejs = require('ejs');

const Tweet = require('../models/tweet');
const TweetScrape = require('../models/tweet-scrape');
const Tta = require('../models/tta');
const ScrapeControl = require('../models/scrape-control');
const Chapter = require('../models/chapter');
const {User} = require('../models/user');

const {createPath} = require('../helpers/general');
const { extract } = require('../scraper/extract');





/**
 * Testing
 */







/**
 * Manipulating Data
 */

// Fill in deleted tweets
router.put('/fill-deleted', async (req, res) => {
	const ctrl = await ScrapeControl.findOne({ name: 'scrape-control' });

	let deleted = await TweetScrape.find({
		deleted: true,
		text: null
	});

	// let deleted = await TweetScrape.updateMany({
	// 	deleted: true
	// }, {
	// 	$unset: {
	// 		source: 1
	// 	}
	// })

	// deleted = deleted.map(async tweet => {
	// 	return extract(tweet.idTw, ctrl.user);
	// });
	// await Promise.all(deleted);

	// Fill in data
	for (let i=0; i<deleted.length; i++) {
		if (!deleted[i].text) {
			const tta = await Tta.findOne({
				id_str: deleted[i].idTw
			});
			console.log(tta.id_str)
			deleted[i].text = tta.text;
			deleted[i].user = {
				name: 'Donald J. Trump',
				screen_name: 'realDonaldTrump',
				location: 'Washington, DC',
				description: '45th President of the United States of America🇺🇸',
				profile_image_url_https: 'https://pbs.twimg.com/profile_images/874276197357596672/kUuht00m_normal.jpg'
			};
			deleted[i].date = tta.created_at;
			deleted[i].isRT = tta.is_retweet;
			deleted[i].url = 'https://twitter.com/realDonaldTrump/' + deleted[i].idTw;
			deleted[i].extra.likes = tta.favorite_count;
			deleted[i].extra.retweets = tta.retweet_count;
			deleted[i].source = tta.source;
		} else {
			console.log('Not deleted: ', deleted[i].idTw);
		}
	};
	
	// Update database
	const pr = deleted.map(tweet => {
		return TweetScrape.findOneAndUpdate({
			idTw: tweet.idTw
		}, tweet);
	});
	deleted = await Promise.all(pr);


	res.send(deleted)
});

// Update tweets
router.put('/update-tweets', async (req, res) => {
	const count = await TweetScrape.count();
	await TweetScrape.updateMany({}, {
		// $unset: { 
		// 	author: 1,
		// },
		user: {
			name: 'Donald J. Trump',
			handle: 'realDonaldTrump'
		}
	});

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
const Test = require('../models/test');
// Seed database (with tweet ids from tta - Trump twitter archive)
router.post('/seed/:filename', async (req, res) => {
	const seedData = require('../data/' + req.params.filename);
	const batchSize = req.query.bs ? req.query.bs : 100;
	const p = req.query.p ? req.query.p : 1;
	const pageSize = 5000; // Limit to 5000 items at a time or server can time out
	const end = Math.min(pageSize * p, seedData.length);

	// Organize in batches
	const batches = [];
	for (let i=(p-1) * pageSize; i<end; i++) {
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

	res.send('Seed command sent');

	while (batches[j]) {
		console.log('p' + p + ' - #'+j, batches[j].length);
		
		// Translate to our own format
		// batches[j] = batches[j].map(tw => {
		// 	return {
		// 		idTw: tw.id_str,
		// 		source: tw.source
		// 	}
		// });
		// console.log(batches[j])
		try {
			const data = await Tweet.create(batches[j]);
			result.push(...data);
		}
		catch {
			console.log('Error, probably duplicates, on batch #' + j + '\n\n');
		}
		j++;
	}
	console.log('- - - - - - - - - done');
	console.log('')
	console.log(seedData.length + ' items added');

	
});


// router.post('/seed/:filename', async (req, res) => {
// 	const seedData = require('../data/' + req.params.filename);
// 	const batchSize = req.query.bs ? req.query.bs : 100;

// 	// Organize in batches
// 	const batches = [];
// 	for (let i=0; i<seedData.length; i++) {
// 		if (i % batchSize === 0) {
// 			batches.push([seedData[i]])
// 		} else {	
// 			batches[batches.length - 1].push(seedData[i]);
// 		}
// 	}

// 	// let j = 0;
// 	const result = [];
	
// 	console.log('Number of batches: ' + batches.length + ' * ' + batchSize);

// 	res.send('Seed command sent');

// 	// Loop throug batches
// 	for (let j=0; j<batches.length; j++) {
// 		console.log('#' + j, batches[j].length);
		
// 		// Translate tta to our own format
// 		// batches[j] = batches[j].map(tw => {
// 		// 	return {
// 		// 		idTw: tw.id_str,
// 		// 		source: tw.source
// 		// 	}
// 		// });
// 		// console.log(batches[j])

// 		try {
// 			const data = await Tweet.create(batches[j]);
// 			result.push(...data);
// 		}
// 		catch {
// 			console.log('Error, probably duplicates, on batch #' + j + '\n\n');
// 		}
// 		console.log(j % 100)
// 		if (j % 100 === 99) {
// 			console.log('/n/n- break-/n/n');
// 			await timeout(5000);
// 		}
// 	}
	
// 	console.log('- - - - - - - - - done');
// 	console.log('')
// 	console.log(seedData.length + ' items added');

	
// });




module.exports = router;