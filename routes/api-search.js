// Modules
const express = require('express');
const router = express.Router();

// Models
const Tweet = require('../models/tweet');
const Chapter = require('../models/chapter');

// Middleware
const {auth} = require('../middleware/auth');


// Star single tweet
router.put('/star/:id', auth, async (req, res) => {
	const {id} = req.params;
	const {level} = req.body;

	const tweet = await Tweet.findByIdAndUpdate(id, {
		stars: level
	});
	res.send(tweet);
});


// Star many tweets
router.put('/star', auth, async (req, res) => {
	const {ids} = req.body;
	const {level} = req.body;

	const tweets = await Tweet.updateMany({
		_id: { $in: ids }
	}, {
		stars: level
	});
	
	res.send(tweets);
});


// Archive single tweet
router.put('/archive/:id', auth, async (req, res) => {
	const {id} = req.params;
	const {doArchive} = req.body;

	const tweet = await Tweet.findByIdAndUpdate(id, {
		archived: doArchive
	});
	res.send(tweet);
});


// Archive many tweets
router.put('/archive', auth, async (req, res) => {
	const {ids} = req.body;
	const {doArchive} = req.body;
	
	let tweets = ids.map(id => {
		return Tweet.findByIdAndUpdate(id, {
			archived: doArchive
		});
	});
	tweets = await Promise.all(tweets);
	res.send(tweets);
});


// // Assign single tweet to chapter
// router.put('/assign', auth, async (req, res) => {
// 	const promises = [];

// 	// console.log('old: ', req.body.oldChapterId)
// 	// console.log('new: ', req.body.newChapterId)
// 	// console.log('tweet: ', req.body.tweetId);

// 	// Remove tweet from previously selected chapter
// 	if (req.body.oldChapterId) {
// 		promises.push(Chapter.findByIdAndUpdate(req.body.oldChapterId, {
// 			$pull: { tweets: { _id: req.body.tweetId}  }
// 		}));
// 	}

// 	// Add tweet id to selected chapter
// 	if (req.body.newChapterId) {
// 		const tweet = await Tweet.findById(req.body.tweetId).select('text');
// 		promises.push(Chapter.findByIdAndUpdate(req.body.newChapterId, {
// 			$addToSet: { tweets: tweet }
// 		}));
// 	}

// 	const chapter = req.body.newChapterId ? await Chapter.findById(req.body.newChapterId).select('title') : null;
// 	// Add chapter id to Tweet
// 	promises.push(Tweet.findByIdAndUpdate(req.body.tweetId, {
// 		chapter: chapter
// 	}));

// 	const result = await Promise.all(promises);
// 	res.send(result);
// });


// Assign single tweet to chapter
router.put('/assign', auth, async (req, res) => {
	const { tweetIds, oldChapterIds, newChapterId } = req.body;
	const promises = [];

	// console.log('old: ', req.body.oldChapterId)
	// console.log('new: ', req.body.newChapterId)
	// console.log('tweet: ', req.body.tweetId);

	// Remove tweets from their previously selected chapter
	oldChapterIds.forEach((id, i) => {
		if (id) {
			promises.push(Chapter.findByIdAndUpdate(id, {
				$pull: { tweets: { _id: tweetIds[i]}  }
			}));
		}
	});

	// Add tweet ids to newly selected chapter
	if (newChapterId) {
		const tweets = await Tweet.find({
			_id: { $in: tweetIds }
		}).select('text stars date isRT idTw');
		promises.push(Chapter.findByIdAndUpdate(newChapterId, {
			$addToSet: { tweets: tweets }
		}));
	}

	const chapter = newChapterId ? await Chapter.findById(newChapterId).select('title') : null;
	// Add chapter id to Tweet
	promises.push(Tweet.updateMany({
		_id: { $in: tweetIds }
	}, {
		chapter: chapter
	}));

	const result = await Promise.all(promises);
	res.send(result);
});



module.exports = router;