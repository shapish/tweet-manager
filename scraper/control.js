const puppeteer = require('puppeteer');

// Models
const TweetScrape = require('../models/tweet-scrape');
const ScrapeControl = require('../models/scrape-control');

// Functions
const gather = require('./gather');
const extract = require('./extract');
const { timeout } = require('../functions/general');


// GATHER & SAVE IDS
// - - -
// Keeps on scraping in batches, until bottom is reached or scraper is turned off.
// Stores twitter ids in database per batch.
async function gatherAndStore(url, batchSize, p) {
	batchSize = batchSize ? batchSize : 20; // How many pages per batch
	p = p ? p : 1;

	url = url ? url : 'https://twitter.com/realDonaldTrump';
	const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
	// No-sandbox required for Heroku https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-on-heroku

	// Scrape one batch
	await _gatherLoop(url);
	
	
	async function _gatherLoop(url) {
		let batchIds = [];
		
		// Update batchIds per page
		await gather({
			browser: browser,
			url: url,
			batchSize: batchSize,
			p: p
		}, async (ids, nextUrl, p) => {
			batchIds.push(...ids);
			console.log('Add to batch: +', ids.length)
			url = nextUrl;
			p = p;
		});
		
		// Status monitor
		console.log('')
		console.log('Store in database: +' + batchIds.length)
		console.log(batchIds.join(','))
		console.log(batchIds[0], ' --> ', batchIds[batchIds.length - 1], url);
		console.log('')
		console.log('')

		// Save IDs to the database
		const promise = batchIds.map(id => {
			return TweetScrape.findOneAndUpdate({ idTw: id }, {
				idTw: id
			}, { upsert: true, new: true });
		});
		let tweets = await Promise.all(promise);
		console.log('tweets.length: ', tweets.length)
		console.log('')
		console.log('')

		// Save next page URL to database
		// + Check controls to see if we shoudl continue
		await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
			url: url,
			p: p
		});

		// Batch repeats with delay until we reach bottom of profile
		if (url) {
			await timeout(5000);
			const { gathering } = await ScrapeControl.findOne({ name: 'scrape-control' });
			if (gathering) _gatherLoop(url);
		}
	}
};


// EXTRACT TWEET DATA
// - - -
// Loops through twitter ids and attaches all twitter data
async function extractData() {
	const ctrl = await ScrapeControl.findOne({ name: 'scrape-control' });
	let processed = 0;
	
	_extractLoop();
		
	// Loop through all empty tweets in batches of (10)
	// and store all tweet data in database
	async function _extractLoop(batchSize) {
		batchSize = batchSize ? batchSize : 10;
		console.log('Batch extracting ' + batchSize + ' tweets...')

		// Find empty tweets
		let tweets = await TweetScrape.find({
			text: { $exists: false }
		}).limit(batchSize).lean();

		if (!tweets.length) {
			return console.log('- -Extracting Complete - -')
		}
		
		// Extract data
		let ids = []; // For console
		if (true) {
			// FAST
			tweets = tweets.map(async tweet => {
				ids.push(tweet.idTw);
				return extractOne(tweet.idTw, ctrl);
			});
		} else {
			// SLOW for debugging
			// A while loop lets us monitor what's happening chronologically
			let extractedTweets = [];
			let i = 0;
			while (i < tweets.length) {
				ids.push(tweets[i].idTw);
				const extractedTweet = await extractOne(tweets[i].idTw, ctrl);
				extractedTweets.push(extractedTweet);
				i++;
			}
			tweets = extractedTweets;
		}
		
		// console.log('Ids: ' + ids.join(','));
		tweets = await Promise.all(tweets);
		
		// Save to db
		tweets = tweets.map(async tweet => {
			return TweetScrape.findOneAndUpdate({ idTw: tweet.idTw }, tweet);
		});
		tweets = await Promise.all(tweets);

		processed += tweets.length;

		console.log(`Batch saved to database – Total: ${processed}`);
		console.log('');

		// Continue loop if more tweets are left and process is still on
		if (tweets.length == batchSize) {
			console.log('-- Next batch --');
			const { extracting } = await ScrapeControl.findOne({ name: 'scrape-control' });
			if (extracting) _extractLoop(batchSize);
		} else {
			// Turn off process
			await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
				extracting: false
			});
			console.log('- - - - - - - - - - - - - - - - -');
			console.log('- - - -Extracting Finished- - - -');
			console.log('- - - - - - - - - - - - - - - - -');
			console.log('');
		}
	}
}


// Extract single tweet
async function extractOne(idTw, ctrl) {
	data = await extract(idTw);

	if (!data) {
		// Tweet is most likely deleted,
		// although this sometimes happend
		// when Twitter fails to properly load
		console.log('#### Missing record: ' + idTw)
		return {
			idTw: idTw,
		};
	}

	record = {
		idTw: data.id,
		text: data.text,
		author: data.user,
		date: data.timestamp,
		isRT: (data.user != ctrl.account),
		url: `https://twitter.com/${data.user}/status/${data.id}`,
		location: {
			name: data.location,
			id: data.locationId
		},
		tagsTw: data.tags,
		mentions: data.mentions,
		internalLinks: data.links.internal,
		externalLinks: data.links.external,
		thread: data.thread,
		extra: {
			likes: data.likes,
			replies: data.replies,
			retweets: data.retweets,
			poll: data.poll
		}
	}
	return record;
}




// Open browser for testing
async function openBrowser() {
	const browser = await puppeteer.launch({ headless: false });
	const page = await browser.newPage();
	await page.setUserAgent('Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)');
	await page.goto('https://twitter.com/realDonaldTrump');
}






module.exports = { gatherAndStore, extractData, openBrowser }




// // Login test
// async function login() {
// 	const browser = await puppeteer.launch({headless: false});
// 	const page = await browser.newPage();
// 	await page.setUserAgent('Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)');
// 	await page.setViewport({width: 1200, height: 720});
// 	await page.goto('https://mobile.twitter.com/session/new', { waitUntil: 'networkidle0' }); // wait until page load
// 	await page.type('input[type=text]', 'moenen@shapish.com');
// 	await page.type('input[type=password]', 'tweetpUrg3#');
// 	await Promise.all([
// 		page.click('input[type=submit]:not(#promo_close)'),
// 		page.waitForNavigation({ waitUntil: 'networkidle0' })
// 	]);
// 	await page.goto('https://twitter.com/realDonaldTrump', { waitUntil: 'networkidle0' }); // wait until page load
// }
// // login();