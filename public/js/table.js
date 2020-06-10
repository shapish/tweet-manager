// To do:
// - label suggests to add existing value with capital

function Table(id, options, callbacks) {
	this.id = id;
	this.options = options;
	this.debug = false;

	// Read static options
	this.path = options.path ? options.path : '/'; // Path of the page with table
	// Blocks table rows from being selectable
	this.noSelect = options.noSelect ? options.noSelect : false;
	// Page specific keyboard events
	this.localKeys = options.localKeys ? options.localKeys : () => { return true };
	// Queryselector indicating what children you can click to select a row
	this.rowSelectable = this.options.rowSelectable ? this.options.rowSelectable : null;
	this.rowNotSelectable = this.options.rowNotSelectable ? this.options.rowNotSelectable : null
	// Initialize external functions
	this.initExternal = this.options.initExternal ? this.options.initExternal : () => {};
	// Handle additional row click events
	this.onRowClick = this.options.onRowClick ? this.options.onRowClick : () => {};
	
	// Set callbacks: onSelect / onDeselect / onPopState / onError
	this.callbacks = {};
	this.callbacks.onSelect = callbacks.onSelect ? callbacks.onSelect : () => {};
	this.callbacks.onDeselect = callbacks.onDeselect ? callbacks.onDeselect : () => {};
	this.callbacks.onPopState = callbacks.onPopState ? callbacks.onPopState : () => {};
	this.callbacks.onUpdateTable = callbacks.onUpdateTable ? callbacks.onUpdateTable : () => {};

	// History back button
	$(window).on('popstate', (e) => {
		const data = e.originalEvent.state;
		if (data) {
			this.updateTable(data, true);
			// this.callbacks.onPopState(data);
		} else {
			location.reload();
		}
	});

	this.init();
}


// Initialize
Table.prototype.init = function() {
	// Set options
	this.$table = $('#' + this.id);
	this.$pagination = $(this.options.paginationSelector);

	// Set base variables
	this.$header = this.$table.children().eq(0);
	this.$rows = this.$table.children();
	this.selected = []; // $rows that are selected
	this.reselect = []; // $rows that can be reselected
	this.lastClicked = null;

	// Pagination links
	this._initPagination();
	
	// Hook up header clicks
	this._initHeader();
	
	// Hook up row clicks
	if (!this.noSelect) this._initRowClicks();
	// $('input[type=checkbox]').eq(1).trigger('click'); // ## DEV
	
	// Init keyboard navigation
	this._initKeys();

	// Initialize external functions
	this.initExternal.bind(this)();
};


// Initialize pagination links
Table.prototype._initPagination = function() {
	this.$pagination.off('click').on('click', 'a', (e) => {
		loading();
		const urlQuery = window.location.search;
		const page = $(e.target).attr('href').slice(1);
		this.ajax({
			type: 'POST',
			url: this.path + '/p/' + page + urlQuery,
			success: this.updateTable.bind(this)
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
			url: this.path + '/s/' + sort + urlQuery,
			success: this.updateTable.bind(this)
		});
		e.preventDefault();
	});
};


// Handle row click event
Table.prototype._initRowClicks = function(e) {
	for (let i=1; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);
		$row.off('click');
		this.onRowClick($row);
		$row.on('click', '.icn-star', () => { this._cycleStar($row) });
		$row.on('click', this.rowSelectable, (e) => { // Label & link clicks get blocked in toggleSelect // ##
			// Block when label is clicked
			// if ($(e.target).is(this.rowNotSelectable) || $(e.target).closest(this.rowNotSelectable).length) return;
			if ($(e.target).closest(this.rowNotSelectable).length) return;
			this._toggleSelect(e, $row);
		});
	}
};


// Keyboard navigation
Table.prototype._initKeys = function() {
	$(document).off('keydown.table').on('keydown.table', (e) => {
		// console.log(e.which);
		const $focus = this.$table.find('.table-row.focus');

		if (!this.localKeys(e)) return;

		switch (e.which) {
			case 40: // Down
				_focusDown.bind(this)(e, $focus);
				if (!e.metaKey) e.preventDefault();
				$(':focus').blur();
				break;
			case 38: // Up
				_focusUp.bind(this)(e, $focus);
				if (!e.metaKey) e.preventDefault();
				$(':focus').blur();
				break;
			case 13: // Enter
				// Select first row unless input is in focus
				if (!$('input:focus').length) {
					const $row = $focus.length ? $focus : this.$rows.eq(1);
					this._toggleSelect(e, $row);
				}
				break;
			case 27: // Esc
				this._deselectSelected();
				break;
		}
	});

	// Move focus down
	function _focusDown(e, $focus) {
		if (!$focus.length) {
			this.$rows.eq(1).addClass('focus');
		} else {
			if ($focus.is(':last-child')) return;
			$focus.removeClass('focus');
			const $next = $focus.next();
			$next.addClass('focus');
			// Extend (de)selection with shift-down
			if (e.shiftKey) {
				if ($focus.hasClass('sel')) {
					this._select($next, true);
				} else {
					this._select($next, false);
				}
			}
		}
	}

	// Move focus up
	function _focusUp(e, $focus) {
		if (!$focus.length) {
			this.$rows.last().addClass('focus');
		} else {
			if ($focus.index() == 1) return;
			$focus.removeClass('focus');
			const $prev = $focus.prev();
			$prev.addClass('focus');
			// Extend (de)selection with shift-up
			if (e.shiftKey) {
				if ($focus.hasClass('sel')) {
					this._select($prev, true);
				} else {
					this._select($prev, false);
				}
			}
		}
	}
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
		this.$table.find('.table-row.focus').removeClass('focus');
		$row.addClass('sel focus');
		this.callbacks.onSelect();
	} else {
		$row.removeClass('sel');
		this.callbacks.onDeselect();
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
	clearTimeout($row.data('to-display'));
	if (level || level === 0) {
		$row.addClass('display');
		$row.data('to-display', setTimeout(() => { $row.removeClass('display') }, 1000));
	}
	
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
 * AJAX HANDLING
 */

Table.prototype.ajax = function(params) {
	// Extract callback
	const success = params.success;
	const error = params.error;
	delete params.success;
	delete params.error;

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

	function _error(err) {
		this.log('error:', err);
		if (error) error(err);
	}

	function _success(result) {
		this.log('result:', result);
		if (success) success(result);
	}
};


// This is called whenever a search operation returns result
Table.prototype.updateTable = function(data, noUrl) {
	if (noUrl !== true) history.pushState(data, '', this.path + data.urlQuery);
	$('#table-wrap').html(data.html);
	this.init();
	$('#btn-reselect').hide();
	$('#controls').removeClass('select');
	loading(false);
	this.callbacks.onUpdateTable(data);
};





/**
 * Debugging
 */

Table.prototype.log = function(text) {
	if (this.debug) console.log(text);
}