// Modules
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Models
const Chapter = require('../models/chapter');





/**
 * Chapters
 */

// Add/update and delete chapters
router.put('/', async (req, res) => {
	let { chapters } = req.body;
	let { deletedChapterIds } = req.body;

	// Empty arrays come in as undefined,
	// so need to be redefined as arrays
	chapters = chapters ? chapters : [];
	deletedChapterIds = deletedChapterIds ? deletedChapterIds : [];

	// Add & update requests
	const updatePromises = chapters.map(item => {
		let { _id } = item;
		_id = _id ? _id : new mongoose.mongo.ObjectID(); // Add id for new chapters
		return Chapter.findByIdAndUpdate(_id, item, { upsert: true, new: true, runValidators: true });
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




module.exports = router;