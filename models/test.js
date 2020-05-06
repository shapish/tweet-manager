const mongoose = require('mongoose');
const mongoose_fuzzy_searching = require('mongoose-fuzzy-searching-v2');

const testSchema = new mongoose.Schema({
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
testSchema.plugin(mongoose_fuzzy_searching, {
	fields: ['text']
});

const Test = mongoose.model('test', testSchema);

module.exports = Test;