function SearchBar(options) {
	this.$search = $('#search');
	this.$clearBtn = $('#search-clear');
	this.$formSearch = $('#form-search');

	this.onSuccess = options.onSuccess ? options.onSuccess : () => {};

	this.init();
}

SearchBar.prototype.init = function() {
	this.$search.on('keyup', this.keyUp.bind(this));
	this.$search.on('focus', () => { $('.table-row.focus').removeClass('focus') });
	this.$clearBtn.on('click', this.clear.bind(this));
	this.$formSearch.on('submit', this.submit.bind(this));
};

SearchBar.prototype.clear = function() {
	loading();
	this.$search.val('');
	$('#filters a, #nav-cal a').removeClass('sel un');
	$('#nav-cal, #settings').removeClass('show');
	$('#filters a').first().addClass('sel');
	$.ajax({
		type: 'POST',
		url: '/search/clear',
		error: (err) => {
			console.error('Couldn\'t run query.', err);
		},
		success: this.onSuccess
	});
}

SearchBar.prototype.submit = function(e) {
	// Instant feedback
	e.preventDefault();
	loading();

	// Submit query – replace slashes and hashes into url-friendly strings
	let val = this.$search.val() ? this.$search.val() : '*';
	let urlQuery = window.location.search; // Gets refreshed on server
	console.log(val)
	$.ajax({
		type: 'POST',
		url: '/search/q' + urlQuery,
		data: {
			q: val
		},
		dataType: 'json',
		encode: true,
		error: (err) => {
			console.error('Couldn\'t run query.', err);
		},
		success: this.onSuccess
	});
};

SearchBar.prototype.keyUp = function(e) {
	return;
	// console.log(e.which);
	if (e.which == 27) {
		// ESC
		if (this.$search.val()) {
			// Select text
			this.$search.get(0).select();
		} else {
			// Blur search
			this.$search.get(0).blur();
		}
	} else if (e.which == 13) {
		// ENTER: run query
		// this.submit();
		// this.$formSearch.trigger('submit');
	}
};