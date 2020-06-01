// twitter id -> { data: { ... }, media: { images, video} } 
const moment = require('moment-timezone');
const cheerio = require('cheerio')
const he = require('he')
const request = require('./request')
const { extractUrls, extractHashtags, extractMentions } = require('twitter-text')

/**
 * Extracts data from a Twitter tweet ID
 * @param {string} id Twitter ID
 */
async function extract(id) {
	let payload;
	let $;
	let text;

	// Sometimes Twitter won't properly load, so we try again a few times
	let tries = 1;
	let payloadOK = false;
	await _loadLoop();
	if (!payloadOK) return null;
	async function _loadLoop() {
		console.log('A')
		payload = await request(`https://twitter.com/_/status/${id}`);
		console.log('B')
		
		// Detect deleted tweets
		if (payload.statusCode === 404) {
			console.log(`https://twitter.com/_/status/${id} not found, probably deleted`)
			return null;
		}
		
		// Find tweet text
		$ = cheerio.load(payload.body);
		text = $('meta[property="og:description"]').attr('content');

		// Log id + attempts
		// console.log((tries > 1 ? ' +' + tries + ' ' : '') + id);
		if (tries == 1) {
			console.log('#'+tries + ' - ' + id);
		} else {
			console.log('#'+tries + ' ---- ' + id);
		}

		// No text, try again
		if (!text) {
			if (tries < 10) {
				tries++;
				await _loadLoop();
			} else {
				payloadOK = false;
			}
		} else {
			payloadOK = true;
		}
	}

	// TEXT
	if (!text) {
		console.log(`twitter.com/_/status/${id} not found, account probably suspended`)
		return null;
	}
	text = he.decode(text.substring(1, text.length - 1)) // drop leading and trailing quotes, decode html entities
	let tags = extractHashtags(text)
	let mentions = extractMentions(text)

	// IMAGES
	let images = $('meta[property="og:image"]').get()
		.map(meta => meta.attribs.content)
		.filter(url => !url.includes('profile_images')) // remove profile images that show up in some cases
	
	// VIDEO
	let video
	if ($('meta[property="og:video:url"]').length == 0) {
		video = null
	} else {
		// twitter video, unless invalidated below
		video = { type: 'twitter-video', id }
	}

	// USER
	let user = $('div.permalink-header a.js-user-profile-link span.username b').text()
	
	// OTHER
	let replies = parseInt($('div.permalink-tweet .ProfileTweet-action--reply span[data-tweet-stat-count]').attr('data-tweet-stat-count')) || 0
	let retweets = parseInt($('div.permalink-tweet .ProfileTweet-action--retweet span[data-tweet-stat-count]').attr('data-tweet-stat-count')) || 0
	let likes = parseInt($('div.permalink-tweet .ProfileTweet-action--favorite span[data-tweet-stat-count]').attr('data-tweet-stat-count')) || 0
	let location = $('div.permalink-tweet [data-place-id]').text() || null
	let locationId = $('div.permalink-tweet [data-place-id]').attr('data-place-id') || null
	let timestamp = moment.unix($('.js-original-tweet [data-time]').attr('data-time'))
		.tz('America/Los_Angeles').tz('Etc/GMT') // convert west coast usa time to gmt
		.format()
	let poll = null
	let links = { internal: [], external: [] }
	let dataCardUrl = $('[data-card-url]').attr('data-card-url')
	if (dataCardUrl) {
		if(dataCardUrl.startsWith('card://')) {
			// Most likely a twitter poll, don't try to expand, record for later
			poll = $('[data-card-url][data-src]').attr('data-src')

		} else {
			let expandedDataCardUrl = await request.expand(dataCardUrl)
			if (!expandedDataCardUrl.startsWith('https://twitter.com'))
				links.external.push(expandedDataCardUrl)
		}
	}

	let quoteRetweetId = $('div.permalink-tweet a.QuoteTweet-link[data-conversation-id]').attr('data-conversation-id')
	if (quoteRetweetId)
		links.internal.push(quoteRetweetId)

	let inlineLinks = extractUrls(text)
	if (inlineLinks) {
		for (const link of inlineLinks) {
			let expandedLink = await request.expand(link)
			// TODO is dropping trailing links overthinking it?
			if (text.endsWith(link))
				text = text.replace(link, '')
			else
				text = text.replace(link, expandedLink)
			if (expandedLink.startsWith('https://twitter.com')) {
				let statusMatch = expandedLink.match(/\/status\/([\d]+)/)
				if (statusMatch) {
					let tweetId = statusMatch[1]
					if (!links.internal.includes(tweetId) && tweetId != id)
						links.internal.push(tweetId)
				} else {
					let broadcastMatch = expandedLink.match(/\/broadcasts\/([^\/]+)/)
					if (broadcastMatch) {
						let broadcastId = broadcastMatch[1]
						video = { type: 'twitter-live-video', id: broadcastId }
					} else {
						if (!links.external.includes(expandedLink))
							links.external.push(expandedLink)
					}
				}
			} else if (expandedLink.startsWith('https://www.pscp.tv') && expandedLink.match(/\/\w+\/([^\/]+)/)) {
				let periscopeId = expandedLink.match(/\/\w+\/([^\/]+)/)[1]
				video = { type: 'periscope-video', id: periscopeId }
			} else {
				if (!links.external.includes(expandedLink))
					links.external.push(expandedLink)
			}
		}
	}
	text = text.trim()

	let threadPreviousHref = $('#ancestors a.tweet-timestamp').last().attr('href')
	let threadNextHref = $('#descendants a.tweet-timestamp').first().attr('href')
	let thread = {
		prev: threadPreviousHref ? threadPreviousHref.match(/(\d+)$/)[1] : null,
		next: threadNextHref ? threadNextHref.match(/(\d+)$/)[1] : null
	}

	return { images, video, id, user, links, text, timestamp, retweets, likes, replies, location, locationId, tags, mentions, thread, poll }
}

module.exports = extract