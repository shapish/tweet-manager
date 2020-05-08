// Modules
const express = require('express');
const router = express.Router();

// Models
const Chapter = require('../models/chapter');
const Label = require('../models/label');
const Tweet = require('../models/tweet');
const Dup = require('../models/dup');

// Functions
const Search = require('../functions/classes/Search');
const {getDateNav, linkText} = require('../functions/search');

// Testing text search
router.get('/aggr', async (req, res) => {
	
	const results = await Tweet.aggregate([
		{
			$match: { $text: { $search: '"swamp creature"' } }
		},
		{
			$sort: { created_at: -1 }
		},
		{
			$project: { _id: 0, text: 1 }
		}
	]);

	res.send(results);
});

// Search tweets
router.get('/', async (req, res) => {
	// Get years & months to display
	const dateNav = getDateNav();

	// Search
	const {search, searchParams, pg, sort} = new Search(req.query);
	console.log('searchParams:', searchParams);

	// ## This can be done with one roundtrip:
	// https://stackoverflow.com/a/61196254/2262741
	const p1 = Tweet.find(searchParams)
		.sort(sort)
		.limit(pg.pageSize)
		.skip((pg.pageNumber - 1) * pg._pageSize);
	const p2 = Tweet.find(searchParams).count();
	const [tweets, resultCount] = await Promise.all([p1, p2]);

	if (!resultCount) {

	}

	// Complete pagination parameters
	pg.complete(resultCount);

	// Link URLs and usernames
	linkText(tweets);

	// Highlight results
	search.highlightText(tweets);

	// Render
	res.render('index', {
		tweets: tweets,
		resultCount: resultCount,
		sort: sort,
		pagination: pg,
		dateNav: dateNav,
		query: req.query
	});
});


// Fuzz2
router.get('/fuzzy', async (req, res) => {
	// Get years & months to display
	const dateNav = getDateNav();

	// Search
	const {search, searchParams, pg, sort} = new Search(req.query);
	console.log('searchParams:', searchParams);

	// ## This can be done with one roundtrip:
	// https://stackoverflow.com/a/61196254/2262741
	const p1 = await Dup.fuzzySearch(req.query.q)
		.sort(sort)
		.limit(pg.pageSize)
		.skip((pg.pageNumber - 1) * pg.pageSize);
	const p2 = await Dup.fuzzySearch(req.query.q).count();
	const [tweets, resultCount] = await Promise.all([p1, p2]);

	// Complete pagination parameters
	pg.complete(resultCount);

	// Link URLs and usernames
	linkText(tweets);

	// Highlight results
	search.highlightText(tweets);

	// Render
	res.render('index', {
		tweets: tweets,
		resultCount: resultCount,
		sort: sort,
		pagination: pg,
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