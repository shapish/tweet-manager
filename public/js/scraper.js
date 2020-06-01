// Gather button
$('#gather').click(e => {
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



// Extract button
$('#extract').click(e => {
	const state = $(e.target).hasClass('on') ? 0 : 1;
	
	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}
	
	$.ajax({
		type: 'POST',
		url: '/api/scraper/extract/' + state,
		success: ctrl => { console.log('Extracting:', ctrl.extracting) },
		error: err => { console.log('error', err) }
	});
});



// Transfer data
$('#transfer').click(e => {
	$.ajax({
		type: 'POST',
		url: '/api/scraper/transfer',
		success: resp => { $(e.target).addClass('init'); console.log(resp) },
		error: err => { console.log('error', err) }
	});
});