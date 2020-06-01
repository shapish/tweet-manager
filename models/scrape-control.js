const mongoose = require('mongoose');

module.exports = mongoose.model('scrape-control', new mongoose.Schema({
	account: String,
	name: {
		type: String,
		unique: true
	},
	gathering: Boolean,
	extracting: Boolean,
	url: String, /* URL of next page to be scraped */
	p: Number /* Page number of next page to be scraped */
}, { collection: 'control' }));