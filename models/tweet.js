const mongoose = require('mongoose');

const userSchema = {
	name: String,
	handle: String
};

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

const linkPreviewSchema = {
	url: String,
	urlExpanded: String,
	urlVanity: String,
	title: String,
	description: String,
	img: String,
	thumb: String
};

const linkSchema = {
	url: String,
	urlExpanded: String,
	urlDisplay: String,
};

const miniTweetSchema = {
	idTw: String,
	user: userSchema,
	link: linkSchema,
	mentions: Array,
	text: String,
	media: mediaSchema,
	linkPreview: linkPreviewSchema,
	date: Date
};

const tweetSchema = new mongoose.Schema({
	idTw: {
		type: String,
		unique: true
	},
	text: String,
	ogText: String, // Text before we parse links and usernames
	user: userSchema,
	date: Date,
	isRT: Boolean,
	rt: {
		idTw: String, // Retweet id (not scrapeable, but stored from tta)
		date: Date,
		user: userSchema,
		legacy: Boolean // Old retweets don't have the RT data
	},
	media: mediaSchema,
	tagsTw: Array,
	mentions: Array,
	internalLinks: [linkSchema],
	externalLinks: [linkSchema],
	linkPreview: linkPreviewSchema,
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

const Tweet = mongoose.model('tweet', tweetSchema);
const TweetScrape = mongoose.model('tweet-scrape', tweetSchema);

module.exports = { Tweet, TweetScrape };