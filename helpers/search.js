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


// // Link URLs and @usernames in plain text
// function linkText(tweets) {
// 	tweets = tweets.map(tweet => {
// 		tweet.plainText = tweet.text;
// 		tweet.text = linkURLs(tweet.text);
// 		tweet.text = linkUserNames(tweet.text);

// 		tweet.repliesTo.text = linkURLs(tweet.repliesTo.text, true);
// 		tweet.repliesTo.text = linkUserNames(tweet.repliesTo.text, true);

// 		tweet.quoted.text = linkURLs(tweet.quoted.text, true);
// 		tweet.quoted.text = linkUserNames(tweet.quoted.text, true);
// 		return tweet;
// 	});
// }

module.exports = { getDateNav }
