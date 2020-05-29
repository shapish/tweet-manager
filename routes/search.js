// Modules
const express = require('express');
const router = express.Router();
const logger = require('../helpers/logger');
const ejs = require('ejs');

// Models
const Tweet = require('../models/tweet');
const { User } = require('../models/user');
const Chapter = require('../models/chapter');
const Dup = require('../models/dup');

// Functions
const Search = require('../functions/classes/Search');
const Pg = require('../functions/classes/Pagination');
const {getDateNav, linkText} = require('../functions/search');
const {url} = require('../functions/general-global');
const {auth} = require('../middleware/auth');



// Landing
router.get('/', auth, display);


// Search query
router.post('/q', auth, (req, res) => {
	const {q} = req.body;
	if (q == '*') {
		delete req.query.q;
	} else {
		// Gets decoded later
		req.query.q = q;
	}
	req.renderFile = true;
	display(req, res);
});


// Clear search
router.post('/clear', auth, (req, res) => {
	req.renderFile = true;
	display(req, res);
});


// Sort
router.post('/s/:sort', auth, (req, res) => {
	req.renderFile = true;
	if (req.params.sort == '-date') {
		delete req.query.s;
	} else {
		req.query.s = req.params.sort;
	}
	display(req, res);
});


// Go to page
router.post('/p/:nr', auth, (req, res) => {
	req.renderFile = true;	
	req.query.p = req.params.nr;
	req.keepPagination = true;
	display(req, res);
});


// Filter
router.post('/filter/:action/:state', auth, (req, res) => {
	let {action, state} = req.params;
	
	// Parse month/year input
	const regexYear = /^y-(\d{4})$/;
	const regexMonth = /^m-(\d{1,2})$/;
	let year = false;
	let month = false;
	if (action.match(regexYear)) {
		year = action.replace(regexYear, '$1');
		action = 'year';
	} else if (action.match(regexMonth)) {
		month = action.replace(regexMonth, '$1');
		action = 'month';
	}

	switch (action) {
		// Type filters
		case 'all':
			delete req.query.t;
			break;
		case 'og':
		case 'rt':
			req.query.t = action;
			break;

		// Date filters
		case 'cal':
			if (state == '1') {
				// Reinstate year & month if they're already selected
				if (req.body.y) req.query.y = req.body.y;
				if (req.body.m) req.query.m = req.body.m;
			} else {
				delete req.query.y;
				delete req.query.m;
				delete req.query.cal;
			}
			break;
		case 'year':
			if (state == '1') {
				req.query.y = year;
			} else if (req.query.m) {
				req.query.y = new Date().getFullYear();
			} else {
				delete req.query.y;
			}
			break;
		case 'month':
			if (state == '1') {
				req.query.m = month;
				if (!req.query.y) {
					req.query.y = 2020;
				}
			} else {
				delete req.query.m;
			}
			break;

		// Category filters
		case 'st':
			if (state == 'null') {
				delete req.query[action];
			} else {
				req.query[action] = state;
			}
			break;
		default:
			if (state == '0') {
				delete req.query[action];
			} else {
				req.query[action] = state;
			}
			break;
	}
	req.renderFile = true;
	display(req, res);
});


// Change settings // ## should be in api-user
router.put('/settings', auth, async (req, res) => {
	// Read settings
	const settings = {};
	if (req.body.showLabels) settings.s_showLabels = req.body.showLabels;
	if (req.body.showMeta) settings.s_showMeta = req.body.showMeta;
	if (req.body.clipTweets) settings.s_clipTweets = req.body.clipTweets;
	if (req.body.pageSize) settings.s_pageSize = req.body.pageSize;
	if (req.body.listPages) settings.s_listPages = req.body.listPages;

	// Update user
	await User.findByIdAndUpdate(req.user._id, settings);

	// Reload content
	req.renderFile = true;
	req.keepPagination = true;
	display(req, res);
});


// Search tips
router.get('/tips', auth, async (req, res) => {
	req.bodyClasses = ['show-tips'];
	display(req,res);
});


// Search & display tweets
async function display(req, res) {
	// Decode q
	if (req.query.q) req.query.q = decodeURIComponent(req.query.q);
	
	// Whenever data changes, pagination is reset
	if (req.renderFile && !req.keepPagination) delete req.query.p;

	// Get years & months to display
	const dateNav = getDateNav();
	
	// Gather all parameters to run search
	const {search, terms, searchParams, sort} = new Search(req.query);
	console.log('searchParams:', searchParams);
	// console.log('terms:', terms);

	// Re-encode query.q once we're done with (so correct urlQuery is sent back)
	if (req.query.q) req.query.q = encodeURIComponent(req.query.q);
	const qDecoded = req.query.q ? decodeURIComponent(req.query.q) : '';


	// Load user settings
	const user = await User.findById(req.user._id)
		.select('s_showLabels s_showMeta s_clipTweets s_pageSize s_listPages isAdmin');
	let tableClass = '';
	if (user.s_showLabels) tableClass += ' show-labels';
	if (user.s_showMeta) tableClass += ' show-meta';
	if (user.s_clipTweets) tableClass += ' clip-tweets';

	// Set pagination parameters
	const pg = new Pg(req.query.p, user);

	// ## This can be done with one roundtrip:
	// https://stackoverflow.com/a/61196254/2262741
	const p1 = Tweet.find(searchParams)
		.sort(sort)
		.limit(pg.pageSize)
		.skip((pg.pageNumber - 1) * pg.pageSize)
	const p2 = Tweet.find(searchParams).count();
	let [tweets, resultCount] = await Promise.all([p1, p2]);
	
	// Complete pagination parameters
	pg.complete(resultCount);

	// Link URLs and usernames
	linkText(tweets);
	// console.log(tweets[0])

	// Highlight results
	if (req.query.q) search.highlightText(tweets);

	// Load chapters list
	const chapters = await Chapter.find({}).select('title index').sort('sortIndex');
	
	// Data to send
	let data = {
		tweets: tweets,
		resultCount: resultCount,
		sort: sort,
		pagination: pg,
		dateNav: dateNav,
		query: req.query,
		q: qDecoded,
		terms: terms,
		user: user,
		sel: _getSelClass(req.query),
		tableClass: tableClass,
		chapters: chapters,
		bodyClasses: req.bodyClasses ? req.bodyClasses : []
	};
	
	if (req.renderFile) {
		// Render table data
		let html = '';
		const renderData = { ...data, ...req.app.locals };
		ejs.renderFile('views/search--table.ejs', renderData, (err, str) => {
			if (err) {
				logger.error('Error rendering search--table.ejs', err);
			} else {
				html += str;
			}
		});
		let queryDataHtml = '';
		// Note: empty options need to be passed here, otherwise the "strict" property of terms is confused with the strict option
		ejs.renderFile('views/search--query-data.ejs', terms, {}, (err, str) => {
			if (err) {
				logger.error('Error rendering search--query-data.ejs', err);
			} else {
				queryDataHtml += str;
			}
		});
		console.log('&', url(req.query, null, null, req.keepPagination))
		res.send({
			html: html,
			resultCount: resultCount,
			queryDataHtml: queryDataHtml,
			urlQuery: url(req.query, null, null, req.keepPagination),
			q: qDecoded
		});
	} else {
		// Load page
		res.render('search', data);
	}

	// Set UI selection states for each link
	function _getSelClass(query) {
		return {
			// Type
			all: !query.t ? 'sel' : '',
			og:  query.t == 'og' ? 'sel' : '',
			rt:  query.t == 'rt' ? 'sel' : '',

			// Dates
			cal: query.y || query.m ? 'sel' : '',

			// Filters
			st: query.st ? 'sel s-' + query.st : '',
			la: query.la == 1 ? 'sel' : query.la == -1 ? 'sel un' : '',
			as: query.as == 1 ? 'sel' : query.as == -1 ? 'sel un' : '',
			ar: query.ar == 1 ? 'sel' : query.ar == -1 ? 'sel only' : '',
			dl: query.dl == 1 ? 'sel' : query.dl == -1 ? 'sel only' : '',

			// Sort
			chapter: query.s == 'chapter' ? 'sort' : query.s == '-chapter' ? 'sort dec' : '',
			date:	 query.s == 'date' ? 'sort' : !query.s ? 'sort dec' : '',
			score:	 query.s == 'score' ? 'sort' : query.s == '-score' ? 'sort dec' : ''
		}
	}
}









// Fuzz2
router.get('/fuzzy', auth, async (req, res) => {
	// Get years & months to display
	const dateNav = getDateNav();

	// Search
	const {search, searchParams, pg, sort} = new Search(req.query);
	// console.log('searchParams:', searchParams);

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


module.exports = router;