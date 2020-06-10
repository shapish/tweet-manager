// Modules
const express = require('express');
const router = express.Router();
const logger = require('../helpers/logger');
const ejs = require('ejs');
const CSVParse = require('json2csv').parse;

// Models
const Tweet = require('../models/tweet');
const { User } = require('../models/user');
const Chapter = require('../models/chapter');

// Functions
const Search = require('../helpers/classes/Search');
const Pg = require('../helpers/classes/Pagination');
const { getDateNav, linkText } = require('../helpers/search');
const { padNr, getTime, getDate } = require('../helpers/general');
const { url } = require('../helpers/general-global');
const { auth } = require('../middleware/auth');



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
	// console.log('searchParams:', searchParams);
	// console.log('terms:', terms);
	// console.log('sort', sort);

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

	// Parse clean date & time formats
	tweets = tweets.map(tweet => {
		tweet.dateString = getDate(tweet.date);
		tweet.timeString = getTime(tweet.date);
		return tweet;
	});

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


// Download
fs = require('fs');
router.get('/download/:format', auth, async (req, res) => {
	let format = req.params.format;

	// Decode q
	if (req.query.q) req.query.q = decodeURIComponent(req.query.q);
	
	// Gather all parameters to run search
	const {searchParams, sort} = new Search(req.query);

	// Fetch results
	let result = await Tweet.find(searchParams).sort(sort);

	// Create filename
	const date = new Date();
	const filename = 'the45th-data-' + date.getFullYear() + padNr(date.getMonth()) + padNr(date.getDay()) + '-' + date.getHours() + 'h' + padNr(date.getMinutes());

	// Format CSV
	if (format == 'json') {
		result = JSON.stringify(result);
	} else if (format == 'csv') {
		try {
			result = CSVParse(result, {
				fields: [
					'text',
					'user.name',
					'user.handle',
					'date',
					'idTw',
					'url',
					'isRT',
					'rt.user.handle',
					'stars',
					'labels',
					'chapter',
					'archived',
					'deleted',
					'tagsTW',
					'mentions',
					'repliesTo.text',
					'repliesTo.id',
					'quoted.text',
					'quoted.id',
					'location.name',
					'location.id',
					'extra.likes',
					'extra.replies',
					'extra.retweets',
					'extra.quotes',
					'source',
					'internalLinks[0]',
					'internalLinks[1]',
					'internalLinks[2]',
					'internalLinks[3]',
					'externalLinks[0]',
					'externalLinks[1]',
					'externalLinks[2]',
					'externalLinks[3]',
					'media[0].mediaUrl',
					'media[1].mediaUrl',
					'media[2].mediaUrl',
					'media[3].mediaUrl'
				]
			});
		} catch (err) {
			return res.send('Error parsing CSV.\n\n' + err);
		}
	} else if (format == 'csv-basic') {
		format = 'csv';
		try {
			result = CSVParse(result, {
				fields: [
					'text',
					'user.handle',
					'date',
					'url',
					'isRT',
					'stars',
					'chapter',
					'archived',
					'deleted'
				]
			});
		} catch (err) {
			return res.send('Error parsing CSV.\n\n' + err);
		}
	}

	
	fs.writeFile(`public/${filename}.json`, result, () => {
		console.log('success');
	});

	// Download file
	// res.writeHead(200, {
	// 	'Content-Type': 'application/json-download',
	// 	"content-disposition": `attachment; filename="${filename}.${format}"`
	// });

	res.end(`<a href="http://archive.thefortyfifth.us/${filename}.json">http://archive.thefortyfifth.us/${filename}.json</a>`);
});


module.exports = router;