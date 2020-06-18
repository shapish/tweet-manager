// Modules
const { extractHashtags, extractMentions } = require('twitter-text');
const got = require('got'); // Http requests
const cheerio = require('cheerio'); // jQuery

// Helpers
const cli = require('../helpers/cli-monitor');
const { queryString, timeout } = require('../helpers/general');
const twAuth = new (require('./tw-auth'))(); // Twitter authentication





/**
 * Extracts all tweet data and formats it to our model
 * @param {Number} idTw Tweet id
 * @param {Boolean} dontVerifyToken When extracting by batch, you want to set the token manually before each batch
 */
async function extract(idTw, dontVerifyToken) {
	// Get token if none is set
	if (!dontVerifyToken) await twAuth.verify();

	// Parse tweet
	const tweet = await _parseTweet(idTw);
	
	// Catch errors
	if (tweet.errors) {
		if (tweet.errors[0].code == 34 || tweet.errors[0].code === 0) {
			// Tweet is deleted (0 is custom error in extract.js)
			cli.log(` › ${idTw}: ${tweet.errors[0].message} (code ${tweet.errors[0].code})`.magenta);
			return { idTw: idTw, deleted: true }
		} else {
			// Other errors: https://bit.ly/304zWuo (1 is custom error in extract.js)
			cli.log(` › Error #${tweet.errors[0].code} for ${idTw}: ${tweet.errors[0].message}`.red);
			return { idTw: idTw, errors: tweet.errors }
		}
	}
	
	// Mold it into our schema
	record = {
		idTw: tweet.id_str,
		text: tweet.text,
		ogText: tweet.ogText,
		user: tweet.userData,
		date: tweet.created_at,
		isRT: !!tweet.rt,
		rt: tweet.rt,
		media: tweet.media,
		location: tweet.place ? {
			name: tweet.place.name,
			id: tweet.place.id
		} : null,
		tagsTw: tweet.tags,
		mentions: tweet.mentions,
		internalLinks: tweet.internalLinks,
		externalLinks: tweet.externalLinks,
		linkPreview: tweet.linkPreview ? tweet.linkPreview : '',
		repliesTo: tweet.repliesTo,
		quoted: tweet.quoted,
		thread: tweet.thread,
		extra: {
			likes: tweet.favorite_count,
			replies: tweet.reply_count,
			retweets: tweet.retweet_count,
			quotes: tweet.quote_count
		},
		source: tweet.source,
		ogData: tweet.ogData,
		deleted: false,
		archived: false
	}

	return record;
}



/**
 * Parses & cleans Tweet data object
 * @param {string} idTw Tweet ID
 * @param {boolean} dontFollow Don't look up quoted/replied tweets (to avoid chain-quoting/replying, we only store one level)
 */
async function _parseTweet(idTw, dontFollow) {
	let tweet = await _fetchTweet(idTw);
	if (tweet.errors) { return tweet }
	
	// Store user data
	tweet.userData = {
		name: tweet.user.name,
		handle: tweet.user.screen_name
	}
	
	// When it's a retweet, load the text from the original tweet instead
	// Eg. #1 https://twitter.com/realDonaldTrump/status/1239756509212553217
	//    --> https://twitter.com/Techno_Fog/status/1239687082160689152
	const handleRegEx = new RegExp(/^RT @(\S+)\b/);
	if (tweet.retweeted_status_id_str) {
		const reTweet = tweet;
		const rt = {};
		
		// Fetch the original tweet
		tweet = await _fetchTweet(tweet.retweeted_status_id_str);
		// Makse sure the original tweet is not deleted
		if (tweet.errors && (tweet.errors[0].code == 34 || tweet.errors[0].code === 0)) {
			// Original tweet probably deleted
			cli.log(` › Following RT / ${idTw}: ${tweet.errors[0].message} (code ${tweet.errors[0].code})`.magenta);
		} else if (tweet.errors) {
			cli.log(` › Following RT / Error #${tweet.errors[0].code} for ${idTw}: ${tweet.errors[0].message}`.red);
			return tweet.errors;
		} else {
			// Store RT details
			rt.idTw = tweet.id_str;
			rt.date = tweet.created_at;
			rt.user = {
				handle: tweet.user.screen_name,
				name: tweet.user.name
			}

			// Add the RT essentials to the og tweet
			tweet.id_str = reTweet.id_str
			tweet.userData = reTweet.userData
			tweet.created_at = reTweet.created_at;
		}

		// Save retweet info
		if (!rt.user) rt.user = { handle: reTweet.full_text.match(handleRegEx)[1] }; // In case we couldn't load RT
		tweet.rt = rt;
	} else if (tweet.full_text.match(handleRegEx)) {
		// Older tweets from before ~June 2013 don't have retweeted_status_id_str
		tweet.rt = {
			idTw: tweet.id_str,
			legacy: true,
			user: {
				handle: tweet.full_text.match(handleRegEx)[1]
			}
		}
	}
	
	// Log a note when importing foreign tweet
	if (!dontFollow && tweet.userData.handle != 'realDonaldTrump') console.log('Foreign tweet from @' + tweet.userData.handle + ' - ' + idTw);

	// Tags, mentions (parse)
	tweet.tags = extractHashtags(tweet.full_text);
	tweet.mentions = extractMentions(tweet.full_text);

	// links (simplify)
	tweet.internalLinks = [];
	tweet.externalLinks = [];
	if (tweet.entities.urls) {
		tweet.entities.urls.forEach(link => {
			if (link.expanded_url.match(/\/status\/([\d]+)/)) {
				tweet.internalLinks.push({
					url: link.url,
					urlExpanded: link.expanded_url,
					urlDisplay: link.display_url
				});
			} else {
				tweet.externalLinks.push({
					url: link.url,
					urlExpanded: link.expanded_url,
					urlDisplay: link.display_url
				});
			}
		});
	}

	// Link preview card
	if (tweet.card && (tweet.card.name == 'summary_large_image' || tweet.card.name == 'summary')) {
		tweet.linkPreview = {
			url: tweet.card.url,
			urlExpanded: tweet.entities.urls[tweet.entities.urls.length - 1].expanded_url,
			urlVanity: tweet.card.binding_values.vanity_url.string_value,
			title: tweet.card.binding_values.title.string_value,
			description: tweet.card.binding_values.description ? tweet.card.binding_values.description.string_value : '',
			img: (tweet.card.binding_values.summary_photo_image) ? tweet.card.binding_values.summary_photo_image.image_value.url : null,
			thumb: (tweet.card.binding_values.thumbnail_image) ? tweet.card.binding_values.thumbnail_image.image_value.url : null
		}
	}

	// Media (simplify)
	let media;
	if (tweet.extended_entities && tweet.extended_entities.media) {
		media = tweet.extended_entities.media.map(m => {
			const media = {
				id: m.id_str,
				mediaUrl: m.media_url,
				url: m.url,
				mType: m.type, // Note: tweets are videos with type:image
				width: m.original_info.width,
				height: m.original_info.height,
			}

			// Attach video url
			if (m.type == 'video') {
				const videoFormats = m.video_info.variants; // Array of video formats
				let bitrate = 0;
				let videoUrl;
				videoFormats.forEach(format => {
					if (format.bitrate && format.bitrate > bitrate) {
						bitrate	= format.bitrate;
						videoUrl = format.url;
					}
				});
				// console.log('videoUrl: ', videoUrl, bitrate);
				media.videoUrl = videoUrl;
			}

			// Attach gif url – eg. 1270329252462964737
			if (m.type == 'animated_gif') {
				media.gifUrl = m.video_info.variants[0].url;
				// console.log('Animated gif: ', id)
			}

			return media;
		});
	}
	tweet.media = media;

	// Quoted tweet
	let quoted;
	if (tweet.quoted_status_id_str && !dontFollow) {
		quoted = await _parseTweet(tweet.quoted_status_id_str, true);
		if (quoted.user) { // <-- Make sure this quoted tweet still exists
			quoted = {
				idTw: tweet.quoted_status_id_str,
				user: {
					name: quoted.user.name,
					handle: quoted.user.screen_name
				},
				link: {
					url: tweet.quoted_status_permalink.url,
					urlExpanded: tweet.quoted_status_permalink.expanded,
					urlDisplay: tweet.quoted_status_permalink.display
				},
				mentions: quoted.mentions,
				text: quoted.full_text,
				media: quoted.media,
				internalLinks: quoted.internalLinks,
				externalLinks: quoted.externalLinks,
				linkPreview: quoted.linkPreview,
				date: quoted.created_at
			}
		}
	}
	tweet.quoted = quoted;

	// Replies to
	let repliesTo;
	if (tweet.in_reply_to_status_id_str && !dontFollow) {
		repliesTo = await _parseTweet(tweet.in_reply_to_status_id_str, true); // Follow replies to the bottom
		if (repliesTo.user) { // <-- Make sure this replied to tweet still exists
			repliesTo = {
				idTw: tweet.in_reply_to_status_id_str,
				user: {
					name: repliesTo.user.name,
					handle: repliesTo.user.screen_name
				},
				mentions: repliesTo.mentions,
				text: repliesTo.full_text,
				media: repliesTo.media,
				internalLinks: repliesTo.internalLinks,
				externalLinks: repliesTo.externalLinks,
				linkPreview: repliesTo.linkPreview,
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

	// Clean up & markup links
	_parseUrls(tweet);

	// Clean – remove this if you need to access more data
	delete tweet.entities
	delete tweet.extended_entities
	delete tweet.card
	
	return tweet;
}



/**
 * Fetch original Twitter data object
 * @param { Number } idTw Tweet id
 */
async function _fetchTweet(idTw) {
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
		response = await got(`https://api.twitter.com/2/timeline/conversation/${idTw}.json?${params}`, {
			headers: twAuth.getHeaders(),
			retry: 0 // Only way to eliminate ugle console errors
		});
	} catch (error) {
		if (!error.response) return {errors: [{ message: 'Twitter dropped connection (fluke)', code: 1}]};
		return JSON.parse(error.response.body);
	};

	// Refresh token when rate limit is reached
	twAuth.rateLimitRemains = response.headers['x-rate-limit-remaining'];
	if (twAuth.rateLimitRemains <= 1) {
		// Note: while this is great when queing things linearly, the most 
		// efficient way is to extract a whole batch at once using array.forEach,
		// in which case you will want to reset the token before each batch,
		// and set the batch to 50, so even with the following quoted tweets
		// and repliesTo, the batch will stay under the rate limit of 186.
		cli.log('REFRESHING GUEST TOKEN - extract.js'.red);
		await twAuth.refresh();
	} else {
		// Log rate limit status
		// cli.log(`${twAuth.rateLimitRemains} / ${id}`.yellow);
		// cli.log(`${twAuth.rateLimitRemains}`.yellow);
	}
	
	const tweet = JSON.parse(response.body).globalObjects.tweets[idTw];
	// Sometimes Twitter returns an empty data object for deleted tweets
	if (!tweet) return {errors: [{ message: 'Unavailable Tweet', code: 0}]};

	const userId = tweet.user_id_str;
	const user = JSON.parse(response.body).globalObjects.users[userId];
	const { name, screen_name, location, description, profile_image_url_https } = user;
	tweet.user = { name, screen_name, location, description, profile_image_url_https };
	return tweet;
}


/**
 * Removes all urls that we're previewing (media or linkPreview)
 * plus displays vanity urls for all exterenal link
 * @param {Remove } tweet Tweet from which to strip urls
 */
function _parseUrls(tweet) {
	tweet.ogText = tweet.full_text;
	tweet.text = tweet.full_text;
	_parse(tweet);
	if (tweet.quoted && tweet.quoted.idTw) _parse(tweet.quoted);
	if (tweet.repliesTo && tweet.repliesTo.idTw) _parse(tweet.repliesTo);

	function _parse(tweet) {
		let text = tweet.text;

		// Remove media links
		if (tweet.media && tweet.media.length) {
			tweet.media.forEach(m => {
				const re = new RegExp(m.url);
				text = text.replace(re, '');
			});
		}

		// Remove link preview links
		if (tweet.linkPreview && Object.keys(tweet.linkPreview).length > 0) {
			const re = new RegExp(tweet.linkPreview.url);
			text = text.replace(re, '');
		}

		// Remove quoted tweet links
		if (tweet.quoted && tweet.quoted.idTw) {
			const re = new RegExp(tweet.quoted.link.url);
			text = text.replace(re, '');
		}

		// Expand & enrich internal links
		if (tweet.internalLinks && tweet.internalLinks.length) {
			tweet.internalLinks.forEach(link => {
				const re = new RegExp(link.url);
				text = text.replace(re, `<a target="_blank" href="${link.urlExpanded}">${link.urlDisplay}</a>`);
			})
		}

		// Expand & enrich external links
		if (tweet.externalLinks && tweet.externalLinks.length) {
			tweet.externalLinks.forEach(link => {
				const re = new RegExp(link.url);
				text = text.replace(re, `<a target="_blank" href="${link.urlExpanded}">${link.urlDisplay}</a>`);
			})
		}

		// Link usernames
		if (tweet.mentions && tweet.mentions.length) {
			tweet.mentions.forEach(mention => {
				const re = new RegExp('@'+mention, 'gi');
				text = text.replace(re, `<a target="_blank" href="https://twitter.com/${mention}">@${mention}</a>`);
			})
		}

		tweet.text = text ? text.trim() : '';
	}
}



/**
 * Does a simplified scrape of basic data without going through the Twitter API
 * Used to scrape tweet text from server immediately as one is published, because
 * server IP is permanently exceeding rate limit due to other users' activity.
 * @param {String} id Tweet id
 */
async function extractSimple(id, user) {
	let payload;
	try {
		payload = await got(`https://twitter.com/realDonaldTrump/status/${id}`, {
			headers: {
				'user-agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)'
			}
		});
	} catch (error) {
		if (error.response.statusCode == '404') {
			console.log(`New tweet ${id} has been deleted before we could scrape it.`)
		} else {
			console.log(`New tweet scraping failed, Server responsed with ${error.response.statusCode}`)
		}
		return null;
	}

	let $ = cheerio.load(payload.body);

	const text = $('#main-content .tweet-text').text().trim();
	const userHandle = $('#main-content .user-info .username').text().trim().slice(1);
	const userName = $('#main-content .user-info .fullname').text().trim();
	let date = $('#main-content .metadata').text().trim();
	date = date.split(' - ');
	date = date.reverse().join(' ');
	date = String(new Date(date));
	let rt;
	let isRT = false;
	if (user && userHandle != user) {
		rt = {
			user: {
				name: userName,
				handle: userHandle
			},
			date: date,
			idTw: id
		},
		isRT = true
	}

	return {
		idTw: id,
		text: text,
		user: {
			name: userName,
			handle: userHandle
		},
		date: date,
		rt: rt,
		isRT: isRT
	}
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

const refreshTwitterToken = twAuth.refresh;

module.exports = { extract, extractSimple, inspect, refreshTwitterToken, twAuth };