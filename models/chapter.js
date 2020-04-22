const mongoose = require('mongoose');

const Chapter = mongoose.model('chapter', new mongoose.Schema({
	title: {
		type: String,
		maxlength: 50
	},
	index: {
		type: String,
		maxlength: 10,
		unique: true
	}
}));

module.exports = Chapter;