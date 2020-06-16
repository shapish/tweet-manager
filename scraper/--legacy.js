// The code below has been decommissioned, but I'm keeping it
// here as reference since it's using some cool scrape techniques:
// - Puppeteer to launch a (headless) browser and do things in the browser
// - GOT to send web requests and analyze the payload


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


gather({
	url: 'https://twitter.com/realDonaldTrump',
	page: 1
});


/**
 * Scrapes as many pages as are defined in batchSize and
 * returns results per page via the callback function
 * @param {Object} options Contains browser & batchSize
 * @param {Function} cb Callback
 * - - -
 * This was the last version of the fgather script using http request before I figured
 * out how to get around API rate limits and rewrote it to talk directly to the API.
 */
async function gather(options) {
	const batchSize = 3;
	let { url, page } = options;
	let cycle = 1;
	let attempt = 1;
	const gotOptions = { headers: { 'user-agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)' } };
	let batchIds = [];

	// Scrape ids of one page
	let result;
	await _scrapeOnePage(url, page);

	// Log
	if (result == 'Batch completed') {
		cli.title(result + ' - ' + batchIds.length + ' ids scraped');
	} else if (result == 'Scrape done') {
		cli.title('Last batch completed - ' + batchIds.length + ' ids scraped');
		cli.banner(result);
	}

	writeToFile(batchIds.join(','));
	// Return batch of ids
	return batchIds;
	



	async function _scrapeOnePage(url, page) {
		let { nextUrl, ids } = await _tryScrape(url);
		
		// Store ids
		batchIds = batchIds.concat(ids);

		// Complete next url
		nextUrl = nextUrl ? (nextUrl.slice(0,1) == '/') ? `https://twitter.com${nextUrl}` : nextUrl : null;
		
		// Log
		cli.title(`p ${page}: ${ids.length} ids scraped`, 0, 1);

		// Scrape next page
		if (nextUrl && cycle < batchSize) {
			cycle++
			await timeout(10);
			await _scrapeOnePage(nextUrl, page+1);
		} else if (cycle == batchSize) {
			result = 'Batch completed';
		} else if (!nextUrl) {
			result = 'Scrape done';
		}
	}

	async function _tryScrape(url) {
		// Load html
		// payload = await got(url, gotOptions);
		payload = await got(url); // $$
		let $ = cheerio.load(payload.body);

		// Scrape ids
		let ids = [];
		// $('.tweet-text').each((i, elm) => {
		// 	const id = $(elm).attr('data-id');
		// 	ids.push(id);
		// });
		$('.css-4rbku5.css-18t94o4.css-901oao.r-1re7ezh.r-1loqt21.r-1q142lx.r-1qd0xha.r-a023e6.r-16dba41.r-ad9z0x.r-bcqeeo.r-3s2u2q.r-qvutc0').each((i, elm) => {
			const id = $(elm).attr('href').match(/\/(\d+)$/)[1];
			ids.push(id);
		});

		// Scrape next page url
		let nextUrl = $('.w-button-more a').attr('href');

		// Log
		cli.log(`p${page} - attempt ${attempt} -> ${ids.length}     url: ${url}     next url: ${nextUrl}`.cyan);

		// If tweets didn't load, try again
		if (!nextUrl) { // ? ids.length < 27
			if (attempt < 100) {
				attempt++;

				// Start slowing down attempts after 10
				const to = attempt <= 5 ? 100 : (attempt - 5) * 200;
				await timeout(to);
				newAttempt = await _tryScrape(url);
				nextUrl = newAttempt.nextUrl;
				ids = newAttempt.ids;
			} else {
				// After 100 attempts, we probably reached the bottom
				// Note: Twitter stops serving tweets older than a few thousand
				cli.banner('Gathering Finished');
			}
		} else {
			attempt = 1; // Reset attempts for next page
		}
		return { ids: ids, nextUrl: nextUrl };
	}
}




// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -




/**
 * Seed database
 * - - -
 * Processes a json file in groups of batches. Never finished this, but it's not clear if the consecutive
 * http requests of the current solution are even helping avoiding memory overload, might have to revert to this.
 * 
 */
router.post('/seed/:filename', async (req, res) => {
	const seedData = require('../data/' + req.params.filename);
	const batchSize = 100; // Documents per batchs
	const groupSize = 50; // Batches per group

	// Organize in batches
	const batches = _createBatches();

	// Organize batches in groups
	const groups = _createGroups(batches);

	// Response
	const response = `Seeding ${prettyNr(seedData.length)} documents to database.
	--------------------------------------------------
	--> Seeding ${groups.length} groups of ${groupSize} batches with each max ${batchSize} documents
	--> ${groups.length} x ${groupSize} x ${batchSize} = ${prettyNr(groups.length * groupSize * batchSize)} documents
	--> Last group has ${groups[groups.length - 1].length} batches and the last batch has ${batches[batches.length - 1].length} documents`
	res.send(response);

	
	const result = [];

	// Loop throug groups
	let i = 0;
	_processGroup(groups[i], i);
	
	console.log('- - - - - - - - - done');
	console.log('')
	console.log(seedData.length + ' items added');



	

	function _createBatches() {
		const batches = [];
		for (let j=0; j<seedData.length; j++) {
			if (j % batchSize === 0) {
				batches.push([seedData[j]])
			} else {	
				batches[batches.length - 1].push(seedData[j]);
			}
		}
		return batches;
	}

	function _createGroups() {
		const groups = [];
		for (let j=0; j<batches.length; j++) {
			if (j % groupSize === 0) {
				groups.push([batches[j]])
			} else {	
				groups[groups.length - 1].push(batches[j]);
			}
		}
		return groups;
	}

	function _processGroup(group, i) {
		// Loop throug batches
		console.log(`Processing group #${i} with ${group.length} batches\n-----------------------------------\n\n`)
		for (let j=0; j<group.length; j++) {
			_processBatch(batches[j], j);
		}

		// Schedule file to be deleted in 10 min
		var time = laterDate('5s');
		schedule.scheduleJob(time, function(_processGroup, groups, group, batches, i, schedule) {
			_processGroup(groups[i], i)
		}.bind(null, _processGroup, groups, group, i+1, batches, schedule));

	}

	async function _processBatch(batch, j) {
		console.log(`Batch #${j}: ${batch.length}`);
		
		// Translate tta to our own format
		// batch = batch.map(tw => {
		// 	return {
		// 		idTw: tw.id_str,
		// 		source: tw.source
		// 	}
		// });
		// console.log(batch)

		try {
			const data = await Tweet.create(batch);
			result.push(...data);
		}
		catch {
			console.log('Error, probably duplicates, on batch #' + j + '\n\n');
		}
		// if (j % 100 === 99) {
		// 	console.log('/n/n- break-/n/n');
		// 	await timeout(5000);
		// }
	}
});


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -



/**
 * Seed database JSON without overloading memory
 * https://ckhconsulting.com/parsing-large-json-with-nodejs/
 * - - -
 * Uses fileStream to parse mega JSON without overloading memory. However, this is not working
 * in fact memory is overload happens even faster bc everything is written into array. Not sure
 * how to properly use it but might have to return to this technique to parse mega JSONs bigger
 * than the current Trump twitter archive
 */
router.post('/seed/:filename', async (req, res) => {
	const fileStream = fs.createReadStream('data/' + req.params.filename + '.json');
	const jsonStream = StreamArray.withParser();

	const batchSize = 1000;
	let count = 1;
	let total = 0;
	let batch = [];

	const processingStream = new Writable({
		write({key, value}, encoding, callback) {
			batch.push(value);
			if (key % batchSize == batchSize - 1) {
				_processBatch(batch);
				count++;
				batch = [];
			}
			callback();
		},
		// Don't skip this, as we need to operate with objects, not buffers
		objectMode: true
	});

	// Pipe the streams as follows
	fileStream.pipe(jsonStream.input);
	jsonStream.pipe(processingStream);
	
	// Finish
	processingStream.on('finish', _finish);
	res.send('Processing...');




	function _finish() {
		_processBatch();
		console.log('\n\n - - Seeding complete - - \n\n');
	}

	async function _processBatch() {
		total += batch.length;
		console.log(`Batch #${count}: +${batch.length} => ${total}`);
		try {
			await Tweet.create(batch);
		} catch (err) {
			console.log(`Error (probably duplicates) on batch #${count}`);
		}
	}
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


/**
 * In the gather script we look for the cursor string that allows us to scrape next page
 * However when scraping search results, this is a little more complicated.
 * If we ever want to integrate search result scraping, this will come in handy
 */
function whatever() {
	// ...

	// Get next page parameter (cursorBottom) // <--- !!
	// JSON structure is different for first page
	prevCursorBottom = cursorBottom;
	const maybeCursorBottom = JSON.parse(response.body).timeline.instructions[2];
	if (!maybeCursorBottom) {
		// First page
		const entries = JSON.parse(response.body).timeline.instructions[0].addEntries.entries;
		cursorBottom = encodeURIComponent(entries[entries.length - 1].content.operation.cursor.value); // -2 for top
	} else {
		// Other pages
		cursorBottom = encodeURIComponent(maybeCursorBottom.replaceEntry.entry.content.operation.cursor.value);
	}

	// ...
}