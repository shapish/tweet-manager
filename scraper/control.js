// Modules
const puppeteer = require('puppeteer');

// Models
const TweetScrape = require('../models/tweet-scrape');
const ScrapeControl = require('../models/scrape-control');

// Functions
const gather = require('./gather');
const extract = require('./extract');
const { timeout } = require('../helpers/general');
const cli = require('../helpers/cli-monitor');




/**
 * Gather & store ids
 * 
 * Uses puppeteer to scrape tweet from a spoofed IE6 UI,
 * until bottom is reached or scraper is turned off.
 * Stores twitter ids in database per batch.
 * 
 * @param {string} url Leave empty (used for loop)
 * @param {number} batchSize How many tweets to scrape before storing them
 */
async function gatherAndStore(url, batchSize) {
	if (!url) return console.error('Abort: no scrape url provided.');
	batchSize = batchSize ? batchSize : 10;

	// Scrape control keeps track of progress & allows to pause/resume
	let { p, total } = await ScrapeControl.findOne({ name: 'scrape-control' }).select('p total');

	// No-sandbox required for Heroku: https://bit.ly/36UH3qE
	const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

	// Scrape first batch, loop until turned off
	await _gatherLoop(url);
	
	async function _gatherLoop(url) {
		let batchIds = [];
		
		await gather({
			browser: browser,
			url: url,
			batchSize: batchSize,
			p: p
		}, async (ids, nextUrl, p) => {
			// Callback called for each page
			batchIds.push(...ids);
			cli.log(`Adding ${ids.length} tweets to batch`, 2);
			url = nextUrl;
			p = p;
		});

		cli.log(`p: ${p}`, 1);

		// Remove duplicates (not needed but more accurate counting)
		const dups = batchIds.filter((item, index) => batchIds.indexOf(item) != index);
		dups.forEach((dup, i) => batchIds.splice(batchIds.indexOf(dup), 1))

		// Update total
		total += (batchIds.length - dups.length);
		
		// Monitor
		cli.log(`Store in database: ${batchIds.length} --> Total: ${total}`);
		cli.log(batchIds.join(',').green);
		cli.log(`${batchIds[0]} --> ${batchIds[batchIds.length - 1]} - ${url}`, 2);

		// Store ids in database
		const promise = batchIds.map(id => {
			return TweetScrape.findOneAndUpdate({ idTw: id }, {
				idTw: id
			}, { upsert: true, new: true });
		});
		let tweets = await Promise.all(promise);
		cli.log(`tweets.length: ${tweets.length}`, 2);

		// Store next page URL & check if we should continue
		await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
			url: url,
			p: p,
			total: total
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
	let batchNr = 1;
	let processed = 0;
	
	_extractLoop();
		
	// Loop through all empty tweets in batches of (10)
	// and store all tweet data in database
	async function _extractLoop(batchSize) {
		batchSize = batchSize ? batchSize : 5;

		// Find empty tweets
		let tweets = await TweetScrape.find({
			text: { $exists: false },
			deleted: false
		}).limit(batchSize).lean();

		if (!tweets.length) {
			return cli.title('Nothing left to be extracted')
		} else {
			cli.title(`Batch #${batchNr}`);
			cli.log(`Extracting ${batchSize} tweets`);
		}
		
		// Extract data
		let ids = []; // For console
		if (false) {
			// FAST
			tweets = tweets.map(async tweet => {
				ids.push(tweet.idTw);
				return extractOne(tweet.idTw, ctrl);
			});
			tweets = await Promise.all(tweets);
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
		
		// Update database
		tweets = tweets.map(async tweet => {
			return TweetScrape.findOneAndUpdate({ idTw: tweet.idTw }, tweet);
		});
		tweets = await Promise.all(tweets);
		
		processed += tweets.length;
		batchNr++;

		cli.wait(false);
		// cli.log(ids.join(',').green);
		cli.log(`Done --> Total: ${processed}`, 1);

		// Continue loop if more tweets are left and process is still on
		if (tweets.length == batchSize) {
			// Twitter API rate limit is 1 tweet/second: https://bit.ly/3cujRk4
			// Not correct, more like 20 a minute
			await timeout(3000 * batchSize)

			const { extracting } = await ScrapeControl.findOne({ name: 'scrape-control' });
			if (extracting) _extractLoop(batchSize);
		} else {
			// Turn off process when done
			await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
				extracting: false
			});
			cli.banner('Extracting Finished', -1);
		}
	}
}


// Extract single tweet
async function extractOne(idTw, ctrl) {
	data = await extract(idTw);

	// Extraction failed
	if (data.errors) {
		if (data.errors[0].code == 34 || data.errors[0].code === 0) {
			// Tweet is deleted (0 is custom error in extract.js)
			cli.log(` › Deleted: ${idTw}`.magenta);
			return { idTw: idTw, deleted: true }
		} else {
			// Other errors: https://bit.ly/304zWuo (1 is custom error in extract.js)
			cli.log(` › Error: ${data.errors[0].code} for ${idTw}: ${data.errors[0].message}`.red);
			if (data.errors[0].code) console.log('\n\nTaking 8m break.\n\n'); await timeout(480000); // Pause when rate limit is exceeded;
			// if (data.errors[0].code) return 'pause';
			return { idTw: idTw }
		}
	}
	
	record = {
		idTw: data.id_str,
		text: data.full_text,
		author: data.user.screen_name,
		date: data.created_at,
		isRT: (data.user.screen_name != ctrl.account),
		location: data.place ? {
			name: data.place.name,
			id: data.place.id
		} : null,
		tagsTw: data.tags,
		mentions: data.mentions,
		internalLinks: data.links ? data.links.internal : null,
		externalLinks: data.links ? data.links.external : null,
		replyTo: data.in_reply_to_status_id_str ? data.in_reply_to_status_id_str : null,
		extra: {
			likes: data.favorite_count,
			replies: data.reply_count,
			retweets: data.retweet_count,
			quotes: data.quote_count
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