// Modules
const got = require('got');

// Helpers
const cli = require('../helpers/cli-monitor');
const { timeout, writeToFile, queryString, getDate, getTime } = require('../helpers/general')
const twAuth = new (require('./tw-auth'))(); // Twitter authentication



/**
 * Scrapes someone's twitter profile (ids only) directly from the
 * Twitter API, however Twitter only serves up to about ~1300 tweets
 * @param {*} userId Twitter handle to scrape
 * @param {*} cb callback that will send the results back per batch (page)
 */
async function gatherIds(userId, cb, createLog) {
	
	// Start
	cli.banner('Scraping started'.green);

	// Scraping
	const allTweetIds = []; // To avoid duplicates, like pinned tweets
	await _scrapeOnePage();

	// Done
	console.log(`Result: ${allTweetIds.length} tweets scraped:\n`, allTweetIds.join(','));



	// Scrape one page, then loop back for the next, until bottom is reached
	async function _scrapeOnePage(cursorBottom) {
		await twAuth.refresh(); // Get new token per batch

		// Fetch tweets
		let params = {
			tweet_mode: 'extended',
			// Note: The Twitter rate limit is 186, but quoted tweets and repliesTo are being followed,
			// multiplying the amount of API requests up to 3 per tweet – hence only 50 tweets/page.
			count: 50,
			cursor: cursorBottom
		}
		params = queryString(params);
		const response = await got(`https://api.twitter.com/2/timeline/profile/${userId}.json?${params}`, {
			method: 'GET',
			headers: twAuth.getHeaders()
		});
		
		// Parse entire page of tweets & store as batch
		const allPageTweets = JSON.parse(response.body).globalObjects.tweets;
		const uniquePageTweets = [];
		for (let tweet in allPageTweets) {
			const tw = allPageTweets[tweet];
			// Avoid duplicates
			if (!allTweetIds.includes(tw.id_str)) {
				uniquePageTweets.push(tw);
				allTweetIds.push(tw.id_str);
			} else {
				cli.log(`Duplicate: ${tw.id_str}`.red);
			}
		}
		
		// Reduce to only ids
		const pageTweetIds = uniquePageTweets.map(tw => {
			return tw.id_str;
		});
		
		// Log
		if (createLog) {
			// Create a loggable format
			const pageTweetsLog = uniquePageTweets.map(tw => {
				return tw.id_str + ' - ' + tw.created_at + ' - ' + tw.full_text.replace(/\n/g, ''); // .slice(0, 50)
			});
			const now = new Date();
			writeToFile(pageTweetsLog, 'id-scrape-log-' + getDate(now, 1) + '--' + getTime(now).replace(/:/, '-'));
			writeToFile(',' + pageTweetIds.join(','), 'id-scrape-log-' + getDate(now, 1) + '--' + getTime(now).replace(/:/, '-'))
		}

		// Process batch
		cb(pageTweetIds);
		
		// Refresh token when rate limit is reached
		const rateLimitRemains = response.headers['x-rate-limit-remaining'];
		if (rateLimitRemains <= 1) {
			cli.log('REFRESHING GUEST TOKEN - gather.js'.red);
			await twAuth.refresh();
		} else {
			cli.log(`${rateLimitRemains}`.yellow);
		}
		
		// Get next page parameter (cursorBottom)
		const prevCursorBottom = cursorBottom;
		const entries = JSON.parse(response.body).timeline.instructions[0].addEntries.entries;
		cursorBottom = encodeURIComponent(entries[entries.length - 1].content.operation.cursor.value); // -2 for top

		// Scrape next page
		if (cursorBottom != prevCursorBottom) {
			await timeout(5000);
			await _scrapeOnePage(cursorBottom);
		} else {
			cli.banner('Scraping complete'.green);
		}
	}
}

module.exports = { gatherIds };