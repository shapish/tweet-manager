// Modules
const puppeteer = require('puppeteer');

// Models
const TweetScrape = require('../models/tweet-scrape');
const Tweet = require('../models/tweet');
const Tta = require('../models/tta');
const ScrapeControl = require('../models/scrape-control');

// Functions
const gather = require('./gather');
const { extract } = require('./extract');
const { timeout, getTime } = require('../helpers/general');
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
	batchSize = batchSize ? batchSize : 5;
	let batchNr = 0;

	// Scrape control keeps track of progress & allows to pause/resume
	let { pagesDone, total } = await ScrapeControl.findOne({ name: 'scrape-control' }).select('pagesDone total');
	let page = pagesDone + 1;
	cli.title(`Starting at p: ${page} – Tweets scraped: ${total}`, 0, 3)

	// No-sandbox required for Heroku: https://bit.ly/36UH3qE
	const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

	// Scrape first batch, loop until turned off
	await _gatherLoop(url);
	
	async function _gatherLoop(url) {
		let batchIds = [];
		
		// Loop through one batch of pages
		// and store all ids in array
		await gather({
			browser: browser,
			url: url,
			batchSize: batchSize,
			page: page
		}, async (ids, nextUrl, p) => {
			// Callback called for each page
			batchIds.push(...ids);
			url = nextUrl;
			// cli.log(`Returning p:${page}`.green)
			page = p;
		});

		// Remove duplicates within our results (not needed but more accurate counting)
		const dups = batchIds.filter((item, index) => batchIds.indexOf(item) != index);
		dups.forEach((dup, i) => batchIds.splice(batchIds.indexOf(dup), 1))

		// Remove ids that already have been scraped
		let existing = batchIds.map(async (id, i) => {
			return Tweet.countDocuments({ idTw: id });
		});
		existing = await Promise.all(existing);
		const newBatchIds = [];
		const removedIds = []; // Store for logging
		existing.forEach((exists, i) => {
			if (exists) {
				removedIds.push(batchIds[i]);
			} else {
				newBatchIds.push(batchIds[i]);
			}
		});

		batchNr++;
		cli.title(`Processing batch #${batchNr}: ${newBatchIds.length}/${batchIds.length} new tweets.`);
		batchIds = newBatchIds;

		// Update total
		total += batchIds.length;

		// If no new tweets are scraped, end the process.
		if (!batchIds.length) return cli.banner('Scrapes up to date');

		// Monitor
		cli.log(`Removed ${removedIds.length} already imported tweets: [${removedIds.join(',')}]`)
		cli.title(`Store in database: ${batchIds.length} --> Total: ${total}`, 0, 2);
		// cli.log(batchIds.join(',').green);
		// cli.log(`${batchIds[0]} --> ${batchIds[batchIds.length - 1]} - ${url}`, 2);

		// Store ids in database
		const promise2 = batchIds.map(id => {
			return TweetScrape.findOneAndUpdate({ idTw: id }, {
				idTw: id
			}, { upsert: true, new: true });
		});
		let tweets = await Promise.all(promise2);

		// Store next page URL & check if we should continue
		await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
			url: url,
			pagesDone: page, // Not working, needs debug
			total: total // Off with a few – not functional but sloppy
		});

		page++;

		// Batch repeats with delay until we reach bottom of profile
		if (url) {
			await timeout(5000);
			const { gathering } = await ScrapeControl.findOne({ name: 'scrape-control' });
			if (gathering) { _gatherLoop(url) } else { cli.title('Stopped', 2, 2) }
		}
	}
};



/**
 * Extract tweet data
 * Loops through twitter ids, attaches twitter data and stored in database
 */
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
			ogData: { $exists: false },
			deleted: { $ne: true } // False or null
		}).limit(batchSize).lean();

		if (!tweets.length) {
			return cli.title('Nothing left to be extracted')
		} else {
			cli.title(`Batch #${batchNr}`);
			cli.log(`Extracting ${batchSize} tweets`);
		}
		
		// Extract data
		let ids = []; // For console
		if (true) {
			// FAST
			tweets = tweets.map(async tweet => {
				ids.push(tweet.idTw);
				return extract(tweet.idTw, ctrl.user);
			});
			tweets = await Promise.all(tweets);
			let rateLimitReached = false
			tweets.forEach(tweet => {
				const errors = tweet.errors;
				delete tweet.errors;
				// if (errors) console.log(errors);
				if (errors && errors[0].code == 88) rateLimitReached = true;
			})
			// Pause when rate limit is exceeded
			if (rateLimitReached) {
				const time = getTime(false, true);
				console.log(`\n\nTaking 5 min break (${time}).\n\n`);
				await timeout(300000);
			}
		} else {
			// SLOW for debugging
			// A while loop lets us monitor what's happening chronologically
			let extractedTweets = [];
			let i = 0;
			while (i < tweets.length) {
				ids.push(tweets[i].idTw);
				const extractedTweet = await extract(tweets[i].idTw, ctrl.user);
				const errors = extractedTweet.errors;
				delete extractedTweet.errors;
				extractedTweets.push(extractedTweet);
				// Pause when rate limit is exceeded;
				if (errors && errors[0].code == 88) {
					const time = getTime(false, true);
					console.log(`\n\nTaking 5 min break (${time}).\n\n`);
					await timeout(300000);
				}
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
		const time = getTime(false, true);
		cli.log(`Done --> Total: ${processed} / ${time}`, 1);

		// Continue loop if more tweets are left and process is still on
		if (tweets.length == batchSize) {
			// Twitter API rate limit is 1 tweet/second: https://bit.ly/3cujRk4
			// Not correct, more like 20 a minute
			await timeout(3500 * batchSize)

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



/**
 * Fill in deleted tweets
 * When a tweet is deleted, we try retrieving its data from the Trump Twitter Archive
 */
async function fillInDeleted(tweet) {
	const tta = await Tta.findOne({
		id_str: tweet.idTw
	});
	if (tta) {
		tweet.text = tta.text;
		tweet.user = {
			name: 'Donald J. Trump',
			handle: 'realDonaldTrump',
		};
		tweet.date = tta.created_at;
		tweet.isRT = tta.is_retweet;
		tweet.url = 'https://twitter.com/realDonaldTrump/' + tweet.idTw;
		tweet.extra = {
			likes: tta.favorite_count,
			retweets: tta.retweet_count
		};
		tweet.source = tta.source;
	}
}



/**
 * When a tweet is a retweet, reprocess it
 * (This is initial scrape and can be deleted later, although the replace aspect should be kept)
 */
async function expandRetweet(tweet, refreshToken) {
	const newTweet = await extract(tweet.idTw, refreshToken);
	
	if (newTweet.deleted) {
		// Catch & fill deleted tweets
		// console.log('\n\n\nbefore: ', newTweet);
		await fillInDeleted(newTweet);
		// console.log('\n\n\nafter: ', newTweet);
		newTweet.isRT = true;

		// Remove RT text & save username
		const rtUserHandle = newTweet.text.match(/^RT @(\S+)\b: /)[1];
		newTweet.text = newTweet.text.replace(/^RT @\S+\b: /, '');
		if (!newTweet.rt) {
			newTweet.rt = { user: { handle: rtUserHandle } };
		}

		// Save
		await Tweet.findOneAndUpdate({
			idTw: tweet.idTw
		}, newTweet);
	} else {
		// Fully replace properly scraped tweets
		await Tweet.findOneAndDelete({
			idTw: tweet.idTw
		});
		await Tweet.create(newTweet);
	}
}



// Open browser for testing
async function openBrowser() {
	const browser = await puppeteer.launch({ headless: false });
	const page = await browser.newPage();
	await page.setUserAgent('Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)');
	await page.goto('https://twitter.com/realDonaldTrump');
}



module.exports = { gatherAndStore, extractData, fillInDeleted, expandRetweet, openBrowser }




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