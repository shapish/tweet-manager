// Modules
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Models
const Chapter = require('../models/chapter');
const { User } = require('../models/user');

// Middleware & functions
const { auth, isAdmin1 } = require('../middleware/auth');
const {createPath} = require('../helpers/general');




// Add/update and delete from chapter index
router.put('/', [auth, isAdmin1], async (req, res) => {
	let { chapters } = req.body;
	let { deletedChapterIds } = req.body;
	
	// Empty arrays come in as undefined,
	// so need to be redefined as arrays
	chapters = chapters ? chapters : [];
	deletedChapterIds = deletedChapterIds ? deletedChapterIds : [];

	// Add & update requests
	const updatePromises = chapters.map(doc => {
		let { _id } = doc;
		_id = _id ? _id : new mongoose.mongo.ObjectID(); // Add id for new chapters
		doc.path = createPath(doc.title);
		// Upsert skips Mongoose default magic so we gotta set these here
		doc.tweets = doc.tweets ? doc.tweets : [];
		doc.wordCount = doc.wordCount ? doc.wordCount : null;
		doc.type = doc.type ? doc.type : null;
		doc.writer = doc.writer ? doc.writer : null;
		doc.stage = doc.stage ? doc.stage : 0;
		return Chapter.findByIdAndUpdate(_id, doc, { upsert: true, new: true, runValidators: true });
	});

	// Delete requests
	const deletePromises = deletedChapterIds.map(id => {
		return Chapter.findByIdAndDelete(id);
	});

	// Merge add/update + delete requests in one array
	allPromises = updatePromises.concat(deletePromises);

	const result = await Promise.all(allPromises);
	res.send(result);
});


// Batch update chapter type
router.put('/batch', [auth, isAdmin1], async (req, res) => {
	const { ids, type, writerId, stage, wordCount } = req.body;
	const updates = {}

	if (type) updates.type = type;
	if (writerId) updates.writer = await User.findById(writerId).select('name path');
	if (stage) updates.stage = stage;
	if (wordCount) updates.wordCount = wordCount;

	const chapters = await Chapter.updateMany({
		_id: { $in: ids }
	}, updates);
	res.send(chapters);
});


// Update chapter detail
router.put('/:id', [auth, isAdmin1], async (req, res) => {
	// Update chapter
	const updates = {};
	for (const field in req.body) {
		updates[field] = req.body[field];
		if (field == 'title') updates.path = createPath(req.body.title);
		if (field == 'writer') {
			updates.writer = await User.findById(req.body.writer);
		}
	
	}
	await Chapter.findByIdAndUpdate(req.params.id, updates);
	res.send(updates);
});




module.exports = router;