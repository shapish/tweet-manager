const ScrapeControl = require('../models/scrape-control');

module.exports = function sc() {
	const sc = { name: 'scrape-control' };
	
	// Initialize
	this.seeding = false;
	this.extracting = false;
	this.gathering = false;
	(async function _init() {
		const ctrl = await ScrapeControl.findOne(sc);
		this.seeding = ctrl.seeding;
		this.extracting = ctrl.extracting;
		this.gathering = ctrl.gathering;
	})();

	// Check status
	this.is = function(action) {
		return this[action];
	}

	// Turn action on
	this.set = async function(action) {
		const update = {};
		update[action] = true;
		await ScrapeControl.findOneAndUpdate(sc, update);
		this[action] = true;
	}

	// Turn action off
	this.unset = async function(action) {
		const update = {};
		update[action] = false;
		await ScrapeControl.findOneAndUpdate(sc, update);
		this[action] = false;
	}
}