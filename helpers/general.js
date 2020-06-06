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


/**
 * Wrap http links in <a>
 * Source: https://gist.github.com/ryansmith94/0fb9f6042c1e0af0d74f
 * @param {*} text Text to be parsed (required)
 * @param {*} fake Create fake span links (default: false)
 */
function linkURLs(text, fake) {
	if (!text) return;
	const urlPattern = /(?:(?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\x{00a1}\-\x{ffff}0-9]+-?)*[a-z\x{00a1}\-\x{ffff}0-9]+)(?:\.(?:[a-z\x{00a1}\-\x{ffff}0-9]+-?)*[a-z\x{00a1}\-\x{ffff}0-9]+)*(?:\.(?:[a-z\x{00a1}\-\x{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?/ig;

	return text.replace(urlPattern, function (url) {
		const protocolPattern = /^(?:(?:https?|ftp):\/\/)/i;
		const href = protocolPattern.test(url) ? url : 'http://' + url;
		if (fake) {
			return '<span class="link color" href="' + href + '">' + url + '</span>';
		} else {
			return '<a href="' + href + '" target="_blank">' + url + '</a>';
		}
	});
};

/**
 * Wrap twitter usernames in in <a>
 * @param {*} text Text to be parsed (required)
 * @param {*} fake Create fake span links (default: false)
 */
function linkUserNames(text, fake) {
	if (!text) return false;
	if (fake) {
		return text.replace(/(^|[^@\w])@(\w{1,15})\b/gi, '$1<span class="link color" href="https://twitter.com/$2">@$2</span>');
	} else {
		return text.replace(/(^|[^@\w])@(\w{1,15})\b/gi, '$1<a target="_blank" href="https://twitter.com/$2">@$2</a>');
	}
}


// Create url path from Title
function createPath(title) {
	return title.toLowerCase().trim().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[^\w-]/g, '');
	// return title.toLowerCase().trim().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[?#<>\\\/.,!:`~^;''""=\[\]\(\)]/g, '');
}


// Create date 2 years into the future for cookies to expire
function cookieDate(y) {
	y = y ? y : 2;
	const CookieDate = new Date;
	CookieDate.setFullYear(CookieDate.getFullYear() + y);
	return CookieDate;
}

// Promisyfied timeout
function timeout(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    })
}


// Stringify URL parameters
function queryString(params) {
	return Object.keys(params).map(key => key + '=' + params[key]).join('&');
}


module.exports = { removeDupDocs, compareArrays, linkURLs, linkUserNames, createPath, cookieDate, timeout, queryString }