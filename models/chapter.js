const mongoose = require('mongoose');

const Chapter = mongoose.model('chapter', new mongoose.Schema({
	title: {
		type: String,
		maxlength: 50
	},
	altTitles: String,
	path: {
		type: String,
		maxlength: 50
	},
	index: {
		type: String,
		maxlength: 20
	},
	sortIndex: String,
	description: {
		type: String,
		maxlength: 250
	},
	tweets: [
		new mongoose.Schema({
			text: String,
			stars: Number,
			created_at: Date,
			is_retweet: Boolean,
			id_str: String,
			order: Number
		})
	],
	textLink: {
		type: String,
		maxlength: 100
	},
	wordCount: Number,
	type: {
		type: String,
		enum: ['light', 'heavy']
	},
	writer: new mongoose.Schema({
		name: String,
		path: String
	}),
	stage: {
		type: Number,
		default: 0,
		enum: [0,1,2,3,4,5,6]
	},
}));

module.exports = Chapter;