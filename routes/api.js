// Modules
const express = require('express');
const router = express.Router();

// Models
const Chapter = require('../models/chapter');

// Create new chapter
router.post('/chapters', async (req, res) => {
	const chapter = await new Chapter({
		title: req.body.title,
		index: req.body.index
	});
	console.log(chapter)

	res.send(chapter);
});

// Update chapter title
router.put('/chapters/:id', async (req, res) => {
	const chapter = await Chapter.findByIdAndUpdate(req.params.id, {
		title: req.body.title
	});
	res.send(chapter);
});

// Delete chapter
router.delete('/chapters/:id', async (req, res) => {
	const chapter = await Chapter.findByIdAndDelete(req.params.id);
	res.send(chapter);
});

// Update chapter order
router.put('/chapters', async (req, res) => {
	console.log('New Chapters:', req.body.newChapters);
	console.log('Updated Chapters:', req.body.updatedChapters);

	// Not sure how to update all these at once?

	res.send(req.body.updatedChapters);
});

module.exports = router;