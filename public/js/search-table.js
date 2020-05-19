// To do:
// - label suggests to add existing value with capital

function Table(callbacks) {
	this.selected = []; // $rows that are selected
	this.reselect = []; // $rows that can be reselected
	this.lastClicked = null;
	this.$ipAddLabel = $('input#add-label');
	this.debug = false; // Logs all actions

	// Set callbacks: onSelect / onDeselect / onPopState
	this.callbacks = callbacks ? callbacks : {};

	// History back button
	$(window).on('popstate', (e) => {
		const data = e.originalEvent.state;
		if (data) {
			this.updateTable(data, true);
			this.callbacks.onPopState(data);
		} else {
			location.reload();
		}
	});

	this.init();
}


// Initialize
Table.prototype.init = function() {
	this.$table = $('#tweet-table');
	this.$header = this.$table.children().eq(0);
	this.$rows = this.$table.children();
	this.$pagination = $('#table-wrap .pagination'); // Returns both
	
	// Hook up top controls
	this._initControls();

	// Pagination links
	this._initPagination();
	
	// Hook up header clicks
	this._initHeader();
	
	// Hook up row clicks
	this._initRowClicks();
	// $('input[type=checkbox]').eq(1).trigger('click'); // ## DEV

	// Hook up labels
	this._initlabels();
	
	// Hook up dropdowns
	this.$dropdowns = this.$table.find('select');
	for (let i=0; i<this.$dropdowns.length; i++) {
		this.$dropdowns.eq(i).off('change').on('change', (e) => {
			this._updateDropdownDisplay($(e.currentTarget));
		});
	}
};


// Initialize controls at the top
Table.prototype._initControls = function() {
	// Archive button
	$('#btn-archive').off('click').on('click', (e) => {
		console.log('clocl')
		this._toggleArchiveSelected($(e.currentTarget));
		_deselect.bind(this)();
	});
	
	// Star dropdown
	$('#dd-star-display').off('change').on('change', (e) => {
		const $target = $(e.currentTarget);
		const level = $target.attr('data-value');
		$target.removeClass('l-0 l-1 l-2 l-3').addClass('l-' + level);
		this._starSelected(level);
		_deselect.bind(this)();
	});
	
	// Chapter dropdown
	$('#dd-chapter').off('change').change(() => {
		this._propagateDropdownSelected;
		_deselect.bind(this)();
	});
	
	// Exit selection
	$('#exit-selection').off('click').on('click', () => {
		_deselect.bind(this)();
	});

	// Reselect button
	$('#btn-reselect').off('click').on('click', _reselect.bind(this));

	function _deselect() {
		this.reselect = [...this.selected];
		this._deselectSelected();
	}

	function _reselect() {
		this.reselect.forEach($row => {
			this.select($row, true);
		});
	}
};


// Initialize pagination links
Table.prototype._initPagination = function() {
	this.$pagination.off('click').on('click', 'a', (e) => {
		loading();
		const urlQuery = window.location.search;
		const page = $(e.target).attr('href').slice(1);
		this.ajax({
			type: 'POST',
			url: '/search/p/' + page + urlQuery,
			success: this.updateTable
		});
		e.preventDefault();
	});
};


// Initialize header click events
Table.prototype._initHeader = function() {
	const $cb = this.$header.find('input[type=checkbox]');
	const $star = this.$header.find('.star');
	const $sortLinks = this.$header.find('a.sort-link');
	
	// Checkbox
	$cb.off('change').change((e) => {
		this._toggleSelectAll($(e.currentTarget));
	});
	
	// Star
	$star.off('click').on('click', (e) => {
		this._starAll($(e.currentTarget));
	});

	// Sorting
	$sortLinks.click((e) => {
		loading();
		const urlQuery = window.location.search;
		const sort = $(e.target).attr('data-sort');
		this.ajax({
			type: 'POST',
			url: '/search/s/' + sort + urlQuery,
			success: this.updateTable
		});
		e.preventDefault();
	});
};


// Handle row click event
Table.prototype._initRowClicks = function(e) {
	for (let i=1; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);

		$row.off('click')
			.on('click', '.star', () => { this._cycleStar($row) })
			.on('click', '.btn-archive', (e) => { this._toggleArchive($(e.target)); e.preventDefault(); })
			.on('click', '.btn-copy', (e) => { this._copyToClipboard($row); e.preventDefault(); })
			.on('click', 'checkbox, .cb, .tweet', (e) => { this._toggleSelect(e, $row); }); // Label & link clicks get blocked
	}
};


// Emable label UI
Table.prototype._initlabels = function() {
	// Show remove UI on label hover
	this.$table.find('.label-wrap').off('mouseenter').on('mouseenter', '.label', e => {
		setTimeout(() => {
			if ($(e.currentTarget).is(':hover')) $(e.currentTarget).addClass('remove');
		}, 500);
	}).off('mouseleave').on('mouseleave', '.label', (e) => {
		$(e.currentTarget).removeClass('remove');
	});

	// Remove label
	this.$table.find('.label-wrap').off('click').on('click', '.x', e => {
		const $row = $(e.target).closest('.table-row');
		const $label = $(e.target).closest('.label');
		this._removeLabel($row, $label);
	});

	// Autocomplete labels
	this.$ipAddLabel.autoComplete('destroy').autoComplete({
		source: (term, suggest) => {
			term = term ? term.toLowerCase() : '*'; // When there's no search term, return all
			// Suggest labels
			this.ajax({
				type: 'GET',
				url: '/api/labels/' + term,
				success: (matches) => {
					// Suggest matches
					suggest(matches);
				}
			});
		},
		cache: false,
		minChars: 0,
		onSelect: (e, term, input) => {
			// Get ids of selected labels
			const ids = [];
			this.selected.forEach(($row) => {
				// Check for duplicates
				isDuplicate = false;
				$row.find('.label').each((i, label) => {
					if ($(label).text() == term) {
						isDuplicate = true;
						return false;
					}
				});
				
				if (!isDuplicate) {
					// Store IDs
					ids.push($row.attr('data-id'));
					// Add labels to DOM, but in hold mode
					const html = $('#tmp-label').html().replace('value', term);
					const $label = $(html).addClass('hold');
					$row.find('.label-wrap').addClass('pad').append($label);
				}
			});

			// Return if all selected rows already have this label
			if (!ids.length) return;

			// Write label to tweets
			this.ajax({
				type: 'POST',
				url: '/api/labels',
				data: {
					ids: ids,
					value: term
				},
				success: () => {
					this.$ipAddLabel.val('');
					$('.label.hold').removeClass('hold');
				}
			});
		}
	});
}





/**
 * SELECTING
 */

// Toggle select all
Table.prototype._toggleSelectAll = function($target) {
	const value = $target.prop('checked');
	this._selectAll(value);
};


// Select all
Table.prototype._selectAll = function(value) {
	this.log('Table.selectAll');
	for (let i=0; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);
		this._select($row, value);
	}
};


// Deselect selected
Table.prototype._deselectSelected = function(value) {
	this.log('Table.deselectSelected');
	
	// Header is ignored by the select function so checkbox needs to be diabled separately
	this.$table.find('.table-header').find('input[type=checkbox]').prop('checked', false);

	// Deselect all selected rows
	this.reselect.forEach($row => {
		this._select($row, false, true);
	});
};


// Toggle select
Table.prototype._toggleSelect = function(e, $row) {
	// Block when label is clicked
	if ($(e.target).is('a, .label, .x')) return;

	// Check if we're selecting or deselecting
	const isSelected = $row.hasClass('sel');
	
	if (e.shiftKey && this.selected.length) {
		// Holding shift, you select all rows in between this and last
		const indexCurr = $row.index(); // Index of currently clicked row
		const indexLast = this.lastClicked.index(); // Index of previously clicked row
		const index1 = Math.min(indexCurr, indexLast);
		const index2 = Math.max(indexCurr, indexLast);
		for (let i=index1; i<=index2; i++) {
			this._select(this.$rows.eq(i), !isSelected);
		}
	} else {
		// Regular click, only select current row
		this._select($row, !isSelected);
	}
	
	// Register last row clicked
	this.lastClicked = $row;
};


// Select
// › select: boolean => select/deselect
Table.prototype._select = function($row, select, batch) {
	this.log('Table.select');

	// Ignore table header
	if ($row.is('.table-header')) return;

	// Color row.
	if (select) {
		$row.addClass('sel');
		if (this.callbacks.onSelect) this.callbacks.onSelect();
	} else {
		$row.removeClass('sel');
		if (this.callbacks.onDeselect) this.callbacks.onSelect();
	}
	
	// Update checkbox
	$row.find('input[type=checkbox]').prop('checked', select);
	
	// Check if row is already selected
	// Note: this.selected.indexOf($row) doesn't work because it stores jQuery objects
	let rowIndex = -1;
	this.selected.forEach(($selectedRow, i) => {
		if ($selectedRow.get(0) == $row.get(0)) rowIndex = i;
	});

	// Add row to selected array but prevent double adds
	const isFresh = (rowIndex == -1);
	if (select && isFresh) {
		this.selected.push($row);
	} else if (!select && !isFresh) {
		this.selected.splice(rowIndex, 1);
	}

	// Update reselect only when individual row is clicked
	if (!batch) this.reselect = [...this.selected];
	
	// Show controls when at least one row is selected
	if (this.selected.length == 0) {
		$('#controls').removeClass('select');
		if (this.reselect.length) $('#controls').addClass('reselect');
	} else {
		$('#controls').addClass('select');
		$('#controls').removeClass('reselect');
	}
};





/**
 * STARRING
 */

// Star all
Table.prototype._starAll = function($target) {
	if (!$target.hasClass('unlocked')) {
		$target.addClass('unlocked');
		if (!confirm('Are you sure you want to star all rows?')) return;
	}
	this.log('Table.starAll');

	const level = this.$header.attr('data-star') ? (+this.$header.attr('data-star') + 1) % 4 : 1;

	// Star all rows
	const ids = [];
	for (let i=0; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);
		this._star($row, level);
		if (i > 0) ids.push($row.attr('data-id'));
	}
	
	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/tweets/star',
		data: {
			ids: ids,
			level: level
		}
	});
};


// Star selected rows
Table.prototype._starSelected = function(level) {
	this.log('Table.starSelected');
	const ids = [];
	this.selected.forEach(($row, i) => {
		// Update UI.
		this._star($row, level);
		if ($row.attr('data-id')) ids.push($row.attr('data-id')); // Make sure not to include the header
	});
	
	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/tweets/star',
		data: {
			ids: ids,
			level: level
		}
	});
};


// Cycle star
Table.prototype._cycleStar = function($row) {
	const level = $row.attr('data-star') ? (+$row.attr('data-star') + 1) % 4 : 1;
	this._star($row, level, true);
	
};


// Star
Table.prototype._star = function($row, level, ajax) {
	this.log('Table.star');
	$row.removeClass('l-0 l-1 l-2 l-3').addClass('l-' + level).attr('data-star', level);
	
	// Ajax
	if (!ajax) return;
	
	this.ajax({
		type: 'PUT',
		url: '/api/tweets/star/' + $row.attr('data-id'),
		data: {
			level: level
		}
	});
};





/**
 * ARCHIVING
 */

// Toggle archive for selected rows
Table.prototype._toggleArchiveSelected = function($btn) {
	const doArchive = !$btn.hasClass('toggle');
	if (doArchive) {
		// YES - archive
		$btn.addClass('toggle');
		$btn.text('restore');
	} else {
		// NO - restore
		$btn.removeClass('toggle');
		$btn.text('archive');
	}
	
	this._archiveSelected(doArchive);
};


// Archive selected rows
Table.prototype._archiveSelected = function(doArchive) {
	this.log('Table.archiveSelected', doArchive);
	
	// Update UI
	const ids = [];
	this.selected.forEach(function($row, i) {
		this.archive($row, doArchive);
		if ($row.attr('data-id')) ids.push($row.attr('data-id')); // Make sure not to include the header
	}.bind(this));
	
	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/tweets/archive',
		data: {
			ids: ids,
			doArchive: doArchive
		}
	});
};


// Toggle archive tweet
Table.prototype._toggleArchive = function($btn) {
	const $row = $btn.closest('.table-row');
	const doArchive = !$row.hasClass('archived');
	this._archive($row, doArchive, true);
	$btn.text(doArchive ? 'restore' : 'archive');
};


// Archive tweet
Table.prototype._archive = function($row, doArchive, ajax) {
	this.log('Table.archive');

	if (doArchive) {
		$row.addClass('archived');
	} else {
		$row.removeClass('archived');
	}

	if (!ajax) return;
	
	// Ajax
	const id = $row.attr('data-id');

	this.ajax({
		type: 'PUT',
		url: '/api/tweets/archive/' + id,
		data: { doArchive: doArchive }
	});
};





/**
 * ORGANIZING
 */

// Propagate main dropdown to selected rows
Table.prototype._propagateDropdownSelected = function() {
	this.log('Table.propagateDropdownSelected');
	const ids = [];
	const value = $('#dd-chapter').val();
	
	// Update UI
	this.selected.forEach(function($row, i) {
		ids.push($row.attr('data-id'));
		this.propagateDropdown($row.find('select').eq(0), value);
	}.bind(this));
	
	// Ajax
	this.ajax('organize', ids, value);
	
};


// Propagate to individual row dropdown
Table.prototype._propagateDropdown = function($dropdown, value) {
	// Update dropdown value (invisible)
	$dropdown.val(value);
	
	// Update display (visible)
	this._updateDropdownDisplay($dropdown, true);
};


// Update dropdown display
Table.prototype._updateDropdownDisplay = function($dropdown, noAjax) {
	this.log('Table.updateDropdownDisplay');
	
	// Update display (dropdown itself is invisible)
	const value = $dropdown.find('option:selected').val();
	const displayValue = $dropdown.find('option:selected').text();
	$dropdown.next().html(displayValue);
	
	
	// Ajax
	if (!noAjax) {
		const id = $dropdown.closest('.table-row').attr('id');
		this.ajax('organize', id, value);
	}
};





/**
 * LABELING
 */

Table.prototype._removeLabel = function($row, $label) {
	// Instant feedback
	$label.addClass('hold');

	// Remove
	this.ajax({
		type: 'PUT',
		url: '/api/labels/remove',
		data: {
			id: $row.attr('data-id'),
			value: $label.text()
		},
		success: () => {
			$label.remove();
		}
	});
};





/**
 * COPYING
 */

// Copy tweet to clipboard
Table.prototype._copyToClipboard = function($row) {
	// Create input field
	const $ip = $('<input>')
		.attr('type', 'text')
		.val($row.find('.tweet span').text())
		.css({
			position: 'absolute',
			top: 0,
			left: 0,
			opacity: 0
		}).appendTo('body');
	
	// Select text
	$ip.get(0).select();
	$ip.get(0).setSelectionRange(0, 99999); // For mobile devices.
		
	// Copy text
	document.execCommand('copy');
	
	// Remove from dom
	$ip.remove();
	
	// UI update
	$row.addClass('copied');
	setTimeout(function() {
		$row.removeClass('copied');
	}, 1000);
};





/**
 * AJAX HANDLING
 */

Table.prototype.ajax = function(params) {
	// Extract callback
	const callback = params.success;
	delete params.success;

	// Insert default parameters
	const defaultParams = {
		dataType: 'json',
		encode: true,
		error: _error.bind(this),
		success: _success.bind(this)
	}
	params = {...defaultParams, ...params};

	// Send to server
	$.ajax(params);

	function _error(error) {
		this.log('error:', error);
	}

	function _success(result) {
		this.log('result:', result);
		if (callback) callback(result);
	}
};


// This is called whenever a search operation returns result
Table.prototype.updateTable = function(data, noUrl) {
	if (noUrl !== true) history.pushState(data, '', '/search' + data.urlQuery);
	$('#table-wrap').html(data.html);
	console.log(data)
	$('#search-results-count').text(data.resultCount + ' results');
	table.init();
	loading(false);
};





/**
 * Debugging
 */

Table.prototype.log = function(text) {
	if (this.debug) console.log(text);
}