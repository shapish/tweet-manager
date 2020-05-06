// To do:
// - label suggests to add existing value with capital

function Table() {
	this.selected = [];
	this.lastClicked = null;
	this.$ipAddLabel = $('input#add-label');
	this.init();

	this.debug = false;
}

// Initialize
Table.prototype.init = function() {
	this.$table = $('#tweet-table');
	this.$header = this.$table.children().eq(0);
	this.$rows = this.$table.children();
	
	// Hook up top controls
	this.initControls();
	
	// Hook up header clicks
	this.initHeader();
	
	// Hook up row clicks
	this.handleRowClicks();
	// $('input[type=checkbox]').eq(1).trigger('click'); // ## DEV

	// Hook up labels
	this.initlabels();
	
	// Hook up dropdowns
	this.$dropdowns = this.$table.find('select');
	for (let i=0; i<this.$dropdowns.length; i++) {
		this.$dropdowns.eq(i).change((e) => {
			this.updateDropdownDisplay($(e.currentTarget));
		});
	}
};

// Initialize controls at the top
Table.prototype.initControls = function() {
	// Archive button
	$('#btn-archive').click((e) => {
		this.toggleArchiveSelected($(e.currentTarget));
	});
	
	// Star dropdown
	$('#dd-star-display').on('change', (e) => {
		const $target = $(e.currentTarget);
		const level = $target.attr('data-value');
		$target.removeClass('l-0 l-1 l-2 l-3').addClass('l-' + level);
		this.starSelected(level);
	});
	
	// Chapter dropdown
	$('#dd-chapter').change($.proxy(this.propagateDropdownSelected, this));
	
	// Exit selection
	$('#exit-selection').click(() => {
		this.selectAll(false);
	});
};

// Initialize header click events
Table.prototype.initHeader = function() {
	const $cb = this.$header.find('input[type=checkbox]');
	const $star = this.$header.find('.star');
	
	// Checkbox
	$cb.change((e) => {
		this.toggleSelectAll($(e.currentTarget));
	});
	
	// Star
	$star.click((e) => {
		this.starAll($(e.currentTarget));
	});
};

// Handle row click event
Table.prototype.handleRowClicks = function(e) {
	for (let i=1; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);

		$row.on('click', '.star', () => { this.cycleStar($row) });
		$row.on('click', '.btn-archive', (e) => { this.toggleArchive($(e.target)); e.preventDefault(); });
		$row.on('click', '.btn-copy', (e) => { this.copyToClipboard($row); e.preventDefault(); });
		$row.on('click', 'checkbox, .cb, .tweet', (e) => { this.toggleSelect(e, $row); }); // Label & link clicks get blocked
		
	}
};

// Emable label UI
Table.prototype.initlabels = function() {
	// Show remove UI on label hover
	this.$table.find('.label-wrap').on('mouseenter', '.label', e => {
		setTimeout(() => {
			console.log('##', $(e.currentTarget).is(':hover'), $(e.currentTarget), $(e.target))
			if ($(e.currentTarget).is(':hover')) $(e.currentTarget).addClass('remove');
		}, 500);
	}).on('mouseleave', '.label', (e) => {
		$(e.currentTarget).removeClass('remove');
	});

	// Remove label
	this.$table.find('.label-wrap').on('click', '.x', e => {
		const $row = $(e.target).closest('.table-row');
		const $label = $(e.target).closest('.label');
		this.removeLabel($row, $label);
	});

	// Autocomplete labels
	this.$ipAddLabel.autoComplete({
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
					$row.find('.label-wrap').append($label);
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
Table.prototype.toggleSelectAll = function($target) {
	const value = $target.prop('checked');
	this.selectAll(value);
};

// Select all
Table.prototype.selectAll = function(value) {
	console.log('Table.selectAll');
	for (let i=0; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);
		this.select($row, value);
	}
};

// Toggle select
Table.prototype.toggleSelect = function(e, $row) {
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
		// console.log(index1 + ' --> ' + index2);
		for (let i=index1; i<=index2; i++) {
			this.select(this.$rows.eq(i), !isSelected);
		}
	} else {
		// Regular click, only select current row
		this.select($row, !isSelected);
	}
	
	// Register last row clicked
	this.lastClicked = $row;
};

// Select
// › select: boolean => select/deselect
Table.prototype.select = function($row, select) {
	console.log('Table.select');
	// Color row.
	if (select) {
		$row.addClass('sel');
	} else {
		$row.removeClass('sel');
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
	
	// Show controls when at least one row is selected
	if (this.selected.length == 0) {
		$('#controls').addClass('hide');
		$('#filters').removeClass('hide');
	} else if ($('#controls').hasClass('hide')) {
		$('#controls').removeClass('hide');
		$('#filters').addClass('hide');
	}
};





/**
 * STARRING
 */

// Star all
Table.prototype.starAll = function($target) {
	if (!$target.hasClass('unlocked')) {
		$target.addClass('unlocked');
		if (!confirm('Are you sure you want to star all rows?')) return;
	}
	console.log('Table.starAll');
	const level = this.$header.attr('data-star') ? (+this.$header.attr('data-star') + 1) % 4 : 1;

	// Star all rows
	const ids = [];
	for (let i=0; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);
		this.star($row, level);
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
Table.prototype.starSelected = function(level) {
	console.log('Table.starSelected');
	const ids = [];
	this.selected.forEach(function($row, i) {
		// Update UI.
		this.star($row, level);
		if ($row.attr('data-id')) ids.push($row.attr('data-id')); // Make sure not to include the header
	}.bind(this));
	
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
Table.prototype.cycleStar = function($row) {
	const level = $row.attr('data-star') ? (+$row.attr('data-star') + 1) % 4 : 1;
	this.star($row, level, true);
	
};


// Star
Table.prototype.star = function($row, level, ajax) {
	console.log('Table.star');
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
Table.prototype.toggleArchiveSelected = function($btn) {
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
	
	this.archiveSelected(doArchive);
};

// Archive selected rows
Table.prototype.archiveSelected = function(doArchive) {
	console.log('Table.archiveSelected', doArchive);
	
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
Table.prototype.toggleArchive = function($btn) {
	const $row = $btn.closest('.table-row');
	const doArchive = !$row.hasClass('archived');
	this.archive($row, doArchive, true);
	$btn.text(doArchive ? 'restore' : 'archive');
};

// Archive tweet
Table.prototype.archive = function($row, doArchive, ajax) {
	console.log('Table.archive');

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
Table.prototype.propagateDropdownSelected = function() {
	console.log('Table.propagateDropdownSelected');
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
Table.prototype.propagateDropdown = function($dropdown, value) {
	// Update dropdown value (invisible)
	$dropdown.val(value);
	
	// Update display (visible)
	this.updateDropdownDisplay($dropdown, true);
};

// Update dropdown display
Table.prototype.updateDropdownDisplay = function($dropdown, noAjax) {
	console.log('Table.updateDropdownDisplay');
	
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

Table.prototype.removeLabel = function($row, $label) {
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
Table.prototype.copyToClipboard = function($row) {
	// Create input field
	const $ip = $('<input>')
		.attr('type', 'text')
		.val($row.find('.tweet').text())
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
		error: _error,
		success: _success
	}
	params = {...defaultParams, ...params};

	// Send to server
	$.ajax(params);

	function _error(error) {
		if (this.debug) console.log('error:', error);
	}

	function _success(result) {
		if (this.debug) console.log('result:', result);
		if (callback) callback(result);
	}
};