// Modules
const express = require('express');
const router = express.Router();

// Models
const Label = require('../models/label');
const Tweet = require('../models/tweet');

// Middleware
const {auth} = require('../middleware/auth');

// Helpers
const {removeDupDocs, compareArrays} = require('../functions/general');



/**
 * GET requests
 */

// Get all labels
router.get('/', auth, async (req, res) => {
	let labels = await Label.find().sort('-count value');
	return res.send(labels);
});



// Get labels values matching query
router.get('/:query', auth, async (req, res) => {
	// Sanitize query, remove special characters but allow dash
	let { query} = req.params;
	query = (query == '*') ? query : query.replace(/[^0-9a-zA-Z- ]/g, '');

	// Set search criteria
	// Empty query is turned into '*' in frontend, which returns all
	const criteria = query == '*' ? null : {
		value: { $regex: '.*' + req.params.query + '.*' }
	}
	
	// Get results
	let labels = await Label.find(criteria).sort('-count value').limit(10);
	labels = labels.map(result => {
		return result.value
	});
	
	return res.send(labels);
});





/**
 * POST requests
 */


// Create new label
router.post('/', auth, async (req, res) => {
	let label;
	let value = req.body.value.replace(/[^0-9a-zA-Z- ]/g, '').toLowerCase();
	const {ids} = req.body;
	
	// Update or create new label
	label = await Label.findOneAndUpdate({
		value: value
	}, {
		$inc: { count: ids.length }
	}, {
		upsert: true,
		new: true,
		runValidators: true
	});
	
	// Promise 1: Update tweets
	const updatePromises = ids.map(id => {
		return Tweet.findByIdAndUpdate(id, {
			$addToSet: { labels: value }
		}, { runValidators: true });
	});
	
	// Promise 2: Update label
	updatePromises.push(label.save); // ?? ##
	
	// Save
	const result = await Promise.all(updatePromises);
	res.send(result);
});





/**
 * UPDATE requests
 */

// Merge labels
router.put('/merge', auth, async (req, res) => {
	const {mainValue} = req.body; // Surviving label text
	const {mainId} = req.body; // Surviving label id
	const {mergeIds} = req.body; // Ids of labels to be merged
	// const {count} = req.body; // Usage count of all labels combined

	// Find list of labels to be replaced
	let mergedLabels = await Label.find({
		_id: {
			$in: mergeIds
		}
	});

	// - -

	// Promise A1: Find all tweets associated with the label that stays (one list)
	let pA1 = Tweet.find({ labels: mainValue });

	// Promise A2: Find all tweets associated with each replaced label (multiple lists)
	let pA2 = mergedLabels.map(label => {
		return Tweet.find({ labels: label.value });
	});

	// Process results
	const promisesA = await Promise.all([pA1].concat(pA2));
	const tweetListMain = promisesA.shift();
	const tweetListsMergers = promisesA;

	// - -

	// Promise B1: Remove original label value from tweets, for each merged label
	let pB1 = [];
	tweetListsMergers.forEach((list, i) => {
		const p = list.map(tweet => {
			return Tweet.findByIdAndUpdate(tweet._id, {
				$pull: { labels: mergedLabels[i].value }
			});
		});
		pB1 = pB1.concat(p);
	});

	// Merge all tweet lists and remove duplicates, to count
	let allMergedTweets = [];
	tweetListsMergers.forEach(list => {
		allMergedTweets = allMergedTweets.concat(list);
	});
	allMergedTweets = removeDupDocs(allMergedTweets);

	// Promise B2: Add new label to all merged tweets
	const pB2 = allMergedTweets.map(tweet => {
		return Tweet.findByIdAndUpdate(tweet._id, {
			$addToSet: { labels: mainValue }
		});
	});

	// Promise B3: Delete merged labels
	const pB3 = Label.deleteMany({
		_id: {
			$in: mergeIds
		}
	});

	// Promise B4: Update main label count
	const count = removeDupDocs(tweetListMain.concat(allMergedTweets)).length;
	const pB4 = Label.findByIdAndUpdate(mainId, {
		count: count
	});

	// Wait for results
	const promisesB = [pB4].concat(pB1).concat(pB2).concat(pB3);
	// promisesB.push(pB4)
	await Promise.all(promisesB);

	// Put deleted label values name in array
	const mergedLabelValues = mergedLabels.map(item => {
		return item.value;
	});

	// Send back results
	return res.send({
		mainValue: mainValue,
		mergedLabelValues: mergedLabelValues,
		count: count
	});
});



// Remove label from tweet
router.put('/remove', auth, async (req, res) => {
	console.log(req.body)
	const {id} = req.body;
	const {value} = req.body;
	
	// Remove label from tweet
	const p1 = Tweet.findByIdAndUpdate(id, {
		$pull: { labels: value }
	});

	// Decrease count on label
	const p2 = Label.findOneAndUpdate({
		value: value
	}, {
		$inc: { count: -1 }
	});

	const result = await Promise.all([p1, p2]);

	// Delete label if there's no tweets associated
	const tweets = await Tweet.find({ labels: value	});
	if (!tweets.length) {
		await Label.findOneAndDelete({ value: value });
	}

	return res.send(result);
});



// Reset count for all labels
router.put('/clean', auth, async (req, res) => {
	// Get current list of registered labels so we can compare and detect differences
	const ogLabels = await Label.find();
	ogLabelValues = ogLabels.map(label => {
		return label.value
	});

	// Store count for each label so we can compare and detect differences
	let ogLabelsCount = {}
	ogLabels.forEach(label => {
		ogLabelsCount[label.value] = label.count;
	});


	// Find all tweets that have at least one label
	const tweets = await Tweet.find({ 'labels.0': { $exists: true } });
	
	// Aggregate all labels from all tweets
	let trueLabelValues = [];
	tweets.forEach(tweet => {
		tweet.labels.forEach(val => {
			if (!trueLabelValues.includes(val)) trueLabelValues.push(val);
		});
	});
	
	// Loop through labels and...
	const trueLabels = [];
	await runLabels(trueLabelValues);
	async function runLabels(arr) {
		for (let i=0; i<arr.length; i++) {
			const label = arr[i];
			// Count how many tweets it has
			const labelTweets = await Tweet.find({ labels: label });

			// Update count & restore label if it's missing
			const result = await Label.findOneAndUpdate({ value: label	}, {
				count: labelTweets.length
			}, { upsert: true, new: true });

			// Store labels so we can compare with og count
			trueLabels.push(result);
		}
	};
	
	// Detect restored and removed values
	console.log('ogLabelValues', ogLabelValues)
	console.log('trueLabelValues', trueLabelValues)
	const compare = compareArrays(ogLabelValues, trueLabelValues);
	const removedLabels = compare.diff1;
	const restoredLabels = compare.diff2;
	console.log(compare)
	console.log('removedLabels: ' + removedLabels);
	console.log('restoredLabels: ' + restoredLabels);

	// Remove labels to be removed
	const p = removedLabels.map(value => {
		return Label.findOneAndDelete({ value: value})
	});
	await Promise.all(p);
	
	// Detect updated count numbers
	const updatedCounts = {};
	for (let label in trueLabels) {
		const value = trueLabels[label].value;
		const count = trueLabels[label].count;
		if (!ogLabelsCount[value]) {
			updatedCounts[value] = '... => ' + count;
		} else if (ogLabelsCount[value] != count) {
			updatedCounts[value] = ogLabelsCount[value] + ' => ' + count;
		}
	}

	return res.send({
		updatedCounts: updatedCounts,
		removedLabels: removedLabels,
		restoredLabels: restoredLabels
	});
});



// Rename label
router.put('/:id', auth, async (req, res) => {
	const value = req.body.value.replace(/[^0-9a-zA-Z- ]/g, '').toLowerCase();
	const {ogValue} = req.body;

	// Check if label name is taken
	let label = await Label.findOne({ value: value });
	if (label) return res.status(400).send('Label already exists.');

	// Get all tweets with this label
	const labelTweets = await Tweet.find({ labels: ogValue });
	
	// // Don't understand why this doesn't work
	// for (let i in labelTweets) {
	// 	const index = labelTweets[i].labels.indexOf(gName);
	// 	const updatedLabels = labelTweets[i].labels;
	// 	updatedLabels[index] = lablName;
	// 	console.log('updatedLabels:', updatedLabels);
	// 	labelTweets[i].labels = updatedLabels; // This doesn't work but hardcoded array does... not sure why
	// 	console.log('done: ', labelTweets[i].labels);
	// 	await labelTweets[i].save();
	// }


	// Set promises
	let updatePromises = [];

	// Promise 1: Save label
	const p1 = Label.findByIdAndUpdate(req.params.id, {
		value: value
	});
	updatePromises.push(p1);

	// Promise 2: Remove old label
	const p2 = labelTweets.map(tweet => {
		return Tweet.findByIdAndUpdate(tweet._id, {
			$pull: { labels: ogValue }
		});
	});

	// Promise 3: Add new label
	const p3 = labelTweets.map(tweet => {
		return Tweet.findByIdAndUpdate(tweet._id, {
			$addToSet: { labels: value }
		});
	});
	updatePromises = updatePromises.concat(p2).concat(p3);

	// Save promises
	await Promise.all(updatePromises);
	return res.send({ value: value });
});





/**
 * DELETE requests
 */

// Delete label
router.delete('/:id', auth, async (req, res) => {
	// Delete label
	let label = await Label.findByIdAndDelete(req.params.id);

	// Remove label from tweets
	const tweets = await Tweet.find({ labels: req.body.value });
	updatePromises = tweets.map(tweet => {
		return Tweet.findByIdAndUpdate(tweet._id, {
			$pull: { labels: req.body.value }
		});
	});

	// Save removal
	await Promise.all(updatePromises);
	return res.send(label);
});


module.exports = router;
