const { timeout } = require('../functions/general');

async function gather(options, cb) {
	const { browser, batchSize } = options;
	let { p, url } = options;
	let attempt = 1;

	const page = await browser.newPage();
	await page.setUserAgent('Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)');

	await _scrapeOnePage(url);
	await page.close();

	// Scrape one page and send results back to control
	async function _scrapeOnePage(url) {
		const obj = { ids: [], url: url };
		await _tryScrape(obj);
		
		// Complete next url
		if (obj.url) {
			obj.url = (obj.url.slice(0,1) == '/') ? `https://twitter.com${obj.url}` : obj.url;
		}

		console.log('- - -')
		console.log('p' + p + ': ' + obj.ids.length + ' ids scraped')

		// Return current batch of ids + next page url
		if (obj.ids.length > 0) {
			await cb(obj.ids, obj.url, p); // <--------- ! callback
		}
		
		if (obj.url && p < batchSize) {
			p++;
			await timeout(10);
			await _scrapeOnePage(obj.url);
		}
		
	}

	// Scrape ids & store in obj, update url to next page
	async function _tryScrape(obj) {
		const currentPageUrl = obj.url;
		await page.goto(obj.url, { waitUntil: 'networkidle0' });
		const result = await page.evaluate(_ => {
			let ids = Array.from(document.querySelectorAll('td.timestamp a')).map(a => a.getAttribute('name').match(/\d+$/)[0]);
			let olderTweetsButton = document.querySelector('.w-button-more a');
			let url = olderTweetsButton ? olderTweetsButton.getAttribute('href') : null;
			return [ids, url];
		});
		obj.ids = result[0];
		// obj.url = result[1] ? result[1] : obj.url;
		obj.url = result[1];

		console.log('#' + p + '-' + attempt + ' -> ' + obj.ids.length + ' url: ' + currentPageUrl + ' next: ' + obj.url);

		// Often IE6 UI won't properly load tweets, so we try again
		if (obj.ids.length < 28 && attempt < 10) {
			// When failed, reset url from next page (shoudl be null) to current page
			// console.log('RESET: ', obj.url, ' -> ', currentPageUrl);
			obj.url = currentPageUrl;

			attempt++;
			await timeout(10); // Let Twitter take a breath
			await _tryScrape(obj);
		} else if (attempt >= 10) {
			// Max attempts reached: reset and return current page URL,
			// either Twitter fail or bottom of account is reached
			console.log('')
			console.log('')
			console.log('---------------------------------');
			console.log('------ Gathering Finished! ------');
			console.log('---------------------------------');
		} else {
			attempt = 1;
			// console.log('diff? ' + obj.url, pageUrl)
			// obj.url = currentPageUrl;
		}
	}
}


module.exports = gather;