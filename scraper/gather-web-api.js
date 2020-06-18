// Modules
const got = require('got');
const moment = require('moment');

// Helpers
const cli = require('../helpers/cli-monitor');
const { timeout, writeToFile, queryString, getDate, getTime } = require('../helpers/general')
const twAuth = new (require('./tw-auth'))(); // Twitter authentication
const scrapeControl = new (require('./scrape-control'))();
const getUserData = require('./get-user-data');





/**
 * Same as gather.js but this is using the Twitter web API
 * (api.twitter.com/2/timeline/profile/<userid>.json – which serves
 * data for a user's web profile) instead of the dedicated user 
 * profile API (api.twitter.com/1.1/statuses/user_timeline.json).
 * It only serves up to ~1300 tweets (instead of 3200) and includes
 * tweeted and quoted tweets twice (RT id + original id) BUT it's
 * very reliable whereas the user_timeline api is very flaky,
 * forcing you to multiple tries before getting all the data.
 * Here, you simply need to remove duplicates. Not using it but
 * keeping it for reference. It can also easily be adjusted to scrape search results.
 * - - -
 * Currently not used
 * @param {String} userHandle Twitter handle to scrape
 * @param {Function} cb Callback that will send the results back per batch (page)
 * @param {Object} options Options logToConsole & logToFile
 */
async function gatherWebAPI(userHandle, cb, options) {
	// No options = turn off
	if (userHandle == 'abort' && !cb && !options) {
		await scrapeControl.set('gathering', false);
		return;
	} else {
		await scrapeControl.set('gathering', true);
	}
	
	// Options: Log progress to console / file
	options = options ? options : { logToConsole: true, logToFile: false }
	const { logToConsole, logToFile } = options;

	// Get user id (only needed for webAPI)
	const userId = await getUserData(userHandle, 'id_str');

	// Start
	if (logToConsole) cli.title('Gathering Ids started');
	const logFileName = logToFile ? `id-scrape-log-${moment().format('YYYY-MM-DD--HH-mm')}` : '';

	// Scraping
	const allTweetIds = []; // To avoid duplicates, like pinned tweets
	let p = 1;
	await _scrapeOnePage();

	// Done
	if (logToConsole) cli.title(`Result: ${allTweetIds.length} tweets scraped:\n${allTweetIds.join(',')}`);
	await scrapeControl.set('gathering', false);
	if (logToConsole) cli.banner('Gathering Complete+++++');




	// Scrape one page, then loop back for the next, until bottom is reached
	async function _scrapeOnePage(cursorBottom) {
		await twAuth.refresh(); // Get new token per batch

		// Fetch tweets
		var response = await _fetchTweets(50, cursorBottom);
		
		// Parse entire page of tweets & store as batch
		var uniquePageTweets = _parseResponse(response);
		
		// Log file
		if (logToFile) _logFile(uniquePageTweets);
		
		// Reduce to only ids
		const pageTweetIds = uniquePageTweets.map(tw => {
			return tw.id_str;
		});

		// Process batch
		await cb(pageTweetIds);
		
		// Refresh token when rate limit is reached
		_maybeRefreshToken(response);
		
		// Scrape next page
		const prevCursorBottom = cursorBottom;
		const entries = JSON.parse(response.body).timeline.instructions[0].addEntries.entries;
		cursorBottom = encodeURIComponent(entries[entries.length - 1].content.operation.cursor.value); // -2 for top
		if (cursorBottom != prevCursorBottom) {
			if (await scrapeControl.get('gathering')) {
				p++;
				await _scrapeOnePage(cursorBottom);
			} else {
				if (logToConsole) cli.banner('Gathering Ids Aborted+++++');
			}
		}
	}




	// This is using the web API, which includes RT twice (og ID + RT ID) plus pinned tweet for each page
	// Is a little more messy, but can hanle unlimited count up until ~1375 tweets.
	async function _fetchTweets(count, cursorBottom) {
		let params = {
			tweet_mode: 'extended',
			count: count,
			cursor: cursorBottom
		}
		params = queryString(params);
		const url = `https://api.twitter.com/2/timeline/profile/${userId}.json?${params}`;
		let response;
		try {
			response = await got(url, {
				method: 'GET',
				headers: twAuth.getHeaders(),
				retry: 0 // Only way to eliminate ugle console errors
			});
		} catch(error) {
			const err = JSON.parse(error.response.body).errors[0];
			cli.log(` › p${p} Error #${err.code}: ${err.message} – ${url}`.red);
			return error.response.body;
		}
		return response;
	}

	// Parse response from webAPI (filter out tweets from other users)
	function _parseResponse(response) {
		const allPageTweets = JSON.parse(response.body).globalObjects.tweets;
		const uniquePageTweets = [];
		for (let i in allPageTweets) {
			const tw = allPageTweets[i];
			// Avoid duplicates
			if (!allTweetIds.includes(tw.id_str) && tw.user_id_str == userId) {
				uniquePageTweets.push(tw);
				allTweetIds.push(tw.id_str);
			} else {
				if (logToConsole) cli.log(`Duplicate: ${tw.id_str}`.red);
			}
		}
		return uniquePageTweets;
	}

	// Log tweets to file
	function _logFile(tweets) {
		// Create a loggable format
		const log = tweets.map(tw => {
			let date = new Date(tw.created_at);
			date = moment(date).format('YYYY-MM-DD-HH-mm');
			return tw.id_str + ',' + date+ ',' + tw.full_text.replace(/\n/g, '').replace(/,/g, ''); // .slice(0, 50)
		});
		writeToFile(logFileName, log);
	}

	// Refresh token when rate limit is reached
	async function _maybeRefreshToken(response) {
		const rateLimitRemains = response.headers['x-rate-limit-remaining'];
		if (rateLimitRemains <= 1) {
			if (logToConsole) cli.log('REFRESHING GUEST TOKEN - gather.js'.red);
			await twAuth.refresh();
		} else {
			// cli.log(`${rateLimitRemains}`.yellow);
		}
	}
}

module.exports = { gatherWebAPI };