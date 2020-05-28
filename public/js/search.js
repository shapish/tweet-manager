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

// Search tips
function initShowTips() {
	const $btn = $('#btn-search-tips');
	$btn.click(_clickHandler);
	$('#form-search').submit(() => {
		if ($('#body').hasClass('show-tips')) {
			_off();
		}
	});

	function _clickHandler(e) {
		if ($('#body').hasClass('show-tips')) {
			_off();
		} else {
			_on();
		}
		e.preventDefault();
	}

	function _on() {
		$('#body').addClass('show-tips');
		$btn.data('href', location.search);
		history.pushState({}, '', '/search/tips');
	}

	function _off() {
		const q = $btn.data('href') || '';
		$('#body').removeClass('show-tips');
		history.pushState({}, '', '/search' + q);
	}
}
initShowTips();