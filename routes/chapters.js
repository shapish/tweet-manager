// Modules
const express = require('express');
const router = express.Router();
const logger = require('../helpers/logger');
const ejs = require('ejs');

// Models
const Chapter = require('../models/chapter');
const { User } = require('../models/user');

// Middleware & functions
const {auth} = require('../middleware/auth');
const {url} = require('../functions/general-global');

// Shared
const stages = ['Proposed', 'Assigned', 'Review', 'Revise', 'Approved', 'Locked', 'Proofed'];




// Chapters
router.get('/', auth, async (req, res) => {
	display(req, res)
});


// Sort
router.post('/s/:sort', auth, async (req, res) => {
	if (req.params.sort == 'index') {
		delete req.query.s;
	} else {
		req.query.s = req.params.sort;
	}
	req.renderFile = true;
	display(req, res);
});


// Filter
router.post('/filter/:filter/:value', auth, async (req, res) => {
	let {filter, value} = req.params;
	req.query[filter] = value.toLowerCase();
	req.renderFile = true;
	display(req, res);
});


// Render page
async function display(req, res) {
	// Parse sort
	const sort = 
		!req.query.s ? 'sortIndex' : 
		req.query.s == '-index' ? '-sortIndex' :
		req.query.s == 'tweets' ? 'tweetCount sortIndex' :
		req.query.s == '-tweets' ? '-tweetCount sortIndex' :
		req.query.s == 'wordcount' ? 'wordCount sortIndex' :
		req.query.s == '-wordcount' ? '-wordCount sortIndex' :
		req.query.s + ' sortIndex';

	// Parse filter
	const match = {};
	if (req.query.type == '*') {
		delete req.query.type;
	} else if (req.query.type) {
		match.type = req.query.type.charAt(0).toUpperCase() + req.query.type.slice(1);
	}
	if (req.query.writer == '*') {
		delete req.query.writer;
	} else if (req.query.writer) {
		match['writer.path'] = req.query.writer;
	}
	if (req.query.stage == '*') {
		delete req.query.stage;
	} else if (req.query.stage) {
		match.stage = +req.query.stage;
	}

	// Look up chapters
	// Using aggregate so we can sort by tweet count
	// const chapters = await Chapter.find().sort(sort);
	const chapters = await Chapter.aggregate([
		{ $project: {
			title: 1,
			path: 1,
			index: 1,
			sortIndex: 1,
			description: 1,
			tweets: 1,
			tweetsCount: { $size: '$tweets' },
			wordCount: 1,
			type: 1,
			writer: 1,
			stage: 1,
		}},
		{ $match: match}
	]).sort(sort);
	
	// Parse list of writers
	const writers = await User.find().select('name path');
	
	// Data required to render page
	const data = {
		chapters: chapters,
		writers: writers,
		stages: stages,
		query: req.query,
		sel: _getSelClass(req.query),
		user: req.user
	};

	if (req.renderFile) {
		// Render table data
		let html = '';
		const renderData = { ...data, ...req.app.locals };
		ejs.renderFile('views/chapters--table.ejs', renderData, (err, str) => {
			if (err) {
				logger.error('Error rendering table data', err);
			} else {
				html += str;
			}
		});
		res.send({
			html: html,
			urlQuery: url(req.query, null, null, req.keepPagination)
		});
	} else {
		// Load page
		return res.render('chapters', data);
	}

	// Set UI selection states for each link
	function _getSelClass(query) {
		return {
			// Sort
			index: !query.s ? 'sort' : query.s == '-index' ? 'sort dec' : '',
			title: query.s == 'title' ? 'sort' : query.s == '-title' ? 'sort dec' : '',
			tweets: query.s == 'tweets' ? 'sort' : query.s == '-tweets' ? 'sort dec' : '',
			type: query.s == 'type' ? 'sort' : query.s == '-type' ? 'sort dec' : '',
			writer: query.s == 'writer' ? 'sort' : query.s == '-writer' ? 'sort dec' : '',
			wordCount: query.s == 'wordcount' ? 'sort' : query.s == '-wordcount' ? 'sort dec' : '',
			stage: query.s == 'stage' ? 'sort' : query.s == '-stage' ? 'sort dec' : ''
		}
	}
}












// Chapters Index
router.get('/index', auth, async (req, res) => {
	const chapters = await Chapter.find().sort('sortIndex');

	return res.render('chapter-index', {
		chapters: chapters,
		user: req.user
	});
});



// Chapter Detail
router.get('/:path', auth, async (req, res) => {
	// Parse current chapter
	const chapter = await Chapter.findOne({
		path: req.params.path
	});
	if (!chapter) return res.redirect('/chapters');

	// Parse previous and next chapters
	let prevNext = [];
	const allChapters = await Chapter.find().select('index title path').sort('sortIndex');
	allChapters.forEach((chap, i) => {
		if (String(chap._id) == String(chapter._id)) {
			const prev = allChapters[i-1];
			const next = allChapters[i+1];
			prevNext.push(prev ? prev : null);
			prevNext.push(next ? next : null);
		}
	});

	// Parse list of writers
	const writers = await User.find().select('name');

	return res.render('chapter-detail', {
		user: req.user,
		chapter: chapter,
		prevNext: prevNext,
		writers: writers,
		stages: stages
	});
});


module.exports = router;