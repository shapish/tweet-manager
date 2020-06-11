const iv = setInterval(() => {
	if ($('#waiting').length) {
		const filename = $('#waiting').attr('data-filename');
		$.ajax({
			type: 'POST',
			url: '/search/download/check/' + filename,
			error: err => { console.error('Failed to connect to server', err) },
			success: ready => {
				console.log('ready: ', ready)
				if (ready) {
					clearInterval(iv);
					location.reload();
				}
			}
		})
	}
}, 1000);