function Table() {
	this.selected = [];
	this.lastClicked = null;
	this.init();
}

// Initialize.
Table.prototype.init = function() {
	this.$table = $('#tweet-table');
	this.$header = this.$table.children().eq(0);
	this.$rows = this.$table.children();
	
	// Hook up top controls.
	this.initControls();
	
	// Hook up header clicks.
	this.initHeader();
	
	// Hook up row clicks.
	for (let i=1; i<this.$rows.length; i++) {
		this.$rows.eq(i).click((e) => {
			this.handleRowClick(e);
		});
	}

	// Hook up labels
	this.initlabels();
	
	// Hook up dropdowns.
	this.$dropdowns = this.$table.find('select');
	for (let i=0; i<this.$dropdowns.length; i++) {
		this.$dropdowns.eq(i).change((e) => {
			this.updateDropdownDisplay($(e.currentTarget));
		});
	}
};

// Initialize controls at the top + pagination.
Table.prototype.initControls = function() {
	// Archive button.
	$('#btn-archive').click((e) => {
		this.toggleArchiveSelected($(e.currentTarget));
	});
	
	// Star button.
	$('#btn-star').click((e) => {
		this.toggleStarSelected($(e.currentTarget));
	});
	
	// Chapter dropdown.
	$('#dd-chapter').change($.proxy(this.propagateDropdownSelected, this));
	
	// Exit selection
	$('#exit-selection').click(() => {
		this.selectAll(false);
	});

	// Pagination.
	$('#table-pagination').children().eq(0).click((e) => {
		this.changePage(true);
		e.preventDefault();
	});
	$('#table-pagination').children().eq(2).click((e) => {
		this.changePage(false);
		e.preventDefault();
	});
};

// Initialize header click events.
Table.prototype.initHeader = function() {
	const $cb = this.$header.find('input[type=checkbox]');
	const $star = this.$header.find('.star');
	
	// Checkbox.
	$cb.change((e) => {
		this.toggleSelectAll($(e.currentTarget));
	});
	
	// Star.
	$star.click((e) => {
		this.toggleStarAll($(e.currentTarget));
	});
};

// Emable label UI
Table.prototype.initlabels = function() {
	$('input#add-label').autoComplete({
		source: (term, suggest) => {
			term = term.toLowerCase();
			const choices = ['hoax', 'hoarse', 'horse', 'hoaly', 'hoarder', 'impeachment', 'russia', 'ukraine', 'rant'];
			let matches = [];
			for (i=0; i<choices.length; i++) {
				if (~choices[i].toLowerCase().indexOf(term)) {
					matches.push(choices[i]);
				}
			}
			// When there's no result, offer to create new label
			// if (!matches.length) matches.push('add: "' + term + '"');
			if (!matches.length) matches.push(term);
			suggest(matches);
		},
		minChars: 0,
		onSelect: (e, term, input) => {
			console.log(this.selected)
			// Update UI
			// $ip.val('');
			// $row.find('.label-wrap').append('<a href="#" class="label">' + term + '</a>');

			// Store label
			// this.ajax('store-label', id, term);
		}
	});












	$('.add-label').click((e) => {
		// Avoid duplicate input
		const $row = $(e.currentTarget).closest('.table-row');
		if ($row.find('.add-label-input').length) return;

		// Create input
		const $ip = $('<input>')
			.attr('type', 'text')
			.attr('placeholder', 'search labels')
			.addClass('add-label-input')
			.focus();

		$(e.currentTarget).parent().after($ip);

		// Store id
		const id = $row.attr('id');

		// Hook up input
		$ip.autoComplete({
			source: (term, suggest) => {
				term = term.toLowerCase();
				const choices = ['hoax', 'hoarse', 'horse', 'hoaly', 'hoarder', 'impeachment', 'russia', 'ukraine', 'rant'];
				let matches = [];
				for (i=0; i<choices.length; i++) {
					if (~choices[i].toLowerCase().indexOf(term)) {
						matches.push(choices[i]);
					}
				}
				// When there's no result, offer to create new label
				// if (!matches.length) matches.push('add: "' + term + '"');
				if (!matches.length) matches.push(term);
				suggest(matches);
			},
			minChars: 0,
			onSelect: (e, term, input) => {
				// Update UI
				$ip.val('');
				$row.find('.label-wrap').append('<a href="#" class="label">' + term + '</a>');

				// Store label
				this.ajax('store-label', id, term);
			}
		});
	});
}

// Dispatch row click event.
Table.prototype.handleRowClick = function(e) {
	const $row = $(e.currentTarget);
	const $target = $(e.target);
	if ($target.hasClass('star')) {
		// Star tweet.
		this.toggleStar($row);
	} else if ($target.hasClass('btn-archive')) {
		// Archive tweet.
		this.toggleArchive($row);
		e.preventDefault();
	} else if ($target.hasClass('btn-copy')) {
		// Copy tweet to clipboard.
		this.copyToClipboard($row);
		e.preventDefault();
	} else if ($target.is('a') || $target.is('select') || $target.is('input')) {
		// Links & dropdown - do nothing.
	} else {
		// Select.
		this.toggleSelect(e, $row);
	}
};





// * * * SELECTING * * * //

// Toggle select all.
Table.prototype.toggleSelectAll = function($target) {
	const value = $target.prop('checked');
	console.log(value)
	this.selectAll(value);
};

// Select all.
Table.prototype.selectAll = function(value) {
	console.log('Table.selectAll');
	for (let i=1; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i)
		const id = $row.attr('id');
		this.select($row, id, value);
	}
};

// Toggle select.
Table.prototype.toggleSelect = function(e, $row) {
	// Check if we're selecting or deselecting.
	const value = !$row.hasClass('sel');
	// const act = row.hasClass('sel') ? this.deselect.bind(this) : this.select.bind(this);
	
	if (e.shiftKey && this.selected.length) {
		// Holding shift, you select all rows in between this and last.
		const indexCurr = index($row);
		const indexLast = index(this.lastClicked);
		const index1 = Math.min(indexCurr, indexLast);
		const index2 = Math.max(indexCurr, indexLast);
		// console.log(index1 + ' --> ' + index2);
		for (let i=index1; i<=index2; i++) {
			const id = this.$rows.get(i).attr('id');
			this.select(this.$rows.get(i), id, value);
			// console.log(i)
		}
	} else {
		// Regular click, only select current row.
		const id = $row.attr('id');
		this.select($row, id, value);
	}
	
	// Register last row clicked.
	this.lastClicked = $row;
	
	// Get index of row.
	function index($row) {
	  const $siblings = $row.siblings();
	  let num = 0;
	  for (let i=0; i<$siblings.length; i++) {
			if ($siblings.get(i) == $row) return num;
			num++;
	  }
	  return -1;
	}
};

// Select.
Table.prototype.select = function($row, id, value) {
	console.log('Table.select');
	// Color row.
	if (value) {
		$row.addClass('sel');
	} else {
		$row.removeClass('sel');
	}
	
	// Update checkbox.
	$row.find('input[type=checkbox]').prop('checked', value);
	
	// Add or  ID but prevent double adds.
	const idIndex = this.selected.indexOf(id);
	if (value && idIndex == -1) {
		this.selected.push(id);
	} else if (!value && idIndex != -1) {
		this.selected.splice(idIndex, 1);
	}
	
	// Show controls when at least one row is selected.
	if (this.selected.length == 0) {
		$('#controls').addClass('hide');
		$('#filters').removeClass('hide');
	} else if ($('#controls').hasClass('hide')) {
		$('#controls').removeClass('hide');
		$('#filters').addClass('hide');
	}
};





// * * * STARRING * * * //

// Toggle star all.
Table.prototype.toggleStarAll = function(target) {
	const $header = $(target).parent();
	const value = !$header.hasClass('star');
	this.starAll($header, value);
};

// Star all.
Table.prototype.starAll = function($header, value) {
	if (!confirm('Are you sure you want to ' + (value ? '' : 'un') + 'star all rows?')) {
		return;
	}
	console.log('Table.starAll');
	// Update header star.
	if (value) {
		$header.addClass('star');
	} else {
		$header.removeClass('star');
	}
	// Star all rows.
	for (let i=1; i<this.$rows.length; i++) {
		const $row = this.$rows.eq(i);
		this.star($row, value, true);
	}
	
	// Ajax
	const ids = [];
	for (let i=1; i<this.$rows.length; i++) {
		ids.push(this.$rows.eq(i).attr('id'));
	}
	this.ajax('star', ids, value);
};

// Toggle star selected rows.
Table.prototype.toggleStarSelected = function($btn) {
	const value = $btn.children().eq(1).text() == 'star';
	$btn.children().eq(0).text(value ? '\u2606' : '\u2605');
	$btn.children().eq(1).text(value ? 'unstar' : 'star');
	this.starSelected(value);
};

// Star all selected rows.
Table.prototype.starSelected = function(value) {
	console.log('Table.starSelected');
	this.selected.forEach(function(id, i) {
		// Update UI.
		this.star($('#'+id), value, true);
	}.bind(this));
	
	// Ajax.
	this.ajax('star', this.selected, value);
};

// Toggle star.
Table.prototype.toggleStar = function($row) {
	console.log($row)
	const value = !$row.hasClass('star');
	this.star($row, value);
};

// Star.
Table.prototype.star = function($row, value, noAjax) {
	console.log('Table.star');
	console.log($row)
	const id = $row.attr('id');
	if (value) {
		$row.addClass('star');
	} else {
		$row.removeClass('star');
	}
	
	// Ajax.
	if (!noAjax) {
		this.ajax('star', id, value);
	}
};





// * * * ARCHIVING * * * //

// Toggle archive selected rows.
Table.prototype.toggleArchiveSelected = function($btn) {
	const value = $btn.attr('value') == 'archive';
	$btn.val(value ? 'restore' : 'archive');
	this.archiveSelected(value);
};

// Archive all selected rows.
Table.prototype.archiveSelected = function(value) {
	console.log('Table.archiveSelected');
	// Update UI.
	this.selected.forEach(function(id, i) {
		this.archive($('#'+id), value, true);
	}.bind(this));
	
	// Ajax.
	this.ajax('archive', this.selected, value);
};

// Toggle archive tweet.
Table.prototype.toggleArchive = function($row) {
	const value = !$row.hasClass('archived');
	this.archive($row, value);
};

// Archive tweet.
Table.prototype.archive = function($row, value, noAjax) {
	console.log('Table.archive');
	if (value) {
		$row.addClass('archived');
	} else {
		$row.removeClass('archived');
	}
	
	// Ajax.
	const id = $row.attr('id');
	if (!noAjax) {
		this.ajax('archive', id, value);
	}
};





// * * * ORGANIZE * * * //

// Propagate main dropdown to selected rows.
Table.prototype.propagateDropdownSelected = function() {
	console.log('Table.propagateDropdownSelected');
	const ids = [];
	const value = $('#dd-chapter').val();
	
	// Update UI.
	this.selected.forEach(function(id, i) {
		ids.push(id);
		this.propagateDropdown($('#'+id+' select').eq(0), value);
	}.bind(this));
	
	// Ajax.
	this.ajax('organize', ids, value);
	
};

// Propagate to individual row dropdown.
Table.prototype.propagateDropdown = function($dropdown, value) {
	// Update dropdown value (invisible).
	console.log($dropdown.get(0), value)
	$dropdown.val(value);
	
	// Update display (visible).
	this.updateDropdownDisplay($dropdown, true);
};

// Update dropdown display.
Table.prototype.updateDropdownDisplay = function($dropdown, noAjax) {
	console.log('Table.updateDropdownDisplay');
	
	// Update display (dropdown itself is invisible).
	const value = $dropdown.find('option:selected').val();
	const displayValue = $dropdown.find('option:selected').text();
	$dropdown.next().html(displayValue);
	
	
	// Ajax.
	if (!noAjax) {
		const id = $dropdown.closest('.table-row').attr('id');
		this.ajax('organize', id, value);
	}
};





// * * * AJAX HANDLING * * * //

// Handle ajax calls.
// Ids can be single id or array.
Table.prototype.ajax = function(action, id, value) {
	if (Array.isArray(id)) {
		console.log('Ajax - action: ' + action + ' / id: ' + id.toString() + ' / value: ' + value);
	} else {
		console.log('Ajax - action: ' + action + ' / id: ' + id + ' / value: ' + value);
	}
};





// * * * COPY * * * //

// Copy tweet to clipboard
Table.prototype.copyToClipboard = function($row) {
	// Create input field.
	const $ip = $('<input>')
		.attr('type', 'text')
		.val($row.find('.tweet').text())
		.css({
			position: 'absolute',
			top: 0,
			left: 0,
			opacity: 0
		}).appendTo('body');
	
	// Select text.
	$ip.get(0).select();
	$ip.get(0).setSelectionRange(0, 99999); // For mobile devices.
		
	// Copy text.
	document.execCommand('copy');
	
	// Remove from dom.
	$ip.remove();
	
	// UI update.
	$row.addClass('copied');
	setTimeout(function() {
		$row.removeClass('copied');
	}, 1000);
};


Table.prototype.changePage = function(next) {
	if (next) {
		console.log('Table.changePage - prev');
	} else {
		console.log('Table.changePage - next');
	}
};