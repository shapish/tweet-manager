/**
 * Helper functions available  only in backend
 */


// Remove duplicate documents from results array	
function removeDupDocs(docArr) {
	for (let i=0; i<docArr.length; i++) {
		for (let j=i+1; j<docArr.length; ++j) {
			if (String(docArr[i]._id) == String(docArr[j]._id)) {
				docArr.splice(j--, 1);
			}
		}
	}
	return docArr;
};


// // UNUSED
// // Remove duplicate values from array	
// function removeDups(arr) {
// 	for (let i=0; i<arr.length; i++) {
// 		for (let j=i+1; j<arr.length; ++j) {
// 			if (arr[i] == arr[j]) {
// 				arr.splice(j--, 1);
// 			}
// 		}
// 	}
// 	return arr;
// };


// Compare two arrays and return the difference
function compareArrays(arr1, arr2) {
	const diff1 = [];
	const diff2 = [];
	arr1.forEach(val => {
		// Save any value that's not in arr2
		if (!arr2.includes(val)) diff1.push(val);
	});
	arr2.forEach(val => {
		// Save any value that's not in arr1
		if (!arr1.includes(val)) diff2.push(val);
	});
	const diff = diff1.concat(diff2);

	return {
		diff: diff,
		diff1: diff1,
		diff2: diff2,
	};
}

// Parses query and returns array of words and phrases
// plus regex formula to highlight both in seaerch results.
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
function parseQuery(queryText) {
	// Remove commas
	queryText = queryText.replace(/,/, '');
	
	// Remove phrases and return array with stemmed words
	const queryStems = _parseWords(queryText);

	// Isolate Phrases in separate array
	const queryPhrases = _parsePhrases(queryText);

	// Stem RegEx: /\bSTEM\w{0,3}\b/gi
	// => Find all words that begin with a stem and are up to three extra characters long (work --> working)
	const regexWords = new RegExp('(\\b' + queryStems.join('|') + '\\w{0,3}\\b)', 'gi');

	// Stem RegEx: /PHRASE1|PHRASE2/gi
	const regexPhrases = new RegExp('('+queryPhrases.join('|')+')', 'gi');

	return {
		queryStems: queryStems,
		queryPhrases: queryPhrases,
		regexWords: regexWords,
		regexPhrases: regexPhrases
	}

	
	function _parseWords(queryText) {
		// Remove quoted phrases
		let queryWords = queryText.split(/(["])(?:(?=(\\?))\2.)*?\1/g) || [];
		// Remove spaces and double quotes
		queryWords = queryWords
			.map(str => { return str.trim() })
			.filter((str, i) => {
				queryWords[i] = 'a';
				return !!str.replace(/"/g, '').trim().length;
			});
		// Split every remaining query word
		var tmp = [...queryWords];
		queryWords = [];
		tmp.forEach(str => {
			queryWords = queryWords.concat(str.split(' '));
		});
		// Poor man stemming
		return queryWords.map(word => word.replace(/(ing|s)\b/, ''));
	}

	function _parsePhrases(queryText) {
		// Isolate quoted phrases
		let queryPhrases = queryText.match(/(")(?:(?=(\\?))\2.)*?\1/g) || [];
		// Remove quotes from phrases
		return queryPhrases.map(phrase => phrase.replace(/"/g, ''));
	}
}


// Wrap http links in <a>
// Source: https://gist.github.com/ryansmith94/0fb9f6042c1e0af0d74f
function linkURLs(text, newWindow) {
	var urlPattern = /(?:(?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\x{00a1}\-\x{ffff}0-9]+-?)*[a-z\x{00a1}\-\x{ffff}0-9]+)(?:\.(?:[a-z\x{00a1}\-\x{ffff}0-9]+-?)*[a-z\x{00a1}\-\x{ffff}0-9]+)*(?:\.(?:[a-z\x{00a1}\-\x{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?/ig;
	var target = (newWindow === true || newWindow == null) ? '_blank' : '';

	return text.replace(urlPattern, function (url) {
		var protocolPattern = /^(?:(?:https?|ftp):\/\/)/i;
		var href = protocolPattern.test(url) ? url : 'http://' + url;
		return '<a href="' + href + '" target="' + target + '">' + url + '</a>';
	});
};

// Wrap twitter usernames in in <a>
function linkUserNames(text) {
	return text.replace(/(^|[^@\w])@(\w{1,15})\b/gi, '$1<a target="_blank" href="https://twitter.com/$2">@$2</a>');
}






exports.removeDupDocs = removeDupDocs;
exports.compareArrays = compareArrays;
exports.parseQuery = parseQuery;
exports.linkURLs = linkURLs;
exports.linkUserNames = linkUserNames;