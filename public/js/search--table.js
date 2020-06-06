// Table
const tweetTable = new Table('tweet-table', {
	paginationSelector: '#table-wrap .pagination',
	path: '/search',
	rowSelectable: 'checkbox, .cb, .main',
	rowNotSelectable: 'a, .label, .x, .link, .link *',
	onRowClick:	onRowClick,
	localKeys: localKeys,
	initExternal: function() {
		initLabels.bind(this)();
		initLabelClick.bind(this)();
		
		// Hook up dropdowns
		this.$dropdowns = this.$table.find('select');
		for (let i=0; i<this.$dropdowns.length; i++) {
			this.$dropdowns.eq(i).off('change.local').on('change.local', (e) => {
				this._updateChapter($(e.currentTarget));
			});
		}
	}
},{
	onSelect: hideSettings,
	onDeselect: hideSettings,
	onPopState: (data) => { $('#search').val(data.q) },
	onUpdateTable: (data) => {
		$('#search-results-count').text(data.resultCount + ' results');
		$('#query-data').replaceWith(data.queryDataHtml);
		$('#search').val(data.q); // In case user removes query, can be confusing
	}
});

initControls.bind(tweetTable)();

// Handle additional row click events
function onRowClick($row) {
	$row.on('click', '.icn-star', () => { this._cycleStar($row) });
	$row.on('click', '.btn-archive', (e) => { this._toggleArchive($(e.target)); e.preventDefault(); });
	$row.on('click', '.btn-copy', (e) => { this._copyToClipboard($row); e.preventDefault(); });
	// $row.on('click', '.link', (e) => { window.open($(e.currentTarget).attr('href')); console.log($(e.currentTarget).attr('href')) });
	$row.on('click', '.link', (e) => {
		const $link = $(e.currentTarget);
		// Avoid overlapping links to fire twice
		if (!$link.find('.link.clicked').length) {
			window.open($link.attr('href'));
			$link.addClass('clicked');
			setTimeout(() => { $link.removeClass('clicked') }, 100);
		}
	});
}

function hideSettings() {
	$('#settings').removeClass('show');
}





/**
 * INITIALIZE
 */

// Initialize controls at the top
function initControls() {
	// Archive button
	$('#btn-archive').off('click').on('click', (e) => {
		this._toggleArchiveSelected($(e.currentTarget));
	});
	
	// Star dropdown
	$('#dd-stars').off('change.local').on('change.local', (e) => {
		const $target = $(e.currentTarget);
		const level = $target.attr('data-value');
		this._starSelected(level);
	});
	
	// Chapter dropdown
	$('#dd-chapter').off('change.local').on('change.local', () => {
		this._updateSelectedChapters();
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
			this._select($row, true);
		});
	}
};

// Enable label UI
function initLabels() {
	this.$ipAddLabel = $('input#add-label');

	// Show remove UI on label hover
	this.$table.find('.label-wrap').off('mouseenter').on('mouseenter', '.label', e => {
		if ($(e.currentTarget).hasClass('deleted')) return;
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
		e.preventDefault();
	});

	// Replace spaces with dashes when typing/pasting label
	this.$ipAddLabel.on('keydown', e => {
		if (e.which == 32) {
			// Space
			this.$ipAddLabel.val(this.$ipAddLabel.val() + '-');
			e.preventDefault();
		}
	}).on('paste', e => {
		// Get pasted data via clipboard API
		clipboardData = e.originalEvent.clipboardData || window.clipboardData;
		pastedData = clipboardData.getData('text').replace(/\s+/g, '-');

		// Replace spaces
		this.$ipAddLabel.val(pastedData);
		e.preventDefault();
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

// Initialize label clicks
function initLabelClick() {
	this.$table.find('.label').click(e => {
		if ($(e.target).hasClass('x')) return;
		const label = $(e.target).text();
		const labelsAND = $('#query-data').attr('data-labels-and').split(',');
		const labelsOR = $('#query-data').attr('data-labels-or').split(',');
		let q = $('#search').val();

		// Hold shift or command to add label to query instead of replace query
		const suffix = e.metaKey ? '!' : '';
		if (e.shiftKey) {
			if (!labelsAND.includes(label) && !labelsOR.includes(label)) {
				// Add label to query
				q += ' #' + label + suffix
			} else {
				// Change label from OR to AND
				const re = new RegExp('#' + label + '\\b!{0,1}', 'i');
				q = q.replace(re, '#' + label + suffix);
			}
		} else {
			// Replace query
			q = '#' + label + suffix;
		}

		$('#search').val(q).parent().trigger('submit');
		e.preventDefault();
	});
}

// Initialize local keyboard events
// Return false --> blocks default keyhandler from executing
function localKeys(e) {
	if ((e.which >= 65 && e.which <= 90) || e.which >= 97 && e.which <= 122) {
		// Any letter: focus search/label input
		if (this.selected.length) {
			if (!$('input').is(':focus')) {
				$('#add-label').val('').focus();
			}
		} else {
			if (!$('#search').is(':focus')) {
				$('#search').val('').focus();
			}
		}
	} else if (e.which == 27) {
		// Esc: exit search.label
		if ($('#add-label').is(':focus')) {
			$('#add-label').blur();
			return false;
		} else if ($('#search').is(':focus')) {
			$('#search').blur();
			return false;
		} else if (!this.selected.length) {
			$('#search').focus();
		}
	}
	return true;
}



/**
 * ARCHIVING
 */

// Toggle archive for selected rows
tweetTable._toggleArchiveSelected = function($btn) {
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
tweetTable._archiveSelected = function(doArchive) {
	this.log('Table.archiveSelected', doArchive);
	
	// Update UI
	const ids = [];
	this.selected.forEach(function($row, i) {
		this._archive($row, doArchive);
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
tweetTable._toggleArchive = function($btn) {
	const $row = $btn.closest('.table-row');
	const doArchive = !$row.hasClass('archived');
	this._archive($row, doArchive, true);
	$btn.text(doArchive ? 'restore' : 'archive');
};


// Archive tweet
tweetTable._archive = function($row, doArchive, ajax) {
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
tweetTable._updateSelectedChapters = function() {
	this.log('Table.propagateDropdownSelected');

	const $dropdown = $('#dd-chapter');
	const newChapterId = $dropdown.attr('data-value');
	const tweetIds = [];
	const oldChapterIds = [];
	
	// Update UI
	this.selected.forEach(function($row, i) {
		tweetIds.push($row.attr('data-id'));
		oldChapterIds.push($row.attr('data-chapter-id'));
		const $rowDropdown = $row.find('select').eq(0);
		// Update dropdown value (invisible)
		$rowDropdown.val(newChapterId);
		// Update display (visible)
		this._updateRowChapterDisplay($rowDropdown);
	}.bind(this));
	
	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/tweets/assign',
		data: {
			tweetIds: tweetIds,
			oldChapterIds: oldChapterIds,
			newChapterId: newChapterId
		},
		error: () => {
			$dropdown.prev().text('ERROR');
		}
	});
	
};


// Update row dropdown display
tweetTable._updateChapter = function($rowDropdown) {
	this.log('Table.updateDropdownDisplay');
	
	// Store new chapter id
	const oldChapterId = $rowDropdown.closest('.table-row').attr('data-chapter-id');
	const newChapterId = $rowDropdown.find('option:selected').val();
	$rowDropdown.closest('.table-row').attr('data-chapter-id', newChapterId);

	// Update display
	this._updateRowChapterDisplay($rowDropdown);
	
	// Ajax
	const tweetId = $rowDropdown.closest('.table-row').attr('data-id');
	this.ajax({
		type: 'PUT',
		url: '/api/tweets/assign',
		data: {
			tweetIds: [tweetId],
			oldChapterIds: [oldChapterId],
			newChapterId: newChapterId
		},
		error: () => {
			$rowDropdown.prev().text('ERROR');
		}
	});
};


// Update row dropdown display (dropdown itself is invisible)
tweetTable._updateRowChapterDisplay = function($rowDropdown) {
	const displayValue = $rowDropdown.find('option:selected').attr('data-text');
	$rowDropdown.parent().children('a').text(displayValue);
}





/**
 * LABELING
 */

tweetTable._removeLabel = function($row, $label) {
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
tweetTable._copyToClipboard = function($row) {
	// Create input field
	const $ip = $('<input>')
		.attr('type', 'text')
		.val($row.attr('data-plain-text'))
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