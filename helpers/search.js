// Modules
const {linkURLs, linkUserNames} = require('./general');



// Returns years and months to be show in navigation
// { years: [], months: [] }
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


// Link URLs and @usernames in plain text
function linkText(tweets) {
	tweets = tweets.map(tweet => {
		tweet.plainText = tweet.text;
		tweet.text = linkURLs(tweet.text);
		tweet.text = linkUserNames(tweet.text);

		tweet.repliesTo.text = linkURLs(tweet.repliesTo.text, true);
		tweet.repliesTo.text = linkUserNames(tweet.repliesTo.text, true);

		tweet.quoted.text = linkURLs(tweet.quoted.text, true);
		tweet.quoted.text = linkUserNames(tweet.quoted.text, true);
		return tweet;
	});
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
// function parseQueryOLD(queryText) {
// 	// console.log('queryText: ', queryText);
// 	// Remove commas
// 	queryText = queryText.replace(/,/, '');
	
// 	// Remove phrases and return array with stemmed words
// 	const queryStems = _parseWords(queryText);

// 	// Isolate Phrases in separate array
// 	const queryPhrases = _parsePhrases(queryText);

// 	// Stem RegEx: /\bSTEM\w{0,3}\b/gi
// 	// => Find all words that begin with a stem and are up to three extra characters long (work --> working)
// 	const regexWords = new RegExp('(\\b' + queryStems.join('|') + '\\w{0,3}\\b)', 'gi');

// 	// Find all partial exact matches
// 	const regexPartials = new RegExp('(' + queryStems.join('|') + ')', 'gi');	

// 	// Stem RegEx: /PHRASE1|PHRASE2/gi
// 	const regexPhrases = new RegExp('('+queryPhrases.join('|')+')', 'gi');

// 	return {
// 		queryStems: queryStems,
// 		queryPhrases: queryPhrases,
// 		regexWords: regexWords,
// 		regexPartials: regexPartials,
// 		regexPhrases: regexPhrases
// 	}

	
// 	function _parseWords(queryText) {
// 		// Remove quoted phrases from query
// 		let queryWords = queryText.split(/".*?"/g) || [];
// 		// Split remaining query words into array and remove empty spaces
// 		queryWords = queryWords.join(' ').split(' ').filter(word => !!word.length);
// 		// Poor man stemming
// 		return queryWords.map(word => word.replace(/(ing|s|ly|sy)\b/, ''));
// 	}

// 	function _parsePhrases(queryText) {
// 		// Isolate quoted phrases
// 		// let queryPhrases = queryText.match(/(")(?:(?=(\\?))\2.)*?\1/g) || []; // Solution from internet but seems unnecessary opaque
// 		let queryPhrases = queryText.match(/"\b.*?\b"/gi) || [];
// 		// Remove quotes from phrases
// 		return queryPhrases.map(phrase => phrase.replace(/"/g, ''));
// 	}
// }




exports.getDateNav = getDateNav;
exports.linkText = linkText;
// exports.parseQueryOLD = parseQueryOLD; // TEMP
