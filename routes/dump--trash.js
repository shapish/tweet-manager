// Testing text search
router.get('/aggr', async (req, res) => {
	
	// const results = await Tweet.find({
	// 	$expr: {
	// 		$search: {
	// 			"search": {
	// 				"path": "text",
	// 				"query": ["fraudster", "pelosi"]
	// 			},
	// 			"highlight": {
	// 				"path": "text"
	// 			}
	// 		}
	// 	}
	// });


	const results = await Tweet.aggregate([
		// {
		// 	$match: { $text: { $search: '"swamp creature"' } }
		// },
		{
			$match: {
				$text: {
					$search: '"swamp creature"'
				}
			}
		},
		// {
		// 	$search: {
		// 		"search": {
		// 		  "path": "text",
		// 		  "query": ["fraudster", "pelosi"]
		// 		},
		// 		"highlight": {
		// 		  "path": "text"
		// 		}
		// 	}
		// },
		{
			$sort: { created_at: -1 }
		},
		{
			$project: { _id: 0, text: 1 }
		}
	]);

	res.send(results);
});