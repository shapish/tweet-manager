const express = require('express');
const router = express.Router();

// Models
const { Tweet, TweetScrape } = require('../models/tweet');
const ScrapeControl = require('../models/scrape-control'); // Storing of options and status
const Tta = require('../models/tta'); // Trump Twitter Archive

// Functions
const { gatherAndStore, extractData, openBrowser } = require('../scraper/control');  // Control functions
const { extract, twAuth, extractSimple, inspect } = require('../scraper/extract');
const { seed, extractTweets, transferData } = require('../scraper/seed');
const cli = require('../helpers/cli-monitor');
const { padNr, timeout } = require('../helpers/general');



/**
 * Seeding
 */

// Step 1: Seed database
// Seed TweetScrape with ids only: http://localhost:5000/api/scraper/seed/TweetScrape/tta-20-06-12.json?tta=1
// Seed Tta http://localhost:5000/api/scraper/seed/Tta/tta-20-06-12.json?drop=1
router.post('/seed/:collection/:filename/:state', async (req, res) => {
	// return console.log(req.originalUrl.split('?').shift())
	if (+req.params.state) {
		// Loads 1 page at a time, then forwards to next until done
		seed({
			filename: req.params.filename, // Where to seed from
			collection: req.params.collection, // Where to seed
			p: req.query.p, // Current request's page
			done: +req.query.done, // Docs processed
			drop: +req.query.drop,
			idsOnly: +req.query.ids_only,
			url: req.protocol + '://' + req.get('host') + req.originalUrl.split('?').shift()
		});
		res.send('Seeding in progress, check console.');
	} else {
		// Abort
		seed('abort');
		res.send('Seeding aborted.');
	}
});


// Step 2: Extract tweet info for collection ful off ids
router.post('/extract/:collection/:state', async (req, res) => {
	if (+req.params.state) {
		// Loads 1 page at a time, then forwards to next until done
		extractTweets(req.params.collection);
		res.send('Extracting in progress, check console.');
	} else {
		// Abort
		extractTweets('abort');
		res.send('Extracting aborted.');
	}
});


// Step 3: Transfer data from TweetScrape to Tweet
router.post('/transfer/:state', async (req, res) => {
	if (+req.params.state) {
		// Loads 1 page at a time, then forwards to next until done
		transferData({
			drop: +req.query.drop
		});
		res.send('Transferring in progress, check console.');
	} else {
		// Abort
		transferData('abort');
		res.send('Transferring aborted.');
	}
});

module.exports = router;