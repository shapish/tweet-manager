const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
	source: String,
	text: String,
	created_at: Date,
	retweet_count: Number,
	favorite_count: Number,
	is_retweet: Boolean,
	id_str: String,
	labels: Array,
	chapter: new mongoose.Schema({
		title: String
	}),
	stars: {
		type: Number,
		min: 0,
		max: 3,
		default: null
	},
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