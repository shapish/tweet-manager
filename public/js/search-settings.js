function SearchSettings(options) {
	$('#settings').on('click', 'a.op:not(.prompt)', e => {
		const action = $(e.target).attr('href').slice(1);
		const value = !$(e.target).hasClass('sel');
		const data = {};
		data[action] = value;

		// Instant feedback
		e.preventDefault();
		if (value) {
			$(e.target).addClass('sel');
		} else {
			$(e.target).removeClass('sel');
		}

		let urlQuery = window.location.search; 
		$.ajax({
			type: 'PUT',
			url: '/search/settings' + urlQuery,
			data: data,
			dataType: 'json',
			encode: true,
			error: (error) => {
				console.error('Couldn\'t save settings.');
			},
			success: options.onSuccess
		});
	});

	$('#settings').on('click', 'a.op.prompt', e => {
		const action = $(e.target).attr('href').slice(1);
		const promptMsg = action == 'pageSize' ? 'Number of tweets per page:' : 'Number of pages listed in the pagination'
		const currentValue = $(e.target).find('span').text();
		const value = prompt(promptMsg, currentValue);
		const data = {};
		data[action] = value;

		// Instant feedback
		e.preventDefault();
		$(e.target).find('.color').text(value);

		let urlQuery = window.location.search; 
		$.ajax({
			type: 'PUT',
			url: '/search/settings' + urlQuery,
			data: data,
			dataType: 'json',
			encode: true,
			error: (error) => {
				console.error('Couldn\'t save settings.');
			},
			success: options.onSuccess
		});
	});
}