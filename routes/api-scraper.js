const express = require('express');
const router = express.Router();

// Models
const Tweet = require('../models/tweet');
const TweetScrape = require('../models/tweet-scrape'); // Mirror of Tweet where we store scraped tweets
const ScrapeControl = require('../models/scrape-control'); // Storing of options and status

// Functions
const { gatherAndStore, extractData, openBrowser } = require('../scraper/control');  // Control functions
const request = require('../scraper/request');
const extract = require('../scraper/extract');
const cli = require('../helpers/cli-monitor');




// Inspect tweet data
// 1268023370425274368 // Deleted tweet
// 1266740439740284928 // Thread
// 1268006529678049281
router.get('/tweet/:id', async (req, res) => {
	const tweet = await extract(req.params.id);
	console.log(tweet)
	console.log(JSON.stringify(tweet, null, 4))
	res.send(tweet);
});


// API: Toggle scraper
// --> Scrape ids from browser session
router.post('/gather/:state', async (req, res) => {
	let state = +req.params.state;
	if (state) {
		console.log('---------------------------------');
		console.log('-------- Start Gathering --------');
		console.log('---------------------------------');
		console.log('');

		// Fetch starting URL
		let { url, account } = await ScrapeControl.findOne({ name: 'scrape-control' });
		if (!url) url = 'https://twitter.com/' + account;

		// Start scraping
		gatherAndStore(url);
	}

	const ctrl = await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
		gathering: state
	}, { new: true });
	res.send(ctrl);
});



// API: Toggle extractor
// --> Loop through scraped ids and extract tweet data
router.post('/extract/:state', async (req, res) => {
	let state = +req.params.state;

	if (state) {
		// Display START banner
		const total = await TweetScrape.estimatedDocumentCount();
		const done = await TweetScrape.countDocuments({ text: { $exists: true } });
		cli.banner('Start Extracting');
		cli.progress(done, total)

		// Start scraping
		extractData();
	}

	const ctrl = await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
		extracting: state
	}, { new: true });
	res.send(ctrl);
});



// API: Transfer
// --> Move data from scraped table to main table
router.post('/transfer', async (req, res) => {
	const batchSize = 500;
	let batch = 0;
	const total = await TweetScrape.count({ text: { $exists: true } });
	res.send(`Transferring: ${total} tweets`);

	// Remove previously old tweets
	// Tweet.collection.drop();

	console.log('');
	console.log('');
	console.log('TRANSFER START');
	console.log(`${total} tweets`);
	console.log('');
	console.log('');
	await _transferLoop();
	console.log('Transfer complete');

	async function _transferLoop() {
		console.log('Batch', batch)
		const tweets = await TweetScrape.find({ text: { $exists: true } })
			.skip(batch * batchSize)
			.limit(batchSize)
			.select('-_id -__v')
			.lean();
		await Tweet.create(tweets);
		console.log('-- Done --');
		console.log('');
		batch++;

		// Keep on looping until end is reached
		if ((batch * batchSize) < total) {
			await _transferLoop();
		}
	}
});



// Testing: create documents
router.get('/test', async (req, res) => {
	var docs = [{
		location: { name: null, id: null },
		thread: { prev: '1266742919815454723', next: null },
		extra: { likes: 0, replies: 0, retweets: 0, poll: null },
		tagsTw: [],
		mentions: [ 'the_forty_fifth', 'charlytesta' ],
		internalLinks: [],
		externalLinks: [],
		stars: 0,
		labels: [],
		archived: false,
		idTw: '1266743039982215173',
		author: 'themoenen',
		date: '2020-05-30T14:47:30.000Z',
		isRT: false,
		text: '@the_forty_fifth @charlytesta comment on comment 1',
		url: 'https://twitter.com/themoenen/status/1266743039982215172'
	}];
	  
	var result = await TweetScrape.create(docs);


	res.send(result);
});



// Initialize scraper
// --> Create control center in database with any account name
router.get('/init/:account', async (req, res) => {
	let ctrl = await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
		name: 'scrape-control',
		extracting: false,
		gathering: false,
		url: null,
		account: req.params.account,
		p: 1,
		total: 1
	}, { upsert: true, new: true});

	// Delete other scraped tweets
	// TweetScrape.collection.drop();

	res.send(ctrl);
});



// Reset
// --> Reset url to start url (otherwise it will pick up where left off)
router.get('/reset', async (req, res) => {
	const ctrl = await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
		url: null
	}, { new: true});

	res.send(ctrl);
});



// Testing: inspect payload
router.get('/test-payload/:id', async (req, res) => {
	// eg. 1266741095561650176
	// let payload = await request('https://twitter.com/_/status/' + req.params.id);
	let payload = await request('https://twitter.com/ferrebeekeeper/status/1159843489535758342');
	
	res.send(payload)
});



// Testing: Open browser
router.get('/open-browser', async (req, res) => {
	openBrowser();
	res.send('Chromium should open.')
});



// Testing: Populate database
router.get('/test-populate', async (req, res) => {
	// 1266041589455077381,1266017512162037761,1266014911127306240,1266000762057953284,1265985660898459655,1265093997439127555,1265087214440022019,1265084807253495809,1265119646761377792,1265089181040218112,1265603191749726209,1265626333348069376,1260745443497201665,1260550553647620096,1262705381953978368,1263974499814387712,1265980172739719170,1090574938119884800,1265606608211660801,1265844947653197824,1265637169839910912,1265978466039746560,1264594182053728256,1265235589475024896,1265976095209373696
	// These values are rounded by JS when no strings!!
	let batchIds = ['1266112327830712320','1266109050422468609','1266106020205662212','1266104188112601089','1266047584038256640']

	var p = batchIds.map(id => {
		return TweetScrape.findOneAndUpdate({ idTw: id }, {
			idTw: String(id)
		}, { upsert: true, new: true });
	});
	let tweets = await Promise.all(p);
	res.send(tweets);
});



// Testing: Find which id is not in db
router.get('/test-missing', async (req, res) => {
	const ids = ['1266731291917062145','1266737385120960515','1266760009872007171','1266749829826465792','1266740073283964930','1266749685240418310','1250527906654232576','1266743482158383110','1266742379794632704','1266741095561650176','1266740441401176064','1266740439740284928','1266740438641278977','1266740437542416387','1266740436485443584','1266740263801806850','1266740179844415497','1266740073283964930','1266739986885423104','923590293139742721','505008947817095169','447765956090417152','447765066101055489','447764889923100673','447764724076535810','434326263725977601','433630670582067200'];
	var p = ids.map(async (id, i) => {
		var tw = TweetScrape.findOne({ idTw: id });
		if (tw) { return tw; } else { return 'missing: ' + id };
	})
	const result = await Promise.all(p);
	console.log(result)
	res.send(result)

	// var str = '#' + i + ': ';
	// 	if (!tw) str += '- - - - - MISSING: ' + id;
	// 	if (tw) str += id;
	// 	console.log(id)
});


module.exports = router;