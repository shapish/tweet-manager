const mongoose = require('mongoose');

module.exports = mongoose.model('scrape-control', new mongoose.Schema({
	user: String,
	name: {
		type: String,
		unique: true
	},

	// Seeding
	seeding: {
		type: Boolean,
		default: false
	},
	extracting: {
		type: Boolean,
		default: false
	},
	transferring: {
		type: Boolean,
		default: false
	},

	// Maintaining
	gathering: {
		type: Boolean,
		default: false
	},
	scrapingLatest: {
		type: Boolean,
		default: false
	},
	fillingMissing: {
		type: Boolean,
		default: false
	}
}, { collection: 'scrape-control' }));