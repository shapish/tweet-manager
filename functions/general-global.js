/**
 * Helper functions available in back- and frontend
 */


// Manage query parameters
// Looks at all url query keys, throws out pagination
// and overwrites whatever is being passed.
// amp is option to return url query starting with '&'
function url(q, key, value, options) {
	const query = { ...q };
	const skipQm = options && options.skipQm ? options.skipQm : false ; // Skip question mark

	if (query.p) delete query.p;
	if (key && !value) {
		// Remove key when value is null
		delete query[key];
	} else if (key && value) {
		// Add key & value
		query[key] = value;
	}

	// If there's a month set but no year, add current year
	if (query.m && !query.y) query.y = new Date().getFullYear();

	let url = ''; // skipQm true = return starting with '&'
	for (const k in query) {
		url += (url == '' && !skipQm) ? '?' : '&';
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