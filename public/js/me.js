$('#btn-edit').on('click', enableForm);
$('#btn-cancel').on('click', resetForm);

const meForm =  new HandleForm({
	id: 'form-me', // Mandatory
	url: 'api/users', // Mandatory
	type: 'PUT',
	onSuccess: disableForm,
	debug: false
});

function enableForm() {
	$('#form-me').addClass('edit');
	$('#form-me input:read-only').removeAttr('readonly');
	$('#form-me input[type=email]').attr('disabled', true);
	$('#form-me input:first-child').focus();
	$('#form-me input').each((i, elm) => {
		$(elm).data('val', $(elm).val());
	});
}

function resetForm() {
	$('#form-me input').each((i, elm) => {
		$(elm).val($(elm).data('val'));
	});
	disableForm();
}

function disableForm() {
	$('#form-me').removeClass('edit');
	$('#form-me input').attr('readonly', true);
	$('#form-me input[type=email]').removeAttr('disabled');
}