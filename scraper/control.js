// Models
const { Tweet, TweetScrape } = require('../models/tweet');
const Tta = require('../models/tta');
const ScrapeControl = require('../models/scrape-control');

// Functions
const { gatherIds } = require('./gather');
const { extract } = require('./extract');
const { timeout, getTime } = require('../helpers/general');
const cli = require('../helpers/cli-monitor');

// gatherAndStore();
// newTwitterGuestToken();

// (async function() {
// 	var x = await Tweet.countDocuments({
// 		'$text': { '$search': '"Statue of Christopher"' },
// 		archived: true,
// 		deleted: true
// 	});
// 	console.log(x);
// })();


/**
 * Scrape latest ids and store the tweets if we don't have them yet
 */
async function gatherAndStore() {
	const userHandle = 'realDonaldTrump';

	// Start gathering, pages are processed per batch via callback
	const ids = await gatherIds(userHandle, _storeBatch);

	// Loop and store missing ids per batch
	async function _storeBatch(ids) {
		// await newTwitterGuestToken(); // Refresh token for each batch <-- REPLACE
		ids.forEach(async id => {
			const exists = await _exists(id);
			if (!exists) {
				const tweet = await extract(id, userHandle);
				console.log('%', tweet.idTw, ' - ', tweet.text.replace(/\n/g, '').slice(0,140));
				if (tweet.idTw != id) {
					// Expanded retweets get original tweet id assigned,
					// if this same tweet has been retweeted before, we
					// have to reset the id to the RT id.
					if (await _exists(tweet.idTw)) {
						tweet.idTw = id;
						cli.log(`Reset: ${tweet.idTw} => ${id}`);
					}
				}
				await Tweet.findOneAndUpdate({ idTw: id }, tweet, { upsert: true });
			} else {
				cli.log(`Exists: ${id} ${exists}`);
			}
		});
	};

	async function _exists(id) {
		const exists = await Tweet.countDocuments({ idTw: id }); 
		return !!exists;
	};
};



/**
 * Extract tweet data
 * Loops through twitter ids, attaches twitter data and stored in database
 */
// async function extractData() {
// 	// const ctrl = await ScrapeControl.findOne({ name: 'scrape-control' });
// 	let batchNr = 1;
// 	let processed = 0;
	
// 	_extractLoop(50);
		
// 	// Loop through all empty tweets in batches of (10)
// 	// and store all tweet data in database
// 	async function _extractLoop(batchSize) {

// 		// Find empty tweets
// 		let tweets = await TweetScrape.find({
			
// 		}).limit(batchSize).lean();

// 		if (!tweets.length) {
// 			return cli.title('Nothing left to be extracted')
// 		} else {
// 			cli.title(`Batch #${batchNr}`);
// 			cli.log(`Extracting ${batchSize} tweets`);
// 		}
		
// 		// Extract data
// 		let ids = []; // For console
// 		if (true) {
// 			// FAST
// 			tweets = tweets.map(async (tweet, i) => {
// 				ids.push(tweet.idTw);
// 				const refreshToken = (i === 0);
// 				return extract(tweet.idTw, ctrl.user, refreshToken);
// 			});
// 			tweets = await Promise.all(tweets);
// 			let rateLimitReached = false
// 			tweets.forEach(tweet => {
// 				const errors = tweet.errors;
// 				delete tweet.errors;
// 				// if (errors) console.log(errors);
// 				if (errors && errors[0].code == 88) rateLimitReached = true;
// 			})
// 			// Pause when rate limit is exceeded
// 			if (rateLimitReached) {
// 				const time = getTime(false, true);
// 				console.log(`\n\nTaking 5 min break (${time}).\n\n`);
// 				await timeout(300000);
// 			}
// 		} else {
// 			// SLOW for debugging
// 			// A while loop lets us monitor what's happening chronologically
// 			let extractedTweets = [];
// 			let i = 0;
// 			while (i < tweets.length) {
// 				ids.push(tweets[i].idTw);
// 				const refreshToken = (i === 0);
// 				const extractedTweet = await extract(tweets[i].idTw, ctrl.user, refreshToken);
// 				const errors = extractedTweet.errors;
// 				delete extractedTweet.errors;
// 				extractedTweets.push(extractedTweet);
// 				// Pause when rate limit is exceeded;
// 				if (errors && errors[0].code == 88) {
// 					const time = getTime(false, true);
// 					console.log(`\n\nTaking 5 min break (${time}).\n\n`);
// 					await timeout(300000);
// 				}
// 				i++;
// 			}
// 			tweets = extractedTweets;
// 		}
		
// 		// Update database
// 		tweets = tweets.map(async tweet => {
// 			return TweetScrape.findOneAndUpdate({ idTw: tweet.idTw }, tweet);
// 		});
// 		tweets = await Promise.all(tweets);
		
// 		processed += tweets.length;
// 		batchNr++;

// 		cli.wait(false);
// 		// cli.log(ids.join(',').green);
// 		const time = getTime(false, true);
// 		cli.log(`Done --> Total: ${processed} / ${time}+`);

// 		// Continue loop if more tweets are left and process is still on
// 		if (tweets.length == batchSize) {
// 			// Twitter API rate limit is 1 tweet/second: https://bit.ly/3cujRk4
// 			// Web API rate is 180/15min = 1/5s
// 			// await timeout(5000 * batchSize)

// 			const { extracting } = await ScrapeControl.findOne({ name: 'scrape-control' });
// 			if (extracting) _extractLoop(batchSize);
// 		} else {
// 			// Turn off process when done
// 			await ScrapeControl.findOneAndUpdate({ name: 'scrape-control' }, {
// 				extracting: false
// 			});
// 			cli.banner('Extracting Finished');
// 		}
// 	}
// }
 

























































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



module.exports = { gatherAndStore, fillInDeleted, expandRetweet }