// Modules
const got = require('got');

// Models
const { Tweet } = require('../models/tweet');

// Functions
const cli = require('../helpers/cli-monitor');
const { extract, twAuth } = require('./extract');
const { getTime, padNr, timeout } = require('../helpers/general');
const sc = new (require('./scrape-control'))();


/**
 * Srape latest tweets
 */
async function scrapeLatest(options) {
	// No options = turn off
	if (options == 'abort') {
		await sc.unset('liveScraping');
		return;
	} else {
		await sc.set('liveScraping');
	}
	
	let i = 0;
	let tweets;
	
	const query = {
		deleted: false,
		ogData: null,
		date: { $gt: new Date('2020-05-28') } // For testing
		// date: { $gt: new Date('2020-06-01') } // For testing
	}
	
	// Display START banner
	const total = await Tweet.countDocuments(query);
	tweets = await Tweet.find(query);
	cli.banner(`Start Live Extracting ${total} tweets`);
	// console.log(tweets);

	// Start scraping
	await _cycle();
	


	async function _cycle() {
		fullTweet = await extract(tweets[i].idTw);
		if (fullTweet.text) {
			// console.log(fullTweet)
			console.log('#'+(i+1), fullTweet.idTw, fullTweet.text.replace('\n', '').slice(0.30), '\n\n');
		} else {
			// Tweet is deleted
			console.log('DELETED: ', fullTweet)
		}
		tweets[i] = fullTweet;
		await Tweet.findOneAndUpdate({
			idTw: tweets[i].idTw
		}, tweets[i]);
		if (i < tweets.length - 1) {
			const { liveScraping } = await ScrapeControl.findOne({ name: 'scrape-control' });
			if (liveScraping) {
				i++;
				await _cycle();
			} else {
				cli.title(`++Live Scraping Aborted++`);
			}
		} else {
			cli.title(`++Live Scraping Completed++`);
		}
	}
}

module.exports = { scrapeLatest };