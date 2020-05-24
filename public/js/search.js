// Search
new SearchBar({
	onSuccess: tweetTable.updateTable.bind(tweetTable)
});

// Filters
const searchFilters = new SearchFilters({
	onSuccess: tweetTable.updateTable.bind(tweetTable)
});

// Settings
new SearchSettings({
	onSuccess: (data) => { tweetTable.updateTable(data, true) }
});