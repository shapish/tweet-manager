// Edit
$('#btn-edit, a.shortcut').on('click', (e) => {
	$('#form-chapter').addClass('edit');
	if ($(e.target).hasClass('shortcut')) {
		$ipFocus = $('#form-chapter input[name=' + $(e.target).attr('name') + ']');
		$selectFocus = $('#form-chapter select[name=' + $(e.target).attr('name') + ']').closest('.dropdown');
		console.log($selectFocus.length)
		if ($ipFocus.length) {
			$ipFocus.addClass('ip-blink');
			setTimeout(() => $ipFocus.removeClass('ip-blink'), 2000);
			$ipFocus.focus();
		} else if ($selectFocus.length) {
			$selectFocus.addClass('opacity-blink');
			setTimeout(() => $selectFocus.removeClass('opacity-blink'), 2000);
			$selectFocus.find('select').focus();
		}
	}

	window.onbeforeunload = function() {
		return 'You have unsaved changes.';
	};
});

// Cancel
$('#btn-cancel').on('click', () => {
	$('#form-chapter').removeClass('edit');
	window.onbeforeunload = null;
	$('#form-chapter').find('input:not(:button):not(:submit), select').each((i, elm) => {
		$(elm).val($(elm).data('og-val')).change();
	});
});

// Save
const chapterForm = new HandleForm({
	type: 'PUT',
	id: 'form-chapter', // Mandatory
	url: '/api/chapters/' + $('#form-chapter').attr('data-id'), // Mandatory
	instantFeedback: () => {
		$('#form-chapter [type=submit]').eq(0).text('Saving...');
	},
	resetInstantFeedback: () => {
		$('#form-chapter [type=submit]').eq(0).text('Save');
	},
	onSuccess: (updates) => {
		if (updates.path) {
			history.replaceState({}, '', updates.path);
			$('#chapter-title').html('<span>' + $('#chapter-title span').text() + '</span>' + updates.title);
		}
		// $('#form-chapter').removeClass('edit');
		window.onbeforeunload = null;
		location.reload();
	},
	onError: (err) => {
		console.log(err.responseText)
		$('#form-chapter [type=submit]').eq(0).text('Save');
		$('#form-chapter .err-msg').text('Something went wrong.');
	},
	debug: false
});