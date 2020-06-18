// Models
const { Tweet } = require('../models/tweet');

// Functions
const cli = require('../helpers/cli-monitor');
const { gather } = require('./gather');
const { gatherWebAPI } = require('./gather-web-api');
const { extract, twAuth } = require('./extract');
const { getTime, padNr, timeout } = require('../helpers/general');
const scrapeControl = new (require('./scrape-control'))();


/**
 * Scrape latest tweets
 * This will look for all tweets that are already in the database
 * but that are not fully scraped. This is because on the server
 * we can only "extractSimple" which only saves core tweet data.
 */
async function extractLatest(abort) {
	// No options = turn off
	if (abort == 'abort') {
		await scrapeControl.set('scrapingLatest', false);
		return;
	} else {
		await scrapeControl.set('scrapingLatest', true);
	}
	
	let i = 0;
	let tweets;
	const query = {
		deleted: false,
		ogData: null,
		date: { $gt: new Date('2020-05-28') } // For testing
		// date: { $gt: new Date('2020-06-01') } // For testing
	}
	
	// Log START
	const total = await Tweet.countDocuments(query);
	tweets = await Tweet.find(query);
	if (tweets.length) {
		cli.banner(`+++++Start Extracting ${total} Latest Tweets`);
	} else {
		await scrapeControl.set('scrapingLatest', false);
		return cli.title(`++No new tweets to be extracted++`);
	}

	// Start scraping, 1 tweet at a time
	await _cycle();
	


	async function _cycle() {
		// Extract tweet data
		fullTweet = await extract(tweets[i].idTw);

		// Log progress
		if (fullTweet.text) {
			cli.log(`#${i+1} ${fullTweet.idTw} ${fullTweet.text.replace('\n', '').slice(0.30)}+`);
		} else {
			// Tweet is deleted
			console.log('DELETED: ', fullTweet)
		}

		// Save tweet
		await Tweet.findOneAndUpdate({
			idTw: tweets[i].idTw
		}, fullTweet);

		// Next round
		if (i < tweets.length - 1) {
			if (scrapeControl.get('scrapingLatest')) {
				i++;
				await _cycle();
			} else {
				cli.banner('Live Extracting Aborted+++++');
				await scrapeControl.set('scrapingLatest', false);
			}
		} else {
			cli.banner('Live Extracting Complete+++++');
			await scrapeControl.set('scrapingLatest', false);
		}
	}
}

async function fillMissing(abort) {
	// No options = turn off
	if (abort == 'abort') {
		await scrapeControl.set('fillingMissing', false);
		await scrapeControl.set('gathering', false);
		return;
	} else {
		await scrapeControl.set('fillingMissing', true);
	}

	
	// Log start
	cli.banner('+++++Start Filling in Missing');

	// To display the "done" banner, we need to maker sure
	// that gathering process is done + all batches processed.
	// Once we display finsihed banner, we don't want to display
	// it a second time, hence finished
	let gatheringDone = false;
	const batchesInProgress = [];

	// Start gathering, pages are processed per batch via callback
	const userHandle = await scrapeControl.get('name');
	const ids = await gather('ra', _storeBatch, { logToConsole: false, batchSize: 50, max: 1000 });
	// const ids = await gatherWebAPI(userHandle, _storeBatch, { logToConsole: false });

	// This lets us log complete after the last batch if processed.
	gatheringDone = true;
	_maybeLogComplete('z');
	
	
	// Loop and store missing ids per batch
	async function _storeBatch(ids) {
		cli.log(`+++New batch with ${ids.length} tweet`);

		// Name & store this batch
		const batchName = new Date().getTime().toString(16);
		if (ids.length) {
			batchesInProgress.push(batchName);
		} else {
			_maybeLogComplete('r');
		}

		// Scrape missing tweets
		await twAuth.refresh();
		let processed = 0;
		ids.forEach(async (idTw, i) => {
			const exists = await _exists(idTw);
			if (!exists) {
				const tweet = await extract(idTw, userHandle);
				cli.log(`#${tweet.idTw} - ADDING - ${tweet.text.replace(/\n/g, '').slice(0,140)}`);
				await Tweet.findOneAndUpdate({ idTw: idTw }, tweet, { upsert: true });
			} else {
				const tweet = await Tweet.findOne({ idTw: idTw });
				cli.log(`#${tweet.idTw} - EXISTS - ${tweet.ogText.replace(/\n/g, '').slice(0,140)}`.gray);
			}

			// Log complete/abort banner when done
			processed++;
			if (i == ids.length - 1) batchesInProgress.splice(batchesInProgress.indexOf(batchName), 1);
			if (processed == ids.length) _maybeLogComplete('n');
		});
	};

	async function _maybeLogComplete(a) {
		// cli.log('_maybeLogComplete'.yellow);
		// console.log(a, gatheringDone, batchesInProgress.length);
		if (!gatheringDone || batchesInProgress.length) return;

		if (await scrapeControl.get('fillingMissing')) {
			cli.banner('Filling in Missing Complete+++++');
			scrapeControl.set('fillingMissing', false);
		} else {
			cli.banner('Filling in Missing Aborted+++++');
		}
	}

	// Verify tweet existence
	async function _exists(id) {
		const exists = await Tweet.countDocuments({ idTw: id }); 
		return !!exists;
	};
}

module.exports = { extractLatest, fillMissing };