const {padNr, linkURLs, linkUserNames} = {...require('./general-global'), ...require('./general')};


// Returns { years: [], months: [] }
function getDateNav() {
	const startDate = new Date('5-4-2009');
	const years = [startDate.getFullYear()];
	for (let year = startDate.getFullYear(); year <= new Date().getFullYear(); year++) {
		years.push(year);
	}
	const months = ['Jan', 'Jan', 'Feb', 'Mar',
		'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
		'Okt', 'Nov', 'Dec']; // Jan is double so 1=Jan
	
	return {
		years: years,
		months: months
	}
}


// Create sort query
function getSort(s) {
	return (s == 'chapter') || (s == '-chapter') ?
		s : s == 'date' ?
			'created_at' : '-created_at';
}


// Create pagination object
function Pg(p) {
	this._listPages = 30, // Page numbers visible
	this._pageSize = 10, // Results per page
	this.pageNumber = p ? parseInt(p) : 1,
	
	// Updated after db query:
	this.totalPages = 0,
	this.paginationStart = 0,
	this.paginationEnd = 0,

	// Update
	this.complete = (resultCount) => {
		// Pagination parameters B
		this.totalPages = Math.ceil(resultCount / this._pageSize);
		
		// Where the pagination begins and ends
		this.paginationStart = Math.floor(this.pageNumber / this._listPages) * this._listPages;
		this.paginationStart = this.paginationStart === 0 ? 1 : this.paginationStart;
		this.paginationEnd = Math.min(this.totalPages, this.paginationStart + this._listPages);
		
		// Adjust pagination start/end on first/last pages
		if (this.totalPages < this.paginationEnd || this.totalPages == this._listPages + 1) {
			this.paginationEnd = this.totalPages;
			this.paginationStart = this.totalPages - this._listPages;
		}
	}
}

function Search(query) {
	this.q = query.q;
	this.y = query.y;
	this.m = query.m;
	this.s = query.s;

	this.loose = []; // foo bar
	this.strict = []; // "foo bar"
	this.literal = []; // =foo bar=
	this.nonLiterals = []; // literal removed (loose + strict)
	
	// Organize search terms into loose/strict/literal arrays
	this.parseQuery();

	this.dbSearch = this.translateQuery();

}

// Break down query and return { loose, strict, literal } search terms
Search.prototype.parseQuery = function() {
	// RegEx formulas:
	const reStrict = /".*?"/gi; // Filter phrases wrapped in "quotes"
	const reLiteral = /=.*?=/gi; // Filter literals wrapped in =equal signs=

	// Catch strict terms ("like this" -> handled by Mongo)
	this.strict = this.q.match(reStrict);
	this.strict = this.strict ? this.strict.map(phrase => { return phrase.replace(/"/g, '') }) : [];

	// Catch literal terms (=like this= -> handled by regex)
	this.literal = this.q.match(reLiteral);
	this.literal = this.literal ? this.literal.map(str => { return str.replace(/=/g, '') }) : [];

	// Catch & trim loose words
	let step1 = this.q.split(reStrict); // Remove strict phrases
	let step2 = [];
	step1.forEach((chunk, i) => step2.push(...chunk.split(reLiteral))); // Remove literals
	this.loose = step2
		.map(word => word.trim()) // Trim whitespace 
		.join(' ').split(' ') // Split into separate words
		.filter(word => !!word.length); // Remove empty values
}


// Translate req.query to a database query
Search.prototype.translateQuery = function() {
	const query = {};

	// Separate loose, strict and literal search terms
	// const terms = parseQuery(q);

	if (this.q) _translateSearchQuery(q);
	if (this.y || this.m) _translateDateQuery(y, m);
	return query;

	


	// Adds to query:
	// $text: { $search: 'golf' },
	// text: { '$regex': /golf/, '$options': 'gi' }
	function _translateSearchQuery(q) {
		// // Catch non-literal terms (quoted and unquoted -> handled by Mongo)
		// let nonLiterals = q.split(/=\b.*?\b=/gi);
		// nonLiterals = nonLiterals.join(' ').split(' ').filter(word => !!word.length); // Remove empty spaces

		// // Catch literal terms (=like this= -> handled by regex)
		// let literals = q.match(/=\b.*?\b=/gi);
		// literals = literals ? literals.map(q => { return q.replace(/=/g, '') }) : [];

		// Assemble query parameters
		if (nonLiterals.length) {
			query.$text = { $search: nonLiterals.join(' ') };
		}
		if (literals.length) {
			const re = new RegExp(literals.join('|'));
			query.text = { $regex: re, $options: 'gi' };
		}
	}

	
	// Adds to query:
	// created_at: {
	// 	'$gte': '2020-05-01T00:00:00-04:00',
	// 	'$lt': '2020-06-01T00:00:00-04:00'
	// }
	function _translateDateQuery(y, m) {
		// Month & year query
		const today = new Date();
		const beginMonth = m ? m : 1;
		const endMonth = m ? (+m % 12) + 1 : 1;
		const beginYear = y ? y : today.getFullYear();
		const endYear = y ? 
			(m && +m < 12) ?
				y : +y + 1
			: +today.getFullYear() + 1;
		
			query.created_at = {
			$gte: moment(beginYear + '-' + padNr(beginMonth) + '-01').format(),
			$lt: moment(endYear + '-' + padNr(endMonth) + '-01').format()
		}
	}
}


// Link URLs and usernames
function linkText(tweets) {
	tweets = tweets.map(tweet => {
		tweet.text = linkURLs(tweet.text);
		tweet.text = linkUserNames(tweet.text);
		return tweet;
	});
}

// ## There is built-in MongoDB functionality that takes care of this:
// https://docs.atlas.mongodb.com/reference/atlas-search/highlighting/
function highlightText(tweets, q) {
	if (q) {
		const {queryStems, queryPhrases, regexWords, regexPhrases} = parseQueryOLD(q);
		
		// Add highlights
		tweets = tweets.map((tweet, i) => {
			if (queryStems.length) tweet.text = tweet.text.replace(regexWords, '<b>$1</b>');
			if (queryPhrases.length) tweet.text = tweet.text.replace(regexPhrases, '<b>$1</b>');
			return tweet;
		});

		// Remove highlight tags inside href
		tweets = tweets.map(tweet => {
			// Test: https://regex101.com/r/zrg4yp/1
			tweet.text = tweet.text.replace(/(href="[^"]*?)<\/?b>(?:([^"]*?)<\/?b>)?([^"]*")/ig, '$1$2$3');
			return tweet;
		});
	}
}


// Parses query and returns array of words and phrases
// plus regex formula to highlight both in search results.
/*
	Input: 'Jimmy loves bowling, "fluffy cats" and "cute dogs"'
	Output: {
		queryStems: ['Jimmy', 'loves', 'bowl', 'and'],
		queryPhrases: ['fluffy cats', 'cute dogs'],
		regexWords: /(\bJimmy|loves|bowl|and\w{0,3}\b)/gi, // --> selects all words beginining with stem that are up to 3 characters longer
		regexPhrases: /(fluffy cats|cute dogs)/gi // --> selects all phrases verbatim
	}
	This can be truned into highlight as follows:
	resultText = resultText.replace(regexWords, '<b>$0</b>');
	resultText = resultText.replace(queryPhrases, '<b>$0</b>');
*/
function parseQueryOLD(queryText) {
	// console.log('queryText: ', queryText);
	// Remove commas
	queryText = queryText.replace(/,/, '');
	
	// Remove phrases and return array with stemmed words
	const queryStems = _parseWords(queryText);

	// Isolate Phrases in separate array
	const queryPhrases = _parsePhrases(queryText);

	// Stem RegEx: /\bSTEM\w{0,3}\b/gi
	// => Find all words that begin with a stem and are up to three extra characters long (work --> working)
	const regexWords = new RegExp('(\\b' + queryStems.join('|') + '\\w{0,3}\\b)', 'gi');

	// Find all partial exact matches
	const regexPartials = new RegExp('(' + queryStems.join('|') + ')', 'gi');	

	// Stem RegEx: /PHRASE1|PHRASE2/gi
	const regexPhrases = new RegExp('('+queryPhrases.join('|')+')', 'gi');

	return {
		queryStems: queryStems,
		queryPhrases: queryPhrases,
		regexWords: regexWords,
		regexPartials: regexPartials,
		regexPhrases: regexPhrases
	}

	
	function _parseWords(queryText) {
		// Remove quoted phrases from query
		let queryWords = queryText.split(/".*?"/g) || [];
		// Split remaining query words into array and remove empty spaces
		queryWords = queryWords.join(' ').split(' ').filter(word => !!word.length);
		// Poor man stemming
		return queryWords.map(word => word.replace(/(ing|s|ly|sy)\b/, ''));
		console.log('queryWords: ', queryWords);
	}

	function _parsePhrases(queryText) {
		// Isolate quoted phrases
		// let queryPhrases = queryText.match(/(")(?:(?=(\\?))\2.)*?\1/g) || []; // Solution from internet but seems unnecessary opaque
		let queryPhrases = queryText.match(/"\b.*?\b"/gi) || [];
		// Remove quotes from phrases
		return queryPhrases.map(phrase => phrase.replace(/"/g, ''));
	}
}




exports.getDateNav = getDateNav;
exports.getSort = getSort;
exports.Pg = Pg;
// exports.translateQuery = translateQuery;
exports.linkText = linkText;
exports.highlightText = highlightText;
exports.Search = Search;

exports.parseQueryOLD = parseQueryOLD; // TEMP
