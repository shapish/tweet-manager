const chapterTable = new Table('chapter-table', {
	initExternal: function() {
		initFilters.bind(this)();
		initControls.bind(this)();
	},
	path: '/chapters',
	noSelect: !isAdmin()
}, {});


// Initialize filterd on top
function initFilters() {
	// Filter type dropdown
	$('#dd-filter-type').off('change').on('change', (e) => {
		const filter = 'type';
		const val = $(e.currentTarget).val();
		this.filter(filter, val);
	});

	// Filter writer dropdown
	$('#dd-filter-writer').off('change').on('change', (e) => {
		const filter = 'writer';
		const val = $(e.currentTarget).val();
		this.filter(filter, val);
	});

	// Filter stage dropdown
	$('#dd-filter-stage').off('change').on('change', (e) => {
		const filter = 'stage';
		const val = $(e.currentTarget).val();
		this.filter(filter, val);
	});
}


// Update type
chapterTable.filter = function(filter, val) {
	let urlQuery = window.location.search;
	this.ajax({
		type: 'POST',
		url: '/chapters/filter/' + filter + '/' + val + urlQuery,
		success: this.updateTable.bind(this)
	});
};


// Initialize controls on top
function initControls() {
	// Exit selection
	$('#exit-selection').off('click').on('click', _deselect.bind(this));
		
	// Type dropdown
	$('#dd-type').off('change').on('change', (e) => {
		this.updateType($(e.currentTarget).val());
	});

	// Writer dropdown
	$('#dd-writer').off('change').on('change', (e) => {
		const id = $(e.currentTarget).val()
		const name = $(e.currentTarget).children('option:selected').text()
		this.updateWriter(id, name);
	});

	// Stage dropdown
	$('#dd-stage').off('change').on('change', (e) => {
		this.updateStage($(e.currentTarget).val());
	});

	// Word count input
	$('#word-count').on('keyup', (e) => {
		if (e.which == 13) {
			this.updateWordCount($(e.currentTarget).val());
		}
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


// Update type
chapterTable.updateType = function(type) {
	const ids = this.selected.map($row => {
		$row.find('.type').removeClass('err').text(type)
		return $row.attr('data-id');
	});

	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/chapters/batch',
		data: {
			ids: ids,
			type: type
		},
		error: () => {
			this.selected.forEach($row => {
				$row.find('.type').text('ERROR').addClass('err');
			});
		}
	});
};


// Update writer
chapterTable.updateWriter = function(id, name) {
	const ids = this.selected.map($row => {
		$row.find('.writer').removeClass('err').text(name);
		return $row.attr('data-id');
	});

	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/chapters/batch',
		data: {
			ids: ids,
			writerId: id
		},
		error: () => {
			this.selected.forEach($row => {
				$row.find('.writer').text('ERROR').addClass('err');
			});
		}
	});
};


// Update Stage
chapterTable.updateStage = function(stage) {
	const ids = this.selected.map($row => {
		$row.find('.stage').removeClass('err').text($('#controls').attr('data-stages').split(',')[stage])
		return $row.attr('data-id');
	});

	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/chapters/batch',
		data: {
			ids: ids,
			stage: stage
		},
		error: () => {
			this.selected.forEach($row => {
				$row.find('.stage').text('ERROR').addClass('err');
			});
		}
	});
};


// Update word count
chapterTable.updateWordCount = function(wordCount) {
	const ids = this.selected.map($row => {
		$row.find('.word-count').removeClass('err').text(prettyNr(wordCount));
		return $row.attr('data-id');
	});

	// Ajax
	this.ajax({
		type: 'PUT',
		url: '/api/chapters/batch',
		data: {
			ids: ids,
			wordCount: wordCount
		},
		error: () => {
			this.selected.forEach($row => {
				$row.find('.word-count').text('ERROR').addClass('err');
			});
		}
	});
};


// Turn numbers into comma numbers
function prettyNr(x) {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}