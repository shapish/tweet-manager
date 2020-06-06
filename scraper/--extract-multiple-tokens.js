const moment = require('moment-timezone');
const request = require('./request');
const { extractUrls, extractHashtags, extractMentions } = require('twitter-text');
const he = require('he');

// Twitter authentication
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const chromeUserAgents = [
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' },
	{ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36' }
];

let _cachedGuestTokens = [];
let _tokensCount = 30;
let _tokenIndex = 0;

/**
 * Extracts data from a Twitter tweet ID
 * @param {string} id Twitter IDx
 */
async function extract(id) {
	const tweet = await _fetchTweet(id);
	if (tweet.errors) {
		return tweet;
	}
	
	// Tags, mentions (parse)
	const _text = he.decode(tweet.full_text);
	tweet.tags = extractHashtags(_text);
	tweet.mentions = extractMentions(_text);

	// links (simplify)
	let links = { internal: [], external: [] };
	if (tweet.entities.urls) {
		links = tweet.entities.urls.forEach(link => {
			if (link.expanded_url.match(/\/status\/([\d]+)/)) {
				links.internal.push(link.expanded_url);
			} else {
				links.external.push(link.expanded_url);
			}
		});
	}
	tweet.links = links;

	// Media (simplify)
	let media;
	if (tweet.entities.media) {
		media = tweet.entities.media.forEach(m => {
			return {
				id: m.id_str,
				media_url: m.media_url,
				url: m.url,
				type: m.type, // Note: tweets are videos with type:image
				size: m.original_info
			}
		});
	}
	tweet.media = media;

	// Source (parse)
	tweet.source = tweet.source.match(/">(.+)<\//)[1];

	// Clean – remove this if you need to access more data
	delete tweet.entities
	delete tweet.card

	return tweet;
}



// Fetch tweet data object from Twitter API
async function _fetchTweet(id) {
	if (!_cachedGuestTokens[_tokenIndex]) {
		await updateCachedGuestToken(_tokenIndex);
		_tokenIndex++;
	}
	console.log('_cachedGuestTokens: ', _cachedGuestTokens);

	const authOptions = {
		headers: {
			authorization: `Bearer ${BEARER_TOKEN}`,
			Referrer: `https://twitter.com/realDonaldTrump/status/${id}`,
			'x-csrf-token': 'undefined',
			'x-guest-token': _cachedGuestTokens[_tokenIndex],
			'x-twitter-client-language': 'en',
			...chromeUserAgents[_tokenIndex]
		}
	}
	
	let params = {
		tweet_mode: 'extended', // To get non-truncated full_text
		include_reply_count: 1,
		simple_quoted_tweet: true,
		include_quote_count: true,
		include_cards: 1, // Polls A
		cards_platform: 'Web-12', // Polls B

		// Ful range of opions:
		// - - - -
		// include_profile_interstitial_type: 1,
		// include_blocking: 1,
		// include_blocked_by: 1,
		// include_followed_by: 1,
		// include_want_retweets: 1,
		// include_mute_edge: 1,
		// include_can_dm: 1,
		// include_can_media_tag: 1,
		// skip_status: 1,
		// include_ext_alt_text: true,
		// include_entities: true,
		// include_user_entities: true,
		// include_ext_media_color: true,
		// include_ext_media_availability: true,
		// send_error_codes: true,
		// count: 20,
		// ext: 'mediaStats%2ChighlightedLabel%2CcameraMoment',
	}
	
	params = queryString(params);
	let response;
	try {
		response = await request.json(`https://api.twitter.com/2/timeline/conversation/${id}.json?${params}`, authOptions);
	}
	catch {
		response = {"errors":[{"message":"Failed to connect to Twitter","code":1}]};
	}
	if (response.errors) return response;
	
	const tweet = response.globalObjects.tweets[id];
	// Sometimes there's an empty data object for deleted tweets, so we mimic native error
	if (!tweet) return {"errors":[{"message":"Scraper error, empty data","code":0}]};

	const userId = tweet.user_id_str;
	const user = response.globalObjects.users[userId];
	const { name, screen_name, location, description, profile_image_url_https } = user;
	tweet.user = { name, screen_name, location, description, profile_image_url_https };
	return tweet;
}



// Get guest token to access Twitter API
async function updateCachedGuestToken(_tokenIndex, bearerToken=BEARER_TOKEN) {
	_cachedGuestTokens[_tokenIndex] = await getGuestToken(bearerToken, _tokenIndex);
}
async function getGuestToken(token, _tokenIndex) {
	const guestTokenResponse = await request('https://api.twitter.com/1.1/guest/activate.json',
		{
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, ...chromeUserAgents[_tokenIndex] }
		})
	return JSON.parse(guestTokenResponse.body).guest_token;
}



// Stringify URL parameters
function queryString(params) {
	return Object.keys(params).map(key => key + '=' + params[key]).join('&');
}



// // Parse links -- @Ramsey periscope & video can be reworked, it's all under entities/card – try 981565451196022784
// async function _parseLinks(inlineLinks) {
// 	let links = { internal: [], external: [] };
// 	if (!inlineLinks) return links;
// 	let video;
// 
// 	for (const link of inlineLinks) {
// 		let expandedLink = await request.expand(link)
// 		// TODO is dropping trailing links overthinking it?
// 		if (text.endsWith(link))
// 			text = text.replace(link, '')
// 		else
// 			text = text.replace(link, expandedLink)
// 		if (expandedLink.startsWith('https://twitter.com')) {
// 			let statusMatch = expandedLink.match(/\/status\/([\d]+)/)
// 			if (statusMatch) {
// 				let tweetId = statusMatch[1]
// 				if (!links.internal.includes(tweetId) && tweetId != id)
// 					links.internal.push(tweetId)
// 			} else {
// 				let broadcastMatch = expandedLink.match(/\/broadcasts\/([^\/]+)/)
// 				if (broadcastMatch) {
// 					let broadcastId = broadcastMatch[1]
// 					video = { type: 'twitter-live-video', id: broadcastId }
// 				} else {
// 					if (!links.external.includes(expandedLink))
// 						links.external.push(expandedLink)
// 				}
// 			}
// 		} else if (expandedLink.startsWith('https://www.pscp.tv') && expandedLink.match(/\/\w+\/([^\/]+)/)) {
// 			let periscopeId = expandedLink.match(/\/\w+\/([^\/]+)/)[1]
// 			video = { type: 'periscope-video', id: periscopeId }
// 		} else {
// 			if (!links.external.includes(expandedLink))
// 				links.external.push(expandedLink)
// 		}
// 	}
// 
// 	return { links, video };
// }



module.exports = extract;