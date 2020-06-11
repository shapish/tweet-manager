// EXCLUSIVELY FOR POSTMAN TO RESET OR UPDATE DATA

// Modules
const express = require('express');
const router = express.Router();
const ejs = require('ejs');
const fs = require('fs');

const Tweet = require('../models/tweet');
const TweetScrape = require('../models/tweet-scrape');
const Tta = require('../models/tta');
const ScrapeControl = require('../models/scrape-control');
const Chapter = require('../models/chapter');
const {User} = require('../models/user');
const { fillInDeleted, expandRetweet } = require('../scraper/control');

const { createPath, timeout } = require('../helpers/general');
const { extract } = require('../scraper/extract');
const cli = require('../helpers/cli-monitor');





/**
 * Testing
 */

const schedule = require('node-schedule');
router.post('/schedule', async (req, res) => {
	const dateStamp = new Date(new Date().getTime() + 2 * 1000);
	var s = schedule.scheduleJob(dateStamp, function(){
		console.log('The world is going to end today.');
	});
	res.send(s);
});

// This lets you continuously write to file iwthout overloading memory.
router.post('/write-stream', async (req, res) => {
	// https://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node/43370201#43370201
	var stream = fs.createWriteStream('public/downloads/test.txt', {flags:'a'});
	console.log(new Date().toISOString());
	[...Array(10)].forEach((item, i) => {
	    stream.write(i + "test\n");
	});
	console.log(new Date().toISOString());
	stream.end();
	res.send('ok');
});

router.post('/append-to-file', async (req, res) => {
	// https://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node/43370201#43370201
	fs.appendFile('public/downloads/test.txt', 'data to append\n', function (err) {
		if (err) throw err;
		console.log('Saved!');
	});
	res.send('ok!');
});







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

	// Fill in data
	for (let i=0; i<deleted.length; i++) {
		await fillInDeleted(deleted[i]);
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

// Remove author field
router.put('/remove-author', async (req, res) => {
	const Model = Tweet;
	const count = await Model.countDocuments();
	const tweets = await Model.updateMany({}, {
		$unset: { 
			author: 1
		}
	});

	res.send([`Done: ${count} records updated`, tweets]);
});

// Update tweets
router.put('/fix-video-gif-type-and-url', async (req, res) => {
	const Model = Tweet;
	const query = { 'media.0': { $exists: true }  };
	const count = await Model.countDocuments(query);
	const tweets = await Model.find(query);

	for (let i=0; i<tweets.length; i++) {
		const tweet = tweets[i];
		const ogData = JSON.parse(tweet.ogData);
		tweet.media = tweet.media.map((m, j) => {
			const ogMedia = ogData.extended_entities.media[j];
			const type = ogMedia.type;
			// console.log(i, j, type, tweet.idTw)

			// Video: Cycle trough formats to find the largest bitrate
			let videoUrl;
			if (type == 'video') {
				let videoFormats = ogMedia.video_info.variants; // Array of video formats
				let bitrate = 0;
				videoFormats.forEach(format => {
					if (format.bitrate && format.bitrate > bitrate) {
						bitrate	= format.bitrate;
						videoUrl = format.url
					}
				});
				// console.log('videoUrl: ', videoUrl, bitrate);
			}

			// Gif: Pluck video directly
			let gifUrl = (type == 'animated_gif') ? ogMedia.video_info.variants[0].url : null;
			// if (type == 'animated_gif') console.log('gifUrl: ', gifUrl, ogMedia.video_info.variants.length)

			m.mType = type;
			if (type == 'video') m.videoUrl = videoUrl
			if (type == 'animated_gif') m.gifUrl = gifUrl;
			return m;
		});
		
		// Save to db
		await Tweet.findOneAndUpdate({
			idTw: tweet.idTw
		}, {
			media: tweet.media
		});

	}

	// await Model.updateMany(query, {
	// 	// $unset: { 
	// 	// 	author: 1,
	// 	// },
	// 	// rt: null,
	// 	isRT: true
	// });

	res.send([`Done: ${count} records updated`]);
});

// Update tweets
router.put('/delete-recent-tweets', async (req, res) => {
	const Model = Tweet;
	const query = { date: { $gt: new Date('6-3-2020') } }
	const count = await Model.countDocuments(query);

	await Model.deleteMany(query);

	// await Model.updateMany(query, {
	// 	// $unset: { 
	// 	// 	author: 1,
	// 	// },
	// 	// rt: null,
	// 	isRT: true
	// });

	res.send([`Done: ${count} records updated`]);
});

// Fix retweet flags
router.put('/reset-rt', async (req, res) => {
	// This first:
	const result = await Tweet.updateMany({}, {
		isRT: null
	});

	res.send([`Done: ${result.nModified}/${result.n} records updated`]);
});

// Expand tta RTs
router.put('/expand-rt', async (req, res) => {
	const batchSize = 70;
	const query = {
		text: { $regex: /^RT @/ },
		
		// isRT: true,
		// deleted: true

		// idTw: '1267668820640108550' //dt
		// idTw: '1267588935338930176' // not dt
	}
	const total = await Tweet.countDocuments(query);
	let  done = 0;
	let i = 1;
	cli.banner('Start expanding retweets');
	res.send([`Expanding activated, ${total} documents to go.`]);
	
	_cycle();
	// const to = setTimeout(_cycle, batchSize * 5000); // Avoid going over rate limit
	const to = setInterval(_cycle, 120000); // Avoid going over rate limit
	
	async function _cycle() {
		const count = await Tweet.countDocuments(query).limit(batchSize);
		const tweets = await Tweet.find(query).limit(batchSize).lean();

		// Log
		cli.title(`Cycle #${i} : ${count*i} / ${total} - ${getTime()}`, 2);

		// Loop through retweets & replace with original tweets
		let refreshToken = true;
		for (let j=0; j<tweets.length; j++) {
			console.log('#' + (done+1), tweets[j].text.replace(/\n/g, ' '));
			const newTweet = await expandRetweet(tweets[j], refreshToken);
			refreshToken = false;
			// console.log(newTweet)
			if (newTweet == 88) { await timeout(30000); cli.title('WAIT'.red,2,2); j-- } // Rate limit exceeded, wait 30 sec
			done++;
		}

		// Repeat cycle
		if (i < total) {
			i++;
		} else {
			clearInterval(to)
		}
	}
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