// Modules
const got = require('got');
const moment = require('moment');

// Helpers
const cli = require('../helpers/cli-monitor');
const { timeout, writeToFile, queryString, padNr } = require('../helpers/general')
const twAuth = new (require('./tw-auth'))(); // Twitter authentication
const scrapeControl = new (require('./scrape-control'))();
const getUserData = require('./get-user-data');


/**
 * Scrapes someone's twitter profile (ids only) directly from the
 * Twitter API, however Twitter only serves up to about ~1300 tweets
 * @param {String} userHandle Twitter handle to scrape
 * @param {Function} cb Callback that will send the results back per batch (page)
 * @param {Object} options Options logToConsole & logToFile
 */
async function gather(userHandle, cb, options) {
	// No options = turn off
	if (userHandle == 'abort' && !cb && !options) {
		await scrapeControl.set('gathering', false);
		return;
	} else {
		await scrapeControl.set('gathering', true);
	}
	
	// Options
	const logToConsole = options && options.logToConsole ? options.logToConsole : true;
	const logToFile = options ? options.logToFile : false;
	const logFileName = logToFile ? `id-scrape-log-${moment().format('YYYY-MM-DD--HH-mm')}` : '';
	const batchSize = options && options.batchSize ? options.batchSize : 200;
	const max = options && options.max ? options.max : 3200; // 3200 is Twitter limit, don't go higher
	
	// Variables
	let attempt = 0; // Sometimes API returns blank, so we try a few time
	let batchNr = 1;
	let total = 0;
	
	// Log Start
	if (logToConsole) cli.banner('Gathering Ids started');

	// Scrape
	const allTweetIds = []; // To avoid duplicates
	await twAuth.refresh();
	await _scrapeOnePage();
	// latest: 1238794856614572033
	// almost latest: 1238799084263260161
	// late: 1240226752447873027

	// Done
	await scrapeControl.set('gathering', false);
	// if (logToConsole) cli.title(`Result: ${allTweetIds.length} tweets scraped:\n${allTweetIds.join(',')}`);
	if (logToConsole) cli.banner('Gathering Ids Complete+++++');




	// Scrape one page, then loop back for the next, until bottom is reached
	async function _scrapeOnePage(maxId, retry) {
		// Log
		if (!retry && logToConsole) cli.title(`Batch #${batchNr}_`);

		// Fetch tweets
		var response = await _fetchTweets(batchSize, maxId);
		_maybeRefreshToken(response);

		// Parse entire page of tweets & store as batch
		const { uniquePageTweets, headers } = _parseResponse(response);

		// Redo a few times when response is empty
		if (!response || (!uniquePageTweets.length
			&& headers['content-encoding'] == 'gzip' // correct responsed arrive as br
			&& total < max // Max number APi will serve
			&& attempt < 100))
		{
			attempt++;
			// Refresh token every 10 request to kick the API into submission
			if (attempt % 10 === 0) {
				await timeout(100 * attempt);
				await twAuth.refresh();
			}
			if (logToConsole) cli.log(`Retry #${attempt} - cl: ${headers['content-length']}`.cyan);
			return await _scrapeOnePage(maxId, true);
		} else {
			attempt = 0;
		}
		
		// Reduce to only ids
		const pageTweetIds = uniquePageTweets.map(tw => {
			return tw.id_str;
		});

		// Process batch
		await cb(pageTweetIds);
		if (logToFile) _logFile(uniquePageTweets);
		total += uniquePageTweets.length;
		
		// Scrape next page
		const prevMaxId = maxId;
		if (pageTweetIds.length) maxId = _getNextMaxId(pageTweetIds);
		if (logToConsole) cli.log(`Done: +${uniquePageTweets.length} = ${total}`);
		// if (logToConsole) console.log('max ids: ', prevMaxId + ' <--> ' + maxId + ' => ' + (maxId == prevMaxId ? 'stop' : 'continue'));
		
		if (maxId != prevMaxId) {
			if (await scrapeControl.get('gathering')) {
				batchNr++;
				// await timeout(3000);
				await _scrapeOnePage(maxId);
			} else {
				if (logToConsole) cli.banner('Gathering Ids Aborted+++++');
			}
		}
	}



	// Fetch tweets
	// Uses official Twitter API, limited to 30 days and 3500 tweets, but clean
	async function _fetchTweets(batchSize, maxId) {
		let params = {
			// Note: The Twitter rate limit is 186, but quoted tweets and repliesTo are being followed,
			// multiplying the amount of API requests up to 3 per tweet – hence limit this to 50 tweets/page.
			screen_name: userHandle,
			count: batchSize,
			max_id: maxId
		}
		params = queryString(params);
		const url = `https://api.twitter.com/1.1/statuses/user_timeline.json?${params}`;
		let response;
		try {
			response = await got(url, {
				method: 'GET',
				headers: twAuth.getHeaders(),
				retry: 0 // Only way to eliminate ugly console errors
			});
		} catch(error) {
			if (error.response && error.response.body) {
				const err = JSON.parse(error.response.body).errors[0];
				cli.log(` › Batch #${batchNr} Error #${err.code}: ${err.message} – ${url} (gather.js)`.red);
				return error.response.body;
			} else {
				cli.log(`(gather.js:) ${error}`.red);
				return;
			}
		}
		return response;
	}

	// Parse response
	function _parseResponse(response) {
		if (!response.body) return false;
		const allPageTweets = JSON.parse(response.body);
		const uniquePageTweets = [];
		for (let i in allPageTweets) {
			const tw = allPageTweets[i];
			// Avoid duplicates
			if (!allTweetIds.includes(tw.id_str)) {
				uniquePageTweets.push(tw);
				allTweetIds.push(tw.id_str);
			} else {
				if (logToConsole) cli.log(`Duplicate: ${tw.id_str}`.red);
			}
		}

		return { uniquePageTweets, headers: response.headers };
	}

	// Log tweets to file
	function _logFile(tweets) {
		// Create a loggable format
		const log = tweets.map(tw => {
			let date = new Date(tw.created_at);
			date = moment(date).format('YYYY-MM-DD-HH-mm');
			return tw.id_str + ',' + date+ ',' + tw.text.replace(/\n/g, '').replace(/,/g, ''); // .slice(0, 50)
		});
		writeToFile(logFileName, log, { format: 'csv' });
	}

	// Refresh token when rate limit is reached
	async function _maybeRefreshToken(response) {
		if (!response.headers) return;
		const rateLimitRemains = response.headers['x-rate-limit-remaining'];
		if (rateLimitRemains <= 1) {
			if (logToConsole) cli.log('REFRESHING GUEST TOKEN - gather.js'.red);
			await twAuth.refresh();
		} else {
			// if (logToConsole) cli.log(` › ${rateLimitRemains}`.yellow);
		}
	}

	// From Twitter: https://bit.ly/3fAgNVB
	// Subtract 1 from the lowest Tweet ID returned from the previous request and
	// use this for the value of max_id. It does not matter if this adjusted max_id
	// is a valid Tweet ID, or if it corresponds with a Tweet posted by a different
	// user - the value is just used to decide which Tweets to filter.
	function _getNextMaxId(pageTweetIds) {
		const lastId = pageTweetIds[pageTweetIds.length - 1];
		let tip = +lastId.slice(-5);
		if (!tip) tip += 1; // In edge case it's all zeros
		return lastId.slice(0, -5) + padNr(tip - 1, 5);
	}
}

module.exports = { gather };

// gather('realDonaldTrump', tweets => { /* console.log('@', tweets) */ }, { logToFile: true });