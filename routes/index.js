// Modules
const express = require('express');
const router = express.Router();
const moment = require('moment');

// Models
const Chapter = require('../models/chapter');
const Label = require('../models/label');
const Tweet = require('../models/tweet');
const Test = require('../models/test');

// Helpers
// const helpers = require('../helpers/helpers-global');
const {parseQuery, padNr, linkURLs, linkUserNames} = {...require('../helpers/helpers-global'), ...require('../helpers/helpers')};

// Testing text search
router.get('/test', async (req, res) => {
	// const dbQuery = {};
	// if (req.query.q) {
	// 	dbQuery.$text = { $search: req.query.q };
	// } else if (req.query.m) {
	// 	var re = new RegExp(req.query.m, 'gi');
	// 	dbQuery.text = re;
	// }

	let tweets = await Test.fuzzySearch(req.query.q);

	// let tweets = await Test.find(dbQuery);

	// let tweets = await Test.find({
	// 	$text: { $search: 'what' }
	// });

	// tweets = tweets.map(tweet => {
	// 	return { text: tweet.text };
	// });
	res.send([tweets.length, tweets]);
});

// Tweets
router.get('/', async (req, res) => {

	/**
	 * Construct database query
	 */

	// Text search query
	const dbQuery = {};
	if (req.query.q) {
		dbQuery.$text = { $search: req.query.q };
	}

	// Month & year query
	if (req.query.y || req.query.m) {
		const beginMonth = req.query.m ? req.query.m : 1;
		const endMonth = req.query.m ? (+req.query.m % 12) + 1 : 1;
		const beginYear = req.query.y ? req.query.y : today.getFullYear();
		const endYear = req.query.y ? 
			(req.query.m && +req.query.m < 12) ?
				req.query.y : +req.query.y + 1
			: +today.getFullYear() + 1;
		
		dbQuery.created_at = {
			$gte: moment(beginYear + '-' + padNr(beginMonth) + '-01').format(),
			$lt: moment(endYear + '-' + padNr(endMonth) + '-01').format()
		}
	}


	/**
	 * Create Year & Month navigation
	 */
	const startDate = new Date('5-4-2009');
	const today = new Date();
	const years = [startDate.getFullYear()];
	for (let year = startDate.getFullYear(); year <= today.getFullYear(); year++) {
		years.push(year);
	}
	const months = ['Jan', 'Jan', 'Feb', 'Mar',
		'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
		'Okt', 'Nov', 'Dec']; // Jan is double so 1=Jan
	const dateNav = {
		years: years,
		months: months
	}
	

	/**
	 * Sorting
	 */
	const sort = (req.query.s == 'chapter') || (req.query.s == '-chapter') ?
		req.query.s : req.query.s == 'date' ? 'created_at' : '-created_at';

	
	/**
	 * Query database & pagination
	 */

	// Pagination parameters A
	const pageNumber = req.query.p ? parseInt(req.query.p) : 1;
	const pageSize = 10;
	const listPages = 30;

	// Query database
	// ## This can be done with one roundtrip:
	// https://stackoverflow.com/a/61196254/2262741
	const p1 = Tweet.find(dbQuery).count();
	const p2 = Tweet.find(dbQuery)
		.sort(sort)
		.limit(pageSize)
		.skip((pageNumber - 1) * pageSize);
	let [resultCount, tweets] = await Promise.all([p1, p2]);
	// console.log('dbQuery: ', dbQuery);

	// Pagination parameters B
	const totalPages = Math.ceil(resultCount / pageSize);
	// Where the pagination begins and ends
	let paginationStart = Math.floor(pageNumber / listPages) * listPages;
	let paginationEnd = Math.min(totalPages, paginationStart + listPages);
	paginationStart = paginationStart === 0 ? 1 : paginationStart;
	// Adjust pagination start/end on first/last pages
	if (totalPages < paginationEnd || totalPages == listPages + 1) {
		paginationEnd = totalPages;
		paginationStart = totalPages - listPages;
	}


	/**
	 * Manipulate content
	 */

	// Link URLs and usernames
	tweets = tweets.map(tweet => {
		tweet.text = linkURLs(tweet.text);
		tweet.text = linkUserNames(tweet.text);
		return tweet;
	});

	// Highlight matching text
	// ## There is built-in MongoDB functionality that takes care of this:
	// https://docs.atlas.mongodb.com/reference/atlas-search/highlighting/
	if (req.query.q) {
		const {queryStems, queryPhrases, regexWords, regexPhrases} = parseQuery(req.query.q);
		console.log(queryStems)
		tweets = tweets.map((tweet, i) => {
			if (queryStems.length) tweet.text = tweet.text.replace(regexWords, '<b>$1</b>');
			if (queryPhrases.length) tweet.text = tweet.text.replace(regexPhrases, '<b>$1</b>');
			return tweet;
		});
	}

	// Remove any highlight tags inside href
	tweets = tweets.map(tweet => {
		// Test: https://regex101.com/r/zrg4yp/1
		tweet.text = tweet.text.replace(/(href="[^"]*?)<\/?b>(?:([^"]*?)<\/?b>)?([^"]*")/ig, '$1$2$3');

		return tweet;
	});

	
	/**
	 * Show results
	 */

	res.render('index', {
		tweets: tweets,
		resultCount: resultCount,
		sort: sort,
		pageNumber: pageNumber,
		totalPages: totalPages,
		pageSize: pageSize,
		paginationStart: paginationStart,
		paginationEnd: paginationEnd,
		dateNav: dateNav,
		query: req.query
	});
});

// Overview
router.get('/overview', async (req, res) => {
	

	res.render('overview');
});

// Chapters
router.get('/chapters', async (req, res) => {
	const chapters = await Chapter.find().sort('sortIndex');

	return res.render('chapters', {
		chapters: chapters
	});
});

// Labels
router.get('/labels', async (req, res) => {
	
	let labels = await Label.find().sort('value -count');
	return res.render('labels', {
		labels: labels
	});

});

module.exports = router;