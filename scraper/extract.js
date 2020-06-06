const request = require('./request');
const { extractUrls, extractHashtags, extractMentions } = require('twitter-text');
const he = require('he');
const cli = require('../helpers/cli-monitor');
const { queryString } = require('../helpers/general');

// Twitter authentication
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const chromeUserAgent = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36' };
let _cachedGuestToken = null;





/**
 * Extracts all tweet data and formats it to our model
 * @param {number} idTw Tweet id
 * @param {string} user Username of author
 */
async function extract(idTw, user) {
	data = await _parseTweet(idTw);

	// Extraction failed
	if (data.errors) {
		if (data.errors[0].code == 34 || data.errors[0].code === 0) {
			// Tweet is deleted (0 is custom error in extract.js)
			cli.log(` › Deleted: ${idTw}`.magenta);
			return { idTw: idTw, deleted: true }
		} else {
			// Other errors: https://bit.ly/304zWuo (1 is custom error in extract.js)
			cli.log(` › Error: ${data.errors[0].code} for ${idTw}: ${data.errors[0].message}`.red);
			return { idTw: idTw, errors: data.errors }
		}
	}
	
	record = {
		idTw: data.id_str,
		text: data.full_text,
		user: {
			name: data.user.name,
			handle: data.user.screen_name
		},
		date: data.created_at,
		isRT: user ? (data.user.screen_name != user) : null,
		media: data.media,
		location: data.place ? {
			name: data.place.name,
			id: data.place.id
		} : null,
		tagsTw: data.tags,
		mentions: data.mentions,
		internalLinks: data.links ? data.links.internal : null,
		externalLinks: data.links ? data.links.external : null,
		repliesTo: data.repliesTo,
		quoted: data.quoted,
		thread: data.thread,
		extra: {
			likes: data.favorite_count,
			replies: data.reply_count,
			retweets: data.retweet_count,
			quotes: data.quote_count
		},
		source: data.source,
		ogData: data.ogData
	}
	return record;
}



/**
 * Inspect tweet data objects
 * @param {string} idTw Tweet id
 * @param {*} type original / parsed / extracted (default: all)
 */
async function inspect(idTw, type) {
	let result = {};
	if (type == 'original') result = await _fetchTweet(idTw);
	else if (type == 'parsed') result = await _parseTweet(idTw);
	else if (type == 'extracted') result = await extract(idTw);
	else if (!type) result = {
		original: await _fetchTweet(idTw),
		parsed: await _parseTweet(idTw),
		extracted: await extract(idTw)
	}
	return result;
};



/**
 * Parses & cleans Tweet data object
 * @param {string} id Tweet ID
 * @param {boolean} dontExpand Don't look up quoted/replied tweets (to avoid chain-quoting/replying, we only store one level)
 */
async function _parseTweet(id, dontExpand) {
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
	if (tweet.extended_entities && tweet.extended_entities.media) {
		media = tweet.extended_entities.media.map(m => {
			return {
				id: m.id_str,
				mediaUrl: m.media_url,
				url: m.url,
				mType: m.type, // Note: tweets are videos with type:image
				width: m.original_info.width,
				height: m.original_info.height
			}
		});
	}
	tweet.media = media;

	// Quoted tweet
	let quoted;
	if (tweet.quoted_status_id_str && !dontExpand) {
		quoted = await _parseTweet(tweet.quoted_status_id_str, true);
		if (quoted.user) { // <-- Make sure this quoted tweet still exists
			quoted = {
				id: tweet.quoted_status_id_str,
				user: {
					name: quoted.user.name,
					handle: quoted.user.screen_name
				},
				text: quoted.full_text,
				media: quoted.media,
				date: quoted.created_at
			}
		}
	}
	tweet.quoted = quoted;

	// Replies to
	let repliesTo;
	if (tweet.in_reply_to_status_id_str && !dontExpand) {
		repliesTo = await _parseTweet(tweet.in_reply_to_status_id_str, true);
		if (repliesTo.user) { // <-- Make sure this replied to tweet still exists
			repliesTo = {
				id: tweet.in_reply_to_status_id_str,
				user: {
					name: repliesTo.user.name,
					handle: repliesTo.user.screen_name
				},
				text: repliesTo.full_text,
				media: repliesTo.media,
				date: repliesTo.created_at
			}
		}
	}
	tweet.repliesTo = repliesTo;

	// Thread
	let thread;
	if (tweet.self_thread) {
		thread = {
			start: tweet.self_thread.id_str,
			prev: tweet.in_reply_to_status_id_str
		}
	}
	tweet.thread = thread;

	// Source (parse)
	tweet.source = tweet.source.match(/">(.+)<\//)[1];

	// Attach OG data in case we need to parse something else later
	tweet.ogData = JSON.stringify(tweet);

	// Clean – remove this if you need to access more data
	delete tweet.entities
	delete tweet.extended_entities
	delete tweet.card

	return tweet;
}



/**
 * Fetch original Twitter data object
 * @param { Number } id Tweet id
 */
async function _fetchTweet(id) {
	if (!_cachedGuestToken) await updateCachedGuestToken();

	const authOptions = {
		headers: {
			authorization: `Bearer ${BEARER_TOKEN}`,
			Referrer: `https://twitter.com/realDonaldTrump/status/${id}`,
			'x-csrf-token': 'undefined',
			'x-guest-token': _cachedGuestToken,
			'x-twitter-client-language': 'en',
			...chromeUserAgent
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
	try { response = await request.json(`https://api.twitter.com/2/timeline/conversation/${id}.json?${params}`, authOptions) }
	catch {	response = {'errors': [{'message':'Failed to connect to Twitter','code':1}]} }
	// Refresh token when it expires
	if (response && response.errors && response.errors[0].code == 200) _cachedGuestToken = null;
	if (response.errors) return response;
	
	const tweet = response.globalObjects.tweets[id];
	// Sometimes Twitter returns an empty data object for deleted tweets
	if (!tweet) return {'errors': [{'message':'Scraper error, empty data','code':0}]};

	const userId = tweet.user_id_str;
	const user = response.globalObjects.users[userId];
	const { name, screen_name, location, description, profile_image_url_https } = user;
	tweet.user = { name, screen_name, location, description, profile_image_url_https };
	return tweet;
}



// Get guest token to access Twitter API
async function updateCachedGuestToken(bearerToken=BEARER_TOKEN) {
	_cachedGuestToken = await getGuestToken(bearerToken);
}
async function getGuestToken(token) {
	const guestTokenResponse = await request('https://api.twitter.com/1.1/guest/activate.json',
		{
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, ...chromeUserAgent }
		})
	return JSON.parse(guestTokenResponse.body).guest_token;
}



module.exports = { extract, inspect };