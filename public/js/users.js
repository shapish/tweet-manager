$('.user .x').on('click', e => {
	const name = $(e.target).closest('.user').attr('data-name');
	const email = $(e.target).closest('.user').attr('data-email');
	if (confirm(`Are you sure you want to delete ${name}?\n${email}`)) deleteUser(e);
});

function deleteUser(e) {
	const userModule = $(e.target).closest('.user');
	const id = userModule.attr('data-id');
	
	// Send data to server
	$.ajax({
		type: 'DELETE',
		url: '/api/users/' + id,
		error: (data) => {
			alert('Error – You don\'t have super admin privileges.');
		},
		success: (data) => {
			userModule.remove();
		}
	});
}