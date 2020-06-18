// Live scraper
$('#btn-extract-latest').click(e => {
	const state = $(e.target).hasClass('on') ? 0 : 1;

	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}

	$.ajax({
		type: 'POST',
		url: '/api/scrape/extract-latest/' + state,
		success: () => { 'Scraping ' + (state ? 'started, check console.' : 'stopped.') },
		error: err => {
			console.log('error', err);
			if (state) {
				$(e.target).removeClass('on');
			} else {
				$(e.target).addClass('on');
			}
		}
	});
});


// Gather button
$('#btn-fill-missing').click(e => {
	const state = $(e.target).hasClass('on') ? 0 : 1;
	
	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}

	$.ajax({
		type: 'POST',
		url: '/api/scrape/fill-missing/' + state,
		success: () => { 'Fillling in ' + (state ? 'started, check console.' : 'stopped.') },
		error: err => { console.log('error', err) }
	});
});