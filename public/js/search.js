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

initDownload();
initShowTips();




// Download interface
function initDownload() {
	const $form = $('#download-options');
	const $btnToggle = $('#btn-download');
	const $btnCancel = $('#download-options button[type=button]');

	// Toggle
	$btnToggle.click(e => {
		if ($btnToggle.hasClass('toggle')) {
			_hide($btnToggle);
		} else {
			_show($btnToggle);
		}
		e.preventDefault();
	});
	
	// Cancel
	$btnCancel.click(_hide);

	// Submit
	$form.submit(e => {
		const format = $('#dd-download-options').attr('data-value');
		window.open('/search/download/' + format + window.location.search);
		e.preventDefault();
	});
	

	function _show() {
		$('#settings').removeClass('show');
		$('#controls').addClass('download');
		$btnToggle.addClass('toggle');
	}

	function _hide() {
		$('#controls').removeClass('download');
		$btnToggle.removeClass('toggle');
	}
}


// Search tips
function initShowTips() {
	const $btn = $('#btn-search-tips');
	$btn.click(_clickHandler);
	$('#form-search').submit(() => {
		if ($('#body').hasClass('show-tips')) {
			_hide();
		}
	});

	function _clickHandler(e) {
		if ($('#body').hasClass('show-tips')) {
			_hide();
		} else {
			_show();
		}
		e.preventDefault();
	}

	function _show() {
		$('#body').addClass('show-tips');
		$btn.data('href', location.search);
		history.pushState({}, '', '/search/tips');
	}

	function _hide() {
		const q = $btn.data('href') || '';
		$('#body').removeClass('show-tips');
		history.pushState({}, '', '/search' + q);
	}
}