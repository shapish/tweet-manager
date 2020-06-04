const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
	idTw: {
		type: String,
		unique: true
	},
	text: String,
	author: String,
	date: Date,
	isRT: Boolean,
	url: String,
	location: {
		name: String,
		id: String
	},
	tagsTw: Array,
	mentions: Array,
	internalLinks: Array,
	externalLinks: Array,
	replyTo: String, // Previous tweet in thread
	extra: {
		likes: Number,
		replies: Number,
		retweets: Number,
		quotes: Number
	},
	source: String,

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
tweetSchema.path('text').index({text : true});

const Tweet = mongoose.model('tweet', tweetSchema);

module.exports = Tweet;