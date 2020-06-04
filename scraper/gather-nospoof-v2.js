// var since = '2020-01-01';
// var until = '2020-01-02';
// url = `https://twitter.com/search?q=(from%3Arealdonaldtrump)%20until%3A${until}%20since%3A${since}&src=typed_query`;


const { timeout } = require('../helpers/general');

async function gather(options, cb) {
	const { browser, batchSize } = options;
	let { url } = options;
	let p = 1
	let attempt = 1;

	const page = await browser.newPage();
	// await page.setUserAgent('Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)');

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

		console.log('- - - p' + p + ': ' + obj.ids.length + ' ids scraped');
		console.log('');

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
			let ids = Array.from(document.querySelectorAll('a.css-4rbku5.css-18t94o4.css-901oao.r-1re7ezh.r-1loqt21.r-1q142lx.r-1qd0xha.r-a023e6.r-16dba41.r-ad9z0x.r-bcqeeo.r-3s2u2q.r-qvutc0')).map(a => a.getAttribute('href').match(/\d+$/)[0]);
			let olderTweetsButton = document.querySelector('.w-button-more a');
			let url = olderTweetsButton ? olderTweetsButton.getAttribute('href') : null;
			return [ids, url];
		});
		console.log('result: ', result);
		return;



		obj.ids = result[0];
		// obj.url = result[1] ? result[1] : obj.url;
		obj.url = result[1];

		console.log('p' + p + '-' + attempt + ' -> ' + obj.ids.length + ' url: ' + currentPageUrl + ' next: ' + obj.url);

		// Often IE6 UI won't properly load tweets, so we try again
		// Every page has 30 but sometimes it only loads 27-30
		if (obj.ids.length <= 1) {
			if (attempt < 100) {
				// When failed, reset url from next page (shoudl be null) to current page
				obj.url = currentPageUrl;

				attempt++;
				const to = attempt <= 5 ? 100 : (attempt - 5) * 200; // Start slowing down attempts after 10
				await timeout(to);
				await _tryScrape(obj);
			} else {
				// Edge case where last page only has one tweet
				// After 100 tries, abort
				_logEnd();
			}
		} else if (obj.ids.length >= 27) {
			// Successful scrape
			attempt = 1;
		}
	}

	// Log the end
	function _logEnd() {
		console.log('')
		console.log('')
		console.log('---------------------------------');
		console.log('------ Gathering Finished! ------');
		console.log('---------------------------------');
	}
}


module.exports = gather;