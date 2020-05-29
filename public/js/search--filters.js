function SearchFilters(options) {
	this.init();
	this.onSuccess = options.onSuccess ? options.onSuccess : () => {};
}



SearchFilters.prototype.init = function() {
	// Capture nav clicks
	$('#filters, #nav-cal').on('click', 'a', (e) => {
		e.preventDefault();
		if ($(e.target).hasClass('triad')) {
			// Triple-state filters
			this.clickTriad($(e.target));
		} else if ($(e.target).hasClass('starred')) {
			// Star filter
			this.clickStarred($(e.target));
		} else {
			// Dual-state filters
			// Highlighted items are not clickable
			const isSel = $(e.target).hasClass('sel');
			const action = $(e.target).attr('href').slice(1);
			if (isSel && !action.match(/^settings$|^cal$|^m-\d{1,2}$|^y-\d{4}$/)) { console.log('return'); return; }
			this.clickDyad($(e.target));
		}
	});
};



// Nav items with two states
SearchFilters.prototype.clickDyad = function($elm) {
	const action = $elm.attr('href').slice(1);
	const state = $elm.hasClass('sel') ? 0 : 1;
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


// // Nav items with three states
// SearchFilters.prototype.clickTriad = function($elm) {
// 	const action = $elm.attr('href').slice(1);
// 	// 1: show (starred) tweets / -1: show (unstarred) tweets / 0: show both
// 	const state = $elm.hasClass('sel') ? $elm.is('.un, .only') ? 0 : -1 : 1;
// 	if (state == 1) {
// 		// Including
// 		$elm.addClass('sel');
// 	} else if (state == -1) {
// 		// Excluding
// 		const c = $elm.hasClass('anti') ? 'only' : 'un';
// 		$elm.addClass(c);
// 	} else {
// 		// Off
// 		$elm.removeClass('un only sel');
// 	}
// 	this.dispatch(action, state);
// }



// Nav items with three states
SearchFilters.prototype.clickTriad = function($elm) {
	const action = $elm.attr('href').slice(1);
	let prevState = $elm.attr('data-state');
	let state = (prevState == 'reset' || prevState == -1) ? 0 : prevState == 1 ? -1 : 1;
	// state = $elm.hasClass('sel') ? $elm.is('.un, .only') ? 0 : -1 : 1;
	// // 1: show (starred) tweets / -1: show (unstarred) tweets / 0: show both
	// const state = $elm.hasClass('sel') ? $elm.is('.un, .only') ? 0 : -1 : 1;
	if (state == 1) {
		// Including
		$elm.addClass('sel');
	} else if (state == -1) {
		// Excluding
		const c = $elm.hasClass('anti') ? 'only' : 'un';
		$elm.addClass(c);
	} else {
		// Off
		$elm.removeClass('un only sel');
	}

	// 1 sec timeframe to toggle states
	$elm.attr('data-state', state);
	clearTimeout($elm.data('to'));
	if (state) $elm.data('to', setTimeout(() => { $elm.attr('data-state', 'reset') }, 1000));

	this.dispatch(action, state);
}



// Nav items with more than states
SearchFilters.prototype.clickStarred = function($elm) {
	let state = $elm.attr('data-state');
	const action = $elm.attr('href').slice(1);
	const states = [null, 'all', '1', '2', '3', '0'];
	// console.log('.', state)
	if (!state) {
		state = states[1];
	} else if (state == 'reset') {
		state = states[0];
	} else {
		const i = (states.indexOf(state) + 1) % states.length;
		state = states[i];
	}

	// 1 sec timeframe to toggle states
	$elm.attr('data-state', state).removeClass('s-' + states.join(' s-'));
	if (state) {
		$elm.addClass('sel s-' + state);
	} else {
		$elm.removeClass('sel');
	}
	clearTimeout($elm.data('to'));
	if (state) $elm.data('to', setTimeout(() => { $elm.attr('data-state', 'reset') }, 1000));

	this.dispatch(action, state);
}



// Execute all actions
SearchFilters.prototype.dispatch = function(action, state) {
	const data = {};
	const $yearSel = $('#nav-cal .years a.sel');
	const $monthSel = $('#nav-cal .months a.sel');
	const isDateSelected = ($yearSel.length + $monthSel.length === 0);
	const actionName = action.match(/^m-(\d{1,2})$/) ? 'month' : action;

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