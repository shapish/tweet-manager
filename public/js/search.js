function Search() {
	this.$search = $('#search');
	this.$clearBtn = $('#search-clear');
	this.$formSearch = $('#form-search');
	this.init();
}

Search.prototype.init = function() {
	this.$search.on('keyup', this.keyUp.bind(this));
	this.$clearBtn.on('click', this.clear.bind(this));
	this.$formSearch.on('submit', this.submit.bind(this));
};

Search.prototype.clear = function() {
	loading();
	window.location.href = '/'
}

Search.prototype.submit = function(e) {
	// Instant feedback
	loading();

	// Submit query
	let val = this.$search.val();
	let urlQuery = this.$search.attr('data-url-query');
	urlQuery = urlQuery ? urlQuery : '';
	window.location.href = '?q=' + val + urlQuery;
	e.preventDefault();
};

Search.prototype.keyUp = function(e) {
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