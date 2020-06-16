const got = require('got');

/**
 * Twitter authentication
 * - - -
 * Creates guest token that lets you talk to Twitter API.
 * Bearer token might have to be swapped out in order to work,
 * look for it in the HTTP headers sent to Twitter web api.
 */

module.exports = function() {
	const bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
	const userAgent = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36' };
	this.guestToken;
	this.rateLimitRemains; // We'll store rate limits here with each request
	
	// Fetch new guest token
	this.refresh = async function() {
		console.log('Getting guest token')
		const response = await got('https://api.twitter.com/1.1/guest/activate.json', {
			method: 'POST',
			headers: { authorization: `Bearer ${bearerToken}`, ...userAgent }
		});
		this.guestToken = JSON.parse(response.body).guest_token;
		console.log('Guest token success', this.guestToken);
	}

	// Verifies if guest token exists, creates one if not
	this.verify = async function() {
		if (!this.guestToken) await this.refresh();
	}

	// Http request headers
	this.getHeaders = function() {
		if (!this.guestToken) console.log('Requesting headers before guest token is created');
		
		return {
			authorization: `Bearer ${bearerToken}`,
			// Referrer: `https://twitter.com/_/status/${id}`, // Note: if you use realDonaldTrump in the URL, text is clipped
			// 'x-csrf-token': 'undefined',
			'x-guest-token': this.guestToken,
			// 'x-twitter-client-language': 'en',
			...userAgent
		}
	}
}