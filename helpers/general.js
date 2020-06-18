const fs = require('fs');

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
function pathEncode(text) {
	return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[^\w-]/g, '');
	// return title.toLowerCase().trim().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[?#<>\\\/.,!:`~^;''""=\[\]\(\)]/g, '');
}


/**
 * Returns date that's a set time in the future
 * @param {String} interval Number + unit: 3y / 3mo / 3w / 3d / 3h / 3m / 3s – default: 1y
 */
function laterDate(interval) {
	const parsed = interval.match(/(^\d+)([ywdhms]{1}((?<=m)(o{0,1})|))$/);
	interval = parsed && parsed[1] ? +parsed[1] : 1; // Number
	const unit = parsed && parsed[2] ? parsed[2] : 'y'; // y/mo/w/d/h/m/s
	const laterDate = new Date();
	
	switch (unit) {
		case  'y':
			laterDate.setFullYear(laterDate.getFullYear() + interval);
			break;
		case 'mo':
			laterDate.setMonth(laterDate.getMonth() + interval);
			break;
		case 'w':
			laterDate.setHours(laterDate.getHours() + interval * 24 * 7);
			break;
		case 'd':
			laterDate.setDate(laterDate.getDate() + interval);
			break;
		case 'h':
			laterDate.setHours(laterDate.getHours() + interval);
			break;
		case 'm':
			laterDate.setMinutes(laterDate.getMinutes() + interval);
			break;
		case 's':
			laterDate.setSeconds(laterDate.getSeconds() + interval);
			break;
	} 
	
	return laterDate;
}

// Promisyfied timeout
function timeout(time) {
	return new Promise((resolve) => {
		setTimeout(resolve, time)
	})
}


// Stringify URL parameters
function queryString(params) {
	// Remove empty values
	for (let key in params) { if (!params[key]) delete params[key] }
	// Parse the rest
	return Object.keys(params).map(key => key + '=' + params[key]).join('&');
}


function padNr(n, width) {
	width = width ? width : 2;
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(0) + n;
}


// Return formatted time
function getTime(date, us) {
	date = date ? new Date(date) : new Date();
	let time;
	if (us) {
		ampm = date.getHours() < 12 ? ' AM' : ' PM';
		let hours = date.getHours() % 12;
		hours = hours ? hours : 12;
		time = hours + ':' + padNr(date.getMinutes()) +  ampm;
	} else {
		time = date.getHours() + ':'+ padNr(date.getMinutes());
	}
	return time;
}


// Return formatted date
// Type 1/2/3 = short, medium, long
function getDate(date, type) {
	date = date ? new Date(date) : new Date();
	type = type ? type : 2; // 1-2-3
	const monthsLong =  ['January','February','March','April','May','June','July','August','September','October','November','December'];
	const monthsShort =  ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const months = type == 2 ? monthsShort : type == 3 ? monthsLong : null;

	if (type == 1) {
		// 1: 01-05-20
		return padNr(date.getMonth()) + '-' + padNr(date.getDate()) + '-' + String(date.getFullYear()).slice(2);
	} else {
		// 2: Jan 5, 2020
		// 3: January 5, 2020
		return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
	}
}


/**
 * Write data to file
 * https://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node/43370201#43370201
 */
function writeToFile(filename, data, options) {
	filename = filename ? filename : 'dump';
	options = options ? options : {};
	const format = options.format ? options.format : 'txt';
	const content = Array.isArray(data) ? data.join('\n') + '\n' : typeof data == 'string' ? data : String(data);
	fs.appendFile(`public/logs/${filename}.${format}`, content, function (err) {
		if (err) throw err;
	});
}


module.exports = { removeDupDocs, compareArrays, linkURLs, linkUserNames,
	pathEncode, laterDate: laterDate, timeout, queryString, padNr, getTime,
	getDate, writeToFile }