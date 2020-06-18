// Seed form
$('#btn-seed').click(e => {
	e.preventDefault();
	const collection = $('input[name=collection]').val();
	const filename = $('input[name=filename]').val();
	const dropTable = $('select[name=drop-collection-seed]').val();
	const idsOnly = $('select[name=ids-only]').val();
	const state = $(e.target).hasClass('on') ? 0 : 1;
	
	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}
	
	$.ajax({
		type: 'POST',
		url: `/api/seed/seed/${collection}/${filename}/${state}?ids_only=${idsOnly}&drop=${dropTable}`,
		success: ctrl => { console.log('Seeding started – check console') },
		error: err => { console.log('error', err) }
	});
});


// Extract button
$('#btn-extract').click(e => {
	e.preventDefault();
	const state = $(e.target).hasClass('on') ? 0 : 1;
	
	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}
	
	$.ajax({
		type: 'POST',
		url: '/api/seed/extract/TweetScrape/' + state,
		success: ctrl => { console.log('Extracting:', ctrl.extracting) },
		error: err => { console.log('error', err) }
	});
});



// Transfer data
$('#btn-transfer').click(e => {
	e.preventDefault();
	const state = $(e.target).hasClass('on') ? 0 : 1;
	const dropTable = $('select[name=drop-collection-transfer]').val();
	
	if (state) {
		$(e.target).addClass('on');
	} else {
		$(e.target).removeClass('on');
	}

	$.ajax({
		type: 'POST',
		url: `/api/seed/transfer/${state}?drop=${dropTable}` + state,
		success: resp => { $(e.target).addClass('init'); console.log(resp) },
		error: err => { console.log('error', err) }
	});
});