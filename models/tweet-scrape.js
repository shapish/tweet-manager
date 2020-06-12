const mongoose = require('mongoose');

const userSchema = {
	name: String,
	handle: String
}

const mediaSchema = [{
	id: String,
	mediaUrl: String,
	url: String,
	mType: String,
	videoUrl: String,
	gifUrl: String,
	width: Number,
	height: Number
}];

const miniTweetSchema = {
	id: String,
	user: userSchema,
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
	user: userSchema,
	date: Date,
	isRT: Boolean,
	rt: {
		idTw: String, // Retweet id (not scrapeable, but stored from tta)
		date: Date,
		user: userSchema,
		rtIdMissing: Boolean // We don't have the RT id for scraped tweets, so we mark them
	},
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
	},
	test: Number
});

// Enable text search
tweetSchema.path('text').index({text : true});

const Tweet = mongoose.model('tweet-scrape', tweetSchema);
module.exports = Tweet;