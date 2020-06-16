// Live scraper
$('#scrape-latest').click(e => {
	const state = $(e.target).hasClass('on') ? 0 : 1;

	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}

	$.ajax({
		type: 'POST',
		url: '/api/scraper/scrape-live/' + state,
		success: ctrl => { 'Scraping ' + (state ? 'started, check console.' : 'stopped.') },
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
$('#btn-gather').click(e => {
	const state = $(e.target).hasClass('on') ? 0 : 1;
	
	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}

	$.ajax({
		type: 'POST',
		url: '/api/scraper/gather/' + state,
		success: ctrl => { console.log('Gathering:', ctrl.gathering, ' -- URL: ', ctrl.url) },
		error: err => { console.log('error', err) }
	});
});