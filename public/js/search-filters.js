function SearchFilters(options) {
	this.init();
	this.onSuccess = options.onSuccess ? options.onSuccess : () => {};
}



SearchFilters.prototype.init = function() {
	// Capture nav clicks
	$('#filters, #nav-cal').on('click', 'a', (e) => {
		e.preventDefault();

		const action = $(e.target).attr('href').slice(1);
		let state;
		if ($(e.target).hasClass('triad')) {
			// Triple-state items
			// 1: show (starred) tweets / -1: show (unstarred) tweets / 0: show both
			state = $(e.target).hasClass('sel') ? $(e.target).hasClass('un') ? 0 : -1 : 1;
			this.clickTriad($(e.target), action, state);
		} else {
			// Dual-state items
			state = $(e.target).hasClass('sel') ? 0 : 1;
			// Highlighted items are not clickable
			if (!state && !action.match(/^settings$|^cal$|^m-\d{1,2}$|^y-\d{4}$/)) { console.log('return'); return; }
			this.clickDyad($(e.target), action, state);
		}
	});
};



// Nav items with two states
SearchFilters.prototype.clickDyad = function($elm, action, state) {
	// handle mutually exclusive filters (type, year, month)
	if ($elm.attr('name')) {
		$elm.parent().children('[name=' + $elm.attr('name') + ']').removeClass('sel');
		$elm.addClass('sel');
	}
	if (state) {
		// On
		$elm.addClass('sel');
	} else if ($elm.attr('name') != 'type') { // State (all/og/rt) can't be deselected
		// Off
		if ($elm.attr('name') == 'year' && $('#nav-cal .months a.sel').length) {
			// Year: if month is selected, select current year
			$('#nav-cal .years a').first().addClass('sel');
		}
		$elm.removeClass('sel')
	};
	this.dispatch(action, state);
};



// Nav items with three states
SearchFilters.prototype.clickTriad = function($elm, action, state) {
	if (state == 1) {
		// Including
		$elm.addClass('sel');
	} else if (state == -1) {
		// Excluding
		$elm.addClass('un');
	} else {
		// Off
		$elm.removeClass('un sel');
	}
	this.dispatch(action, state);
}



// Execute all actions
SearchFilters.prototype.dispatch = function(action, state) {
	const data = {};
	const $yearSel = $('#nav-cal .years a.sel');
	const $monthSel = $('#nav-cal .months a.sel');
	const isDateSelected = ($yearSel.length + $monthSel.length === 0);
	const actionName = action.match(/^m-(\d{1,2})$/) ? 'month' : action;
	console.log(action)

	switch (actionName) {
		case 'settings':
			if (state) {
				$('#settings').addClass('show');
			} else {
				$('#settings').removeClass('show');
			}
			break;
		case 'cal':
			if (state) {
				$('#nav-cal').addClass('show');
				if ($yearSel.length) data.y = $yearSel.text();
				if ($monthSel.length) data.m = $monthSel.index() + 1;
				// No need to refresh when no months are selected
				if (isDateSelected) break;
			} else {
				$('#nav-cal').removeClass('show');
				if (isDateSelected) break;
			}
		case 'month':
			if (!$yearSel.length) $('#nav-cal .years a').first().addClass('sel');
			
		default:
			let urlQuery = window.location.search; // Gets refreshed on server
			loading();
			$.ajax({
				type: 'POST',
				url: '/search/filter/' + action + '/' + state + urlQuery,
				data: data,
				error: (err) => {
					console.error('Couldn\'t run query.', err);
				},
				success: this.onSuccess
			});
	}
};