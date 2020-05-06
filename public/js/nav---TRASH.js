// Takes care of all navigations.

function Nav() {
	this.$filters = $('#filters');
	this.init();
}

Nav.prototype.init = function() {
	// Set year & month in navigation.
	if ($('#nav-year')) {
		const d = new Date();
		this.year = d.getFullYear();
		this.month = d.getMonth();
		
		const $months = $('#nav-month').children();
		for (let i=0; i<$months.length; i++) {
			if ($months.eq(i).attr('data-index') == this.month) {
				$months.eq(i).addClass('sel');
				break;
			}
		}
	}
	
	// Update UI when you click any nav item.
	const $navs = $('.nav')
	$navs.each((i, nav) => {
		$(nav).children().each((j, elm) => {
			$(elm).click((e) => {
				if ($(elm).hasClass('sel')) {
					// Selected nav items not clickable.
					e.preventDefault();
				}
				this.selectElm($(elm));
				this.dispatch($navs.eq(i).attr('id'), $(elm));
			});
		});
	});
	
};

// Select item from nav.
Nav.prototype.selectElm = function($elm) {
	$elm.siblings().removeClass('sel');
	$elm.addClass('sel');
};

// Dispatch action when item is clicked.
Nav.prototype.dispatch = function(navId, $item) {
	// Turn item html into lowercase ID with dashes.
	const itemId = $item.html().replace(/\s+/g, '-').toLowerCase();
	// console.log(navId, itemName);
	if (navId == 'nav-filter-type') {
		this.navFilterType(itemId);
	} else if (navId == 'nav-year') {
		this.navYear(itemId);
	} else if (navId == 'nav-month') {
		this.navMonth($item);
	}
};

// Actions for the filter type navigation - #nav-filter-type
Nav.prototype.navFilterType = function(itemId) {
	table.selectAll(false);
	if (itemId == 'search') {
		$.proxy(selectSearchView, this)();
	} else if (itemId == 'by-date') {
		$.proxy(selectByDateView, this)();
	}
	
	function selectSearchView() {
		this.$filters.removeClass('by-date');
	}
	
	function selectByDateView() {
		this.$filters.addClass('by-date');
	}
};

// Actions for the Year navigation - #nav-year
Nav.prototype.navYear = function(year) {
	const month = $('#nav-month .sel').attr('data-index');
	console.log('Nav.navYear: ' + year + ' (' + month + ')');
	setOverview('selected-month-overview', Math.random() * 50, Math.random() * 50, Math.round(Math.random() * 10000));
};

// Actions for the Month navigation - #nav-month
Nav.prototype.navMonth = function($item) {
	const month = $item.attr('data-index');
	const year = $('#nav-year .sel').html();
	console.log('Nav.navMonth: ' + month + ' (' + year + ')');
	setOverview('selected-month-overview', Math.random() * 50, Math.random() * 50, Math.round(Math.random() * 10000));
};