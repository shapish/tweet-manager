const mongoose = require('mongoose');
const config = require('config');

module.exports = function() {
	mongoose.connect(config.get('db'),
		{ useNewUrlParser: true,  useUnifiedTopology: true, useFindAndModify: false }) // Supress deprecation warnings)
		.then(() => { console.log('Connected to MongoDB...') })
		.catch(() => { console.log('Could not connect to MongoDB :(') });
}