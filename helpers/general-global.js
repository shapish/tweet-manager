/**
 * Helper functions available in back- and frontend
 */


// Manage query parameters
// Looks at all url query keys, throws out pagination
// and overwrites whatever is being passed.
// amp is option to return url query starting with '&'
function url(query, key, value, keepPagination) {
	// Close query object
	query = { ...query };

	if (key && !value) {
		// Remove key when value is null
		delete query[key];
	} else if (key && value) {
		// Add/replace key & value
		query[key] = value;
	}

	let url = ''; // skipQm true = return starting with '&'
	for (const k in query) {
		url += (url == '') ? '?' : '&';
		url += (k + '=' + query[k]);
	}
	
	return url;
}


// Turn numbers into comma numbers
function prettyNr(x) {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


// Pad numbers with zero
function padNr(n, width) {
	width = width ? width : 2;
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(0) + n;
}


exports.padNr = padNr;
exports.prettyNr = prettyNr;
exports.url = url;