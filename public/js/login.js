/**
 * Swapt between Login and Signup pages
 */
$('#nav').on('click', 'a', e => {
	const page = $(e.target).attr('href').slice(1);
	show(page);
	$('#nav a.sel').removeClass('sel');
	$('#nav a.a-' + page).addClass('sel');
	e.preventDefault();
});

function show(page) {
	$('form').hide();
	$('#form-' + page).show();
	loginForm.clearAllErrors();
	signupForm.clearAllErrors();
	history.pushState({}, '', '/' + page);
}


/**
 * Login form
 */

const loginForm =  new HandleForm({
	id: 'form-login', // Mandatory
	url: 'api/login', // Mandatory
	onSuccess: goHome,
	onError: (err) => {
		console.log(err.responseText)
		// ip.addClass('err').next('label').children('span').html(errorMsg);
	},
	debug: false
});

const signupForm =  new HandleForm({
	id: 'form-signup', // Mandatory
	url: 'api/users', // Mandatory
	onSuccess: goHome,
	onDuplicate: function() {
		$('#form-signup .error-msg').html('This email has already been registered.');
	},
	debug: false
});

function goHome() {
	window.location.href = '/me';
}

(function testLinks(parent) {
	const loginLinks = ['super-admin', 'admin', 'plebeian', 'invalid'];
	const signupLinks = ['valid', 'invalid'];
	
	// Login links
	loginLinks.forEach((type) => {
		$('<a href="#"></a>')
			.text(type)
			.click(e => {
				$('#form-login input[type=email]').val(type + '@shapish.com');
				$('#form-login input[type=password]').val(123456);
				e.preventDefault();
			}).appendTo(parent);
		$(parent).append('<br>');
	});
	$(parent).append('<br>');
	
	// Signup links
	signupLinks.forEach((type) => {
		$('<a href="#"></a>')
			.text(type)
			.click(e => {
				$('#form-signup input[type=text]').val('Timothy Tester');
				$('#form-signup input[type=password]').val((type == 'valid') ? 123456 : 123);
				$('#form-signup input[type=email]').val('test' + Math.round(Math.random()*100) + '@gmail.com');
				e.preventDefault();
			}).appendTo(parent);
		$(parent).append('<br>');
	});

})('#body');