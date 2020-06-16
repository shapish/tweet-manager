const express = require('express');
const router = express.Router();
const got = require('got');
const prettyJson = require('pretty-print-json');

// Models
const { Tweet, TweetScrape } = require('../models/tweet');
const ScrapeControl = require('../models/scrape-control'); // Storing of options and status
const Tta = require('../models/tta'); // Trump Twitter Archive

// Functions
const { gatherAndStore, extractData, openBrowser } = require('../scraper/control');  // Control functions
const { extract, twAuth, extractSimple, inspect } = require('../scraper/extract');
const { scrapeLatest } = require('../scraper/scrape');
const cli = require('../helpers/cli-monitor');
const { padNr, timeout } = require('../helpers/general');







/**
 * Live Scraping
 */

// Live scrape latest tweets directly into the main table
// --> Loop through scraped ids and extract tweet data
router.post('/scrape-live/:state', async (req, res) => {
	if (+req.params.state) {
		scrapeLatest();
		res.send('Live scraping in progress, check console.');
	} else {
		// Abort
		scrapeLatest('abort');
		res.send('Live scraping aborted.');
	}
});

























// Inspect tweet data
// 1268023370425274368 // Deleted tweet
// 1266740439740284928 // Thread
// 1268006529678049281
router.get('/tweet/:id', async (req, res) => {
	twAuth.refresh();
	const tweet = await extract(req.params.id);
	// console.log(tweet)
	// console.log(JSON.stringify(tweet, null, '\t'))
	const html = prettyJson.toHtml(tweet, { indent: 3 });
	// console.log(html)
	// res.send(html);
	res.send(req.params.id + ' / ' + twAuth.rateLimitRemains + '<br><br><br><pre>' + html + '</pre>');
	// res.send('<pre>' + JSON.stringify(tweet, null, '\t') + '</pre>');
});


// API: Toggle scraper
// --> Scrape ids from browser session
router.post('/gather/:state', async (req, res) => {
	let state = +req.params.state;
	if (state) {
		cli.banner('Start Gathering');

		// Load controller
		const ctrl = await ScrapeControl.findOne({ name: 'scrape-control' });
		if (!ctrl) {
			const errorMsg = 'ABORTED – Initialize Scrape Controller first';
			cli.title('++' + errorMsg.red + '++');
			return res.send(errorMsg)
		}

		let { url, user } = ctrl;
		if (!url) url = 'https://twitter.com/' + user;

		// Start scraping
		gatherAndStore(url);
	}

	// Update central controller status
	const ctrl = await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
		gathering: state
	}, { new: true });
	res.send(ctrl);
});



// Get new tweet using GOT
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



// Inspect tweet
router.get('/inspect/:id', async (req, res) => {
	const tweet = await inspect(req.params.id);
	res.send(tweet);
});
router.get('/inspect/:id/:type', async (req, res) => {
	// Type can be original / parsed / extracted
	const tweet = await inspect(req.params.id, req.params.type);
	res.send(tweet);
});



// Initialize scraper
// --> Create control center in database with any user name
router.get('/init/:user', async (req, res) => {
	let ctrl = await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
		name: 'scrape-control',
		seeding: false,
		extracting: false,
		liveScraping: false,
		url: null,
		user: req.params.user,
		pagesDone: 0,
		total: 0
	}, { upsert: true, new: true});

	try {
		// Delete other scraped tweets
		await TweetScrape.collection.drop();
		console.log('Deleted TweetScrape collection.')
	} catch {
		console.log('TweetScrape collection was already empty.')
	}
	

	res.send(ctrl);
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



// Testing: Open browser
router.get('/open-browser', async (req, res) => {
	openBrowser();
	res.send('Chromium should open.')
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