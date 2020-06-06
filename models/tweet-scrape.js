const mongoose = require('mongoose');

const mediaSchema = [{
	id: String,
	mediaUrl: String,
	url: String,
	mTtype: String, // Note: tweets are videos with type:image
	width: Number,
	height: Number
}];

const miniTweetSchema = {
	id: String,
	user: {
		name: String,
		handle: String
	},
	text: String,
	media: mediaSchema,
	date: Date
};

const tweetSchema = new mongoose.Schema({
	idTw: {
		type: String,
		unique: true
	},
	text: String,
	author: String,
	user: {
		name: String,
		handle: String
	},
	date: Date,
	isRT: Boolean,
	url: String,
	media: mediaSchema,
	tagsTw: Array,
	mentions: Array,
	internalLinks: Array,
	externalLinks: Array,
	quoted: miniTweetSchema,
	repliesTo: miniTweetSchema,
	thread: {
		start: String,
		prev: String,
		list: Array
	},
	location: {
		name: String,
		id: String
	},
	extra: {
		likes: Number,
		replies: Number,
		retweets: Number,
		quotes: Number
	},
	source: String,
	ogData: String,

	// Internal fields
	stars: {
		type: Number,
		min: 0,
		max: 3,
		default: null
	},
	labels: Array,
	chapter: new mongoose.Schema({
		title: String
	}),
	archived: {
		type: Boolean,
		default: false
	},
	deleted: {
		type: Boolean,
		default: false
	}
});

// Enable text search
tweetSchema.path('text').index({text : true});

const Tweet = mongoose.model('tweet-scrape', tweetSchema);
module.exports = Tweet;