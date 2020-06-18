const express = require('express');
const router = express.Router();
const got = require('got');
const prettyJson = require('pretty-print-json');

// Models
const { Tweet, TweetScrape } = require('../models/tweet');
const Tta = require('../models/tta'); // Trump Twitter Archive

// Functions
const { extract, twAuth, extractSimple, inspect } = require('../scraper/extract');
const { extractLatest, fillMissing } = require('../scraper/scrape-latest');
const cli = require('../helpers/cli-monitor');
const { padNr, timeout } = require('../helpers/general');





// Simple-scrape new Trump tweet immediately
// - - -
// Will perform a "simpleScrape" to fetch text & date,
// until we do a periodic scrapeLatest to get full data.
router.post('/new-trump-tweet', async (req, res) => {
	const idTw = req.body.tweet.match(/\d+$/)[0];
	const user = req.body.user;
	
	// Ignore tweets already scraped
	const exists = !!await Tweet.countDocuments({ idTw: idTw });
	if (exists) return res.send(`Tweet ${idTw} has previously been scraped.`);

	// Extract & save
	const tweet = await extractSimple(idTw, user);
	console.log('New tweet coming in!', tweet)
	if (tweet) await Tweet.create(tweet);

	res.send(tweet);
});


// Extract latest simple-scraped tweets in the main table
// - - -
// Loops through "simpleScraped" tweets and extracts full data
router.post('/extract-latest/:state', async (req, res) => {
	if (+req.params.state) {
		extractLatest();
		res.send('Live scraping in progress, check console.');
	} else {
		// Abort
		extractLatest('abort');
		res.send('Live scraping aborted.');
	}
});


// Fill in missing tweets
// - - -
// 1. Loops through latest ~1300 tweet ids
// 2. Finds the one that are missing, fetches their data
// 3. Stores missing tweets in main Tweet table
router.post('/fill-missing/:state', async (req, res) => {
	if (+req.params.state) {
		fillMissing();
		res.send('Filling in in progress, check console.');
	} else {
		// Abort
		fillMissing('abort');
		res.send('Filling in aborted.');
	}
});


// Inspect tweet
// 1268023370425274368 --> Deleted tweet
// 1266740439740284928 --> Thread
// 1268006529678049281 --> Regular tweet
router.get('/inspect/:id', async (req, res) => {
	await twAuth.refresh();
	const tweet = await inspect(req.params.id);
	return res.send(tweet);
	const html = '<pre>' + prettyJson.toHtml(tweet, { indent: 3 }) + '</pre>';
	res.send(html);
});
router.get('/inspect/:id/:type', async (req, res) => {
	await twAuth.refresh();
	// Type can be original / parsed / extracted
	const tweet = await inspect(req.params.id, req.params.type);
	return res.send(tweet);
	const html = '<pre>' + prettyJson.toHtml(tweet, { indent: 3 }) + '</pre>';
	res.send(html);
});





























// Get new tweet using GOT
router.post('/new-tweet/:idTw', async (req, res) => {
	const idTw = req.params.idTw;

	// Make sure it's not a duplicate
	const exists = !!await Tweet.countDocuments({ idTw: idTw });
	if (exists) return res.send(`Tweet ${idTw} has previously been scraped.`);

	// Extract & save
	const tweet = await extract(idTw);
	console.log('New tweet coming in!', tweet.text)
	if (tweet) await Tweet.create(tweet);

	res.send(tweet);
});



// Testing: inspect payload
router.get('/test-payload/:id/:render', async (req, res) => {
	// eg. 1266741095561650176
	let payload = await got(`https://twitter.com/_/status/${req.params.id}`, {
		headers: {
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)'
		}
	});
	
	payload = req.params.render == 'true' ? payload.body : { body: payload.body };

	res.send(payload)
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
		user: 'themoenen',
		date: '2020-05-30T14:47:30.000Z',
		isRT: false,
		text: '@the_forty_fifth @charlytesta comment on comment 1',
		url: 'https://twitter.com/themoenen/status/1266743039982215172'
	}];
	  
	var result = await TweetScrape.create(docs);


	res.send(result);
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