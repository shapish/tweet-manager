const SC = require('../models/scrape-control');

module.exports = function ScrapeControl(userHandle) {
	userHandle = userHandle ? userHandle : 'realDonaldTrump';
	const id = { name: userHandle };
	
	// Check status
	this.get = async function(action) {
		const ctrl = await SC.findOne(id);
		return action ? ctrl[action] : ctrl;
	}

	// Turn action on or off
	this.set = async function(action, value) {
		const update = {};
		update[action] = value;
		await SC.findOneAndUpdate(id, update);
	}

	// Only called once to create the scrape control for this user
	this.init = async function(userHandle) {
		await SC.findOneAndDelete({ name: userHandle });
		const ctrl = new SC({
			name: userHandle,
			seeding: false,
			gathering: false,
			extracting: false,
			transferring: false,
			scrapingLatest: false,
			findMissing: false
		});
		ctrl.save();
		return ctrl;
	}
}