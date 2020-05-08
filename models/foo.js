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
	star: {
		type: Number,
		min: 0,
		max: 3,
		default: null
	},
	archived: {
		type: Boolean,
		default: false
	}
});

const Foo = mongoose.model('foo', tweetSchema);

module.exports = Foo;