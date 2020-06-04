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
	p: {
		/* Page number of next page to be scraped */
		type: Number,
		default: 1
	},
	total: {
		/* Count of how many tweets are scraped */
		type: Number,
		default: 0
	}
}, { collection: 'control' }));