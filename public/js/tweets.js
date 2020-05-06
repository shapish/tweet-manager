new Search();
const table = new Table();
// setOverview('selected-month-overview', 25, 50, 2579);

// Filter nav
$('#nav-filter-type').on('click', '.f-search, .f-by-date', byDateUi);

// Pagination instant feedback
$('.pagination').on('click', 'a', loading);

// Keyboard events
document.addEventListener('keypress', keyBoardEvents);



function keyBoardEvents(e) {
	// Block if Search is not open
	if ($('#nav-filter-type a.sel').text() != 'Search') return;

	// Block when Search is in focus. Has its own keyboard commands
	if ($(e.target).is('input, textarea')) return;
	
	// Any letter will activate search box
	if ((e.which >= 65 && e.which <= 90) || e.which >= 97 && e.which <= 122) {
		// Any letter: start typing
		$('#search').select();
	} else if (e.which == 13) {
		// Enter will focus on search
		$('#search').select();
	}
}



// Show/hide by-date UI
function byDateUi(e) {
	const $elms = $('#filters, #nav-filter-type');
	if ($(e.target).hasClass('f-by-date')) {
		$elms.addClass('by-date');
	} else {
		$elms.removeClass('by-date');
	}
	e.preventDefault();	
}