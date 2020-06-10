const mongoose = require('mongoose');

module.exports = mongoose.model('scrape-control', new mongoose.Schema({
	user: String,
	name: {
		type: String,
		unique: true
	},
	gathering: Boolean,
	extracting: Boolean,
	liveScraping: Boolean,
	url: String, /* URL of next page to be scraped */
	pagesDone: {
		/* Page number of next page to be scraped */
		type: Number,
		default: 0
	},
	total: {
		/* Count of how many tweets are scraped */
		type: Number,
		default: 0
	}
}, { collection: 'scrape-control' }));