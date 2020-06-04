const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
	source: String,
	text: String,
	created_at: Date,
	retweet_count: Number,
	favorite_count: Number,
	is_retweet: Boolean,
	id_str: String
}, { collection: 'tta' });

const Tweet = mongoose.model('tta', tweetSchema);

module.exports = Tweet;