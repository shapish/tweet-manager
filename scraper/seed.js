// Modules
const got = require('got');
// const StreamArray = require( 'stream-json/streamers/StreamArray');
// const { Writable } = require('stream');

// Models
const { Tweet, TweetScrape } = require('../models/tweet');
const Tta = require('../models/tta');

// Functions
const cli = require('../helpers/cli-monitor');
const { extract, twAuth } = require('./extract');
const { getTime, padNr, timeout } = require('../helpers/general');
const sc = new (require('./scrape-control'))();
// const { prettyNr } = require('../helpers/general-global');


// For testing
// (async function s() {
// 	twAuth.refresh();
// 	var tw = await extract('1266740439740284928');
// 	console.log(tw);
// })();


/**
 * Step 1: Drop scrape collection & seed it with tweet ids from json
 * @param {options} options See above
 */
async function seed(options) {
	// No options = turn off
	if (options == 'abort') {
		await sc.unset('seeding');
		return;
	} else {
		await sc.set('seeding');
	}

	const p = +options.p || 1;
	let done = +options.done || 0;
	const collectionName = options.collection;
	const collection = eval(options.collection);
	const filename = options.filename;
	const idsOnly = options.idsOnly;
	const url = options.url;

	const pageSize = 5000; // Number of items per page
	const batchSize = 100; // Number of items per batch
	const seedData = require('../data/' + filename);
	const pageSlice = seedData.slice((p - 1) * pageSize, p * pageSize); // This page's docs
	const totalPages = Math.ceil(seedData.length / pageSize);

	// Organize this page's docs in batches
	const batches = [];
	for (let i=0; i<pageSlice.length; i++) {
		if (i % batchSize === 0) {
			batches.push([pageSlice[i]])
		} else {
			batches[batches.length - 1].push(pageSlice[i]);
		}
	}

	// Log start
	if (p == 1) cli.banner(`Seeding ${seedData.length} Documents`);
	
	// Maybe delete previous data
	if (options.drop && await collection.countDocuments()) {
		cli.log(`Dropping ${collectionName} collection`.red);
		await collection.deleteMany({});
		// collection.collection.drop(); // This removes indices, which need to be rebuilt each time
	}
	
	// Log page
	cli.title(`+++Processing p${p} – ${pageSlice.length} docs+`);

	// Loop through batches of this page
	let j = 0;
	while (batches[j] && sc.is('seeding')) {
		await _seedOneBatch(j);
		j++;
	}
	
	// Repeat
	if (p == totalPages) {
		// Done
		await sc.unset('seeding');
		cli.banner(`Seeding Complete+++++`);
	} else {
		if (sc.is('seeding')) {
			// Load next page
			const nextUrl = `${url}?ids_only=${idsOnly}&p=${p+1}&done=${done}`;
			// cli.log(`+- Next page: ${url} -+`);
			await got.post(nextUrl);
		} else {
			// Seeding aborted
			cli.banner('Seeding Aborted+++++');
		}
	}

	///////

	async function _seedOneBatch(j) {
		// When seeding external data, only store id
		// (Trump Twitter Archive)
		if (idsOnly) {
			batches[j] = batches[j].map(tw => {
				return { idTw: tw.id_str }
			});
		}
		
		try {
			await collection.create(batches[j]);
			done += batches[j].length;
			console.log(`p${p} - batch #${padNr(j+1)} +`, batches[j].length, '=>', done);
		}
		catch {
			console.log(`p${p} - batch #${padNr(j+1)} +`, batches[j].length, '=> ERROR (probably duplicates)');
		}
	}
}


/**
 * Step 2: Turn collection of tweet ids into full tweets
 * Fetch tweet data in batches from the Twitter API
 */
async function extractTweets(collection) {
	// No options = turn off
	if (collection == 'abort') {
		await sc.unset('extracting');
		return;
	} else {
		await sc.set('extracting');
	}


	collection = eval(collection);
	let batchNr = 1;
	const total = await collection.estimatedDocumentCount();
	let processed = await collection.countDocuments({ text: { $exists: true } });

	// Display START banner
	cli.banner('+++++Start Extracting_');
	cli.progress(processed, total);
	
	// Extract one batch
	_extractLoop(50);
		
	// Loop through all empty tweets in one batch
	// and store tweet data in database
	async function _extractLoop(batchSize) {

		// Get one batch of empty tweets
		let tweets = await collection.find({
			text: null,
			deleted: false
		}).limit(batchSize).lean();


		// Log progress
		let ids = [];
		if (!tweets.length) {
			return cli.title('Nothing left to be extracted'.red);
		} else {
			cli.title(`Batch #${batchNr}_`);
			cli.log(`Extracting ${batchSize} tweets`);
		}

		// Extract data
		tweets = await _extractBatch(tweets); // Fast
		// tweets = await _extractBatchOneByOne(tweets); // Slow for debugging

		// Update database & complete cycle
		tweets = tweets.map(async tweet => {
			return collection.findOneAndUpdate({ idTw: tweet.idTw }, tweet);
		});
		tweets = await Promise.all(tweets);
		processed += tweets.length;
		batchNr++;
		
		// Log progress
		const time = getTime(false, true);
		cli.log(`Done: ${processed} / ${total} at ${time}+`);

		// Next loop
		if (tweets.length == batchSize) {
			if (sc.is('extracting')) {
				_extractLoop(batchSize);
			} else {
				cli.progress(processed, total);
				cli.banner('Extracting Aborted+++++');
			}
		} else {
			// Turn off process when done
			sc.unset('extracting');
			cli.banner('Extracting Finished+++++');
		}

		// Fast extract
		async function _extractBatch(tweets) {
			await twAuth.refresh();
			tweets = tweets.map((tweet, i) => {
				ids.push(tweet.idTw);
				return extract(tweet.idTw, false);
			});
			tweets = await Promise.all(tweets);

			// Fetch deleted tweets
			let deleted = [];
			tweets.forEach(tweet => {
				const errors = tweet.errors;
				delete tweet.errors;
				if (tweet.deleted) {
					deleted.push(_fetchDeletedTweet(tweet));
				}
			});
			if (deleted.length) {
				await Promise.all(deleted);
			}

			return tweets;
		}

		// Slow extract for debugging
		// (while loop goes chronologically)
		async function _extractBatchOneByOne(tweets) {
			await twAuth.refresh();
			let extractedTweets = [];
			let i = 0;
			while (i < tweets.length) {
				ids.push(tweets[i].idTw);
				const extractedTweet = await extract(tweets[i].idTw, false);
				const errors = extractedTweet.errors;
				delete extractedTweet.errors;
				if (errors && errors[0].code == 1) {
					extractedTweet = await _fetchDeletedTweet(tweet);
				}
				extractedTweets.push(extractedTweet);
				i++;
			}
			return extractedTweets;
		}
	}
}


/**
 * When a tweet is deleted, fetch its data
 * from the Trump Twitter Archive
 * @param {Object} Tweet tweet object with idTw
 */
async function _fetchDeletedTweet(tweet) {
	if (tweet.text) return console.log('Fetching deleted tweet but it has text... aborted.')
	const id = tweet.idTw;

	const tta = await Tta.findOne({ id_str: id });
	if (tta) {
		tweet.text = tta.text;
		tweet.user = {
			name: 'Donald J. Trump',
			handle: 'realDonaldTrump',
		};
		tweet.date = tta.created_at;
		tweet.isRT = tta.is_retweet;
		tweet.url = 'https://twitter.com/realDonaldTrump/' + id;
		tweet.extra = {
			likes: tta.favorite_count,
			retweets: tta.retweet_count
		};
		tweet.source = tta.source;
		tweet.deleted = true;
	} else {
		console.log('Failed to fetch deleted Tweet #' + id);
	}

	return tweet;
}


/**
 * Step 3: transfer finished data from scrape collection to main
 */
async function transferData(options) {
	// No options = turn off
	if (options == 'abort') {
		await sc.unset('transferring');
		return;
	} else {
		await sc.set('transferring');
	}

	const batchSize = 500;
	let batch = 0;
	let count = 0;
	const total = await TweetScrape.count({ text: { $exists: true } });

	// Log start
	cli.banner(`+++++Transferring ${total} tweets`);

	// Maybe delete previous data
	if (options.drop && await Tweet.countDocuments()) {
		cli.log(`Dropping Tweet collection`.red);
		await Tweet.deleteMany({});
		// Tweet.collection.drop(); // This removes indices, which need to be rebuilt each time
	}

	// Transfer
	await _transferCycle();

	// Complete
	cli.banner('Transfer Complete+++++');
	await sc.unset('transferring');

	// Transfer one batch
	async function _transferCycle() {
		cli.title(`Batch #${batch}_`);
		const tweets = await TweetScrape.find({ text: { $exists: true } })
			.skip(batch * batchSize)
			.limit(batchSize)
			.select('-_id -__v')
			.lean();
		await Tweet.create(tweets);
		const thisBatchSize = Math.min(batchSize, tweets.length);
		count += thisBatchSize;
		batch++;
		cli.log(`Done: +${thisBatchSize} => ${count}`);

		// Keep on looping until end is reached
		if ((batch * batchSize) < total) {
			await _transferCycle();
		}
	}
}


module.exports = { seed, extractTweets, transferData };