// TODO: tidy and simplify

const { timeout } = require('../helpers/general');
const cli = require('../helpers/cli-monitor');


/**
 * Scrapes as many pages as are defined in batchSize and
 * returns results per page via the callback function
 * @param {Object} options Contains browser & batchSize
 * @param {Function} cb Callback
 */
async function gather(options, cb) {
	const { browser, batchSize } = options;
	let { url, page } = options;
	let cycle = 1;
	let attempt = 1;

	const webPage = await browser.newPage();
	await webPage.setUserAgent('Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)');

	await _scrapeOnePage(url);
	await webPage.close();

	// Scrape one page and send results back to control
	async function _scrapeOnePage(url) {
		const obj = { ids: [], url: url };
		await _tryScrape(obj);
		
		// Complete next url
		if (obj.url) {
			obj.url = (obj.url.slice(0,1) == '/') ? `https://twitter.com${obj.url}` : obj.url;
		}

		cli.title(`p ${page}: ${obj.ids.length} ids scraped`, 0, 1);

		// Return current batch of ids + next page url
		if (obj.ids.length > 0) {
			await cb(obj.ids, obj.url, page); // <------------------------- callback!
		}
		
		// Scrape next page
		if (obj.url && cycle < batchSize) {
			page++;
			cycle++
			await timeout(10);
			await _scrapeOnePage(obj.url);
		}
		
	}

	// Keep on reloading the same page if no tweets are being loaded
	async function _tryScrape(obj) {
		const currentPageUrl = obj.url;
		await webPage.goto(obj.url, { waitUntil: 'networkidle0' });
		const result = await webPage.evaluate(_ => {
			let ids = Array.from(document.querySelectorAll('td.timestamp a')).map(a => a.getAttribute('name').match(/\d+$/)[0]);
			let olderTweetsButton = document.querySelector('.w-button-more a');
			let url = olderTweetsButton ? olderTweetsButton.getAttribute('href') : null;
			return [ids, url];
		});
		obj.ids = result[0];
		obj.url = result[1];

		cli.log(`p ${page} - ${attempt} -> ${obj.ids.length} url: ${currentPageUrl} next: ${obj.url}`.cyan);

		// Often IE6 UI won't properly load tweets, so we try again
		// Every page has 30 but sometimes it only loads 27-30
		if (obj.ids.length < 27) {
			if (attempt < 100) {
				// When failed, reset url from next page (should be null) to current page
				obj.url = currentPageUrl;

				attempt++;
				const to = attempt <= 5 ? 100 : (attempt - 5) * 200; // Start slowing down attempts after 10
				await timeout(to);
				await _tryScrape(obj);
			} else {
				// After trying 100 times, we probably reached the bottom; abort.
				// Twitter stops serving tweets older than a few thousand.
				cli.banner('Gathering Finished');
			}
		} else {
			// Successful scrape, reset
			attempt = 1;
		}
	}
}


module.exports = gather;