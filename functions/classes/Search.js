const moment = require('moment');
const {padNr} = require('../general-global');


/**	
 *	Handles all the search logic
 * 
 *	Search Hierarchy:
 *	- - - - - - - - -
 *	1. STRICT: "Quoted phrases" (Handled by Mongoose)
 *		-> Non-stemmed search on exact words, filters stop words
 *		-> Does not return partials (half words)
 *		-> In combination, amounts to AND search: "terrible" "president"
 *	2. LOOSE: Unquoted words (Handled by Mongoose)
 *		-> Stemmed search, filters stop words
 *		-> Does not return partials (half words)
 *		-> In combination, amounts to OR search: terrible president
 *	3. LITERAL: =verbatim search= (Handled by regex)
 *		-> Exact search, unfiltered
 *		-> Returns partials
 *		-> In combination, runs as OR search: =errible= =esident=
 *	
 *	Combining different search types
 *	- - - - - - - - - - - - - - - - -
 *	A. Quoted phrase + unquoted words
 *		-> Quoted phrase defines results
 *		-> Unquoted words influende the relevance order, but no extra results
 *	B. Quotes/unquoted query + literal
 *		-> Returns the literal query within the results of the regular query
 **/

function Search(query) {
	// Query, Sort, Page, Type, Year, Month, Starred, Labeled, Assigned, Archived
	const {q, s, y, m} = query;
	this.query = query;

	// Organize search terms into loose/strict/literal arrays
	this.terms = this.parseQuery(q);
	// console.log('query: ', this.query);
	// console.log('terms: ', this.terms);

	// Construct db search parameters
	const searchParams = this.translateQuery(this.terms, q, y, m);

	// Get sort parameters
	const sort = this.getSort(s);

	return {
		search: this,
		terms: this.terms,
		searchParams: searchParams,
		sort: sort
	}
}


// Break down query and return { loose, strict, literal } search terms
Search.prototype.parseQuery = function(q) {
	const terms = {
		loose: [], // working people
		looseStems: [], // work people
		strict: [], // "work people"
		literal: [], // =work people=
		labelsOR: [], // #work #people
		labelsAND: [], // #work! #people!
		regexQuery: null // /work(?:ing)? p[eo]ple/
	}

	if (!q) return terms;

	// RegEx formulas:
	const reLiteral = /=.*?=/g; // Filter literals wrapped in =equal signs=
	const reStrict = /".*?"/g; // Filter phrases wrapped in "quotes"
	const reLabelAND = /#\b\S+\b!/g; // Filter labels preceded by #hashtag! and ending with #exclamation!
	const reLabelOR = /#\b\S+\b(?!!)/g; // Filter labels preceded by #hashtag not ending with exclamation
	const reRegEx = /^\/(.*)\/([gmixXsuUAJD]{0,11}$)/; // Detects regex search

	if (q.match(reRegEx)) {
		// If a regex is passed, we'll ignore all the rest
		terms.regexQuery = new RegExp(q.replace(reRegEx, '($1)'), q.replace(reRegEx, '$2'));
	} else {
		// Catch literal terms (=like this= -> handled by regex)
		terms.literal = q.match(reLiteral);
		terms.literal = terms.literal ? terms.literal.map(str => { return str.replace(/=/g, '') }) : [];
		q = q.replace(reLiteral, '');

		// Catch strict terms ("like this" -> handled by Mongo)
		terms.strict = q.match(reStrict);
		terms.strict = terms.strict ? terms.strict.map(phrase => { return phrase.replace(/"/g, '') }) : [];
		q = q.replace(reStrict, '');

		// Catch AND labels (#like-this! -> handled by regex)
		terms.labelsAND = q.match(reLabelAND);
		terms.labelsAND = terms.labelsAND ? terms.labelsAND.map(label => { return label.replace(/^#(.+)!$/, '$1') }) : []; // ## This should be made consistent to however we pasre the labels
		q = q.replace(reLabelAND, '');
		
		// Catch OR labels (#like-this -> handled by regex)
		terms.labelsOR = q.match(reLabelOR);
		terms.labelsOR = terms.labelsOR ? terms.labelsOR.map(label => { return label.replace(/^#/, '') }) : [];
		q = q.replace(reLabelOR, '');

		// terms.loose = step4
		terms.loose = q.split(' ')
			.map(word => word.trim()) // Trim whitespace 
			.join(' ').split(' ') // Split into separate words
			.filter(word => !!word.length); // Remove empty values

		// Create stems: slice off (ing|s|ly|sy) if result is > 2 characters
		// https://regex101.com/r/rLxSFZ/1
		terms.looseStems = terms.loose.map(word => word.replace(/(?<!\b\w)(ing|s|ly|sy)\b/, ''));
	}

	return terms;
};


// Translate req.query to a database query
Search.prototype.translateQuery = function(terms) {
	const {q, t, y, m, st, la, as, ar, dl} = this.query;

	const searchParams = {};
	if (q) _filterSearch(searchParams);
	if (y || m) _filterDate(searchParams, y, m);
	if (t || st || la || as || ar != 1 || dl != 1) _filterGeneral(searchParams);



	// DISABLED:
	// // In case regular search returns nothing, we try for a literal search 
	// let backupParams = null;
	// if (!terms.literal.length && (terms.strict.length || terms.loose.length)) backupParams =  _setBackupParams();
	// console.log('backupParams: ', backupParams);
	
	return searchParams;


	// The easy filters
	function _filterGeneral(searchParams) {
		if (t)	searchParams.isRT = (t == 'og') ? false : true;
		if (st) searchParams.stars = (st == 'all') ? { $gte: 1 } : st;
		if (la) searchParams.labels = (la == 1) ? { $not: { $size: 0 } } : { $size: 0 };
		if (as) searchParams.chapter = (as == 1) ? { $ne: null } : null;
		if (ar != 1) searchParams.archived = (ar == -1) ? true : false;
		if (dl != 1) searchParams.deleted = (dl == -1) ? true : false;
	}

	// Adds to query:
	// $text: { $search: 'golf' },
	// text: { '$regex': /golf/, '$options': 'gi' }
	function _filterSearch(searchParams) {
		// RegEx -> Assemble $regex and ignore loose/strict/literal
		if (terms.regexQuery) {
			searchParams.text = { $regex: terms.regexQuery };
			return;
		}

		// Strict / Loose -> Assemble $search parameters
		if (terms.strict.length || terms.loose.length) {
			let query = terms.strict.length ? '"' + terms.strict.join('" "') + '"' : '';
			query += terms.loose.length ? (terms.strict.length ? ' ' : '') + terms.loose.join(' ') : '';
			searchParams.$text = { $search: query };
		}
		
		// Literal -> Assemble $regex parameters
		if (terms.literal.length) {
			const re = new RegExp(terms.literal.join('|'));
			searchParams.text = { $regex: re, $options: 'gi' };
		}

		// // OR Labels -> assemble label search parameters
		if (terms.labelsOR.length) {
			searchParams.labels = { $in: terms.labelsOR }
		}

		// AND Labels -> assemble label search parameters
		if (terms.labelsAND.length) {
			const conditions = terms.labelsAND.map(label => {
				return {
					labels: label
				};
			});
			searchParams.$and = conditions;
		}
	}


	
	// Adds to query:
	// created_at: {
	// 	'$gte': '2020-05-01T00:00:00-04:00',
	// 	'$lt': '2020-06-01T00:00:00-04:00'
	// }
	function _filterDate(searchParams, y, m) {
		// Month & year query
		const today = new Date();
		const beginMonth = m ? m : 1;
		const endMonth = m ? (+m % 12) + 1 : 1;
		const beginYear = y ? y : today.getFullYear();
		const endYear = y ? 
			(m && +m < 12) ?
				y : +y + 1
			: +today.getFullYear() + 1;
		
		// Assemble created_at parameter
		searchParams.created_at = {
			$gte: moment(beginYear + '-' + padNr(beginMonth) + '-01').format(),
			$lt: moment(endYear + '-' + padNr(endMonth) + '-01').format()
		}
	}

	// NOT USED
	// function _setBackupParams() {
	// 	let query = terms.strict.length ? terms.strict.join('|') : '';
	// 	query += terms.loose.length ? (terms.strict.length ? '|' : '') + terms.loose.join('|') : '';
	// 	const re = new RegExp(query);
	// 	return { $regex: re, $options: 'gi' };
	// }
};


// Create sort query
Search.prototype.getSort = function(s) {
	return (s == 'chapter') || (s == '-chapter') ?
		s : s == 'date' ?
			'created_at' : '-created_at';
};


// Highlight matching text
Search.prototype.highlightText = function(tweets) {
	// There is built-in MongoDB functionality that takes care of this,
	// but $search doesn't seem to be implemented in Mongoose
	// https://docs.atlas.mongodb.com/reference/atlas-search/highlighting/
	if (!this.terms) return;
	const {looseStems, strict, literal, regexQuery} = this.terms;

	// RegEx Loose stems: /\bSTEM\w{0,3}\b/gi
	// -> Find all words that begin with a stem and are up to three extra characters long (eg. work -> working)
	const regexLoose = new RegExp('(\\b' + looseStems.join('|') + '\\w{0,3}\\b)', 'gi');

	// RegEx Strict: /PHRASE1|PHRASE2/gi
	const regexStrict = new RegExp('(' + strict.join('|') + ')', 'gi');

	// RegEx Literal: /(literal|literal)/gi
	// First clean out regex special characters or it can break the html
	let cleanLiteral = literal.map(str => str.replace(/[\/^$?.*{}\][]/gi, ''));
	const regexLiteral = new RegExp('(' + cleanLiteral.join('|') + ')', 'gi');
	
	// Add highlights
	tweets = tweets.map((tweet, i) => {
		if (strict.length) tweet.text = tweet.text.replace(regexStrict, '<b>$1</b>');
		if (looseStems.length) tweet.text = tweet.text.replace(regexLoose, '<b>$1</b>');
		if (literal.length) tweet.text = tweet.text.replace(regexLiteral, '<em>$1</em>');
		if (regexQuery) tweet.text = tweet.text.replace(regexQuery, '<em>$1</em>'); // This can break html, eg with /\ba.*r\b/
		return tweet;
	});

	// Clean up
	tweets = tweets.map(tweet => {
		// Remove any <b> tags inside href: https://regex101.com/r/zrg4yp/1
		tweet.text = tweet.text.replace(/(href="[^"]*?)<\/?b>(?:([^"]*?)<\/?b>)?([^"]*")/ig, '$1$2$3');

		// Disabled because instead we switched to <em> for literals
		// Remove any <b> tags from within other <b> tags: https://regex101.com/r/bdF6BI/1
		// tweet.text = tweet.text.replace(/(<b>[^<>]*)<b>([^"]*?)<\/b>([^<>]*<\/b>)/ig, '$1$2$3');

		return tweet;
	});
};


module.exports = Search;