function Search() {
	this.search = document.getElementById('search');
	this.clearBtn = document.getElementById('search-clear');
	this.submitBtn = document.getElementById('search-submit');
	this.init();
}

Search.prototype.init = function() {
	this.search.addEventListener('keyup', this.keyUp.bind(this));
	this.clearBtn.addEventListener('click', this.clear.bind(this));
	this.submitBtn.addEventListener('click', this.submit.bind(this));
};

Search.prototype.clear = function() {
	this.search.value = '';
	this.search.focus();
}

Search.prototype.submit = function() {
	console.log('Search.submit');
	console.log('Ajax: search "' + this.search.value + '"');
	$('#search-results-count').innerText = Math.round(Math.random() * 10000) + ' results';
};

Search.prototype.keyUp = function(e) {
	// console.log(e.which);
	if (e.which == 27) {
		// ESC
		if (this.search.value.length > 0) {
			// Remove value.
			this.search.select();
			// this.clear(); — too agressive.
		} else {
			// Blur search.
			this.search.blur();
		}
	} else if (e.which == 13) {
		// ENTER: run query
		this.submit();
	}
};