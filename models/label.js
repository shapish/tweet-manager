const mongoose = require('mongoose');

const Label = mongoose.model('label', new mongoose.Schema({
	value: {
		type: String,
		unique: true,
		maxlength: 50
	},
	count: {
		type: Number,
		default: 0
	}
}));

module.exports = Label;