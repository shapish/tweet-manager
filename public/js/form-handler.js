/*
	
	v2.1
	
	// Application:
	const form =  new HandleForm({
		'id': 'person-form', // Mandatory
		'url': 'api/person', // Mandatory
		'type': 'POST' // Default is POST
		'instantFeedback': instantFeedback, // Updates Ui to show submitting is in process
		'resetInstantFeedback': resetInstantFeedback, // Reverts Ui to show submitting is complete
		'onError': onError, // Single error handler
		'markError': markError, // Takes $('input') as argument, called for each error input
		'clearError': clearError, // Takes $('input') as argument
		'onDuplicate': onDuplicate, // When a record already exists
		'onSuccess': onSuccess, // When a record is successfully submitted
		'onReset': onReset, // When the form is reset (eg. success message dismissed)
		'debug': true
	});

	// Reset form
	$('#try-again, #reset').click($.proxy(form.reset, form));

*/

function HandleForm(options) {
	if (!options.id) {
		return console.error('! options.id is missing');
	} else if (!options.url) {
		return console.error('! options.url is missing');
	}

	// Read in options
	this.id = '#' + options.id; // Mandatory
	this.url = options.url; // Mandatory
	this.type = options.type ? options.type : 'POST';
	this.onSuccess = options.onSuccess ? options.onSuccess : this._onSuccessDefault;
	this.onDuplicate = options.onDuplicate ? options.onDuplicate : this._onDuplicateDefault;
	this.instantFeedback = options.instantFeedback ? options.instantFeedback : this._instantFeedbackDefault;
	this.resetInstantFeedback = options.resetInstantFeedback ? options.resetInstantFeedback : this._resetInstantFeedbackDefault;
	this.onError = options.onError ? options.onError : () => {};
	this.markError = options.markError ? options.markError : this._markErrorDefault;
	this.clearError = options.clearError ? options.clearError : this._clearErrorDefault;
	this.onReset = options.onReset ? options.onReset : () => {};
	this.ajaxHeaders = options.ajaxHeaders ? options.ajaxHeaders : {};
	this.debug = options.debug ? true : false;
	
	// Initialize
	this.$form = $(this.id);
	this.$form.submit($.proxy(this._onsubmit, this));
}








/**
 *  Main functions
 */

// On Submit
HandleForm.prototype._onsubmit = function(e) {
	this._debug('_onSubmit');
	this.instantFeedback();
	
	// Construct JSON with all form data
	let formData = {};
	this.$form.find('input').each(function(i, elm) {
		const isDataInput = !$(elm).is('input:button') && !$(elm).is('input:submit');
		if (isDataInput) {
			formData[$(elm).attr('name')] = $(elm).val();
		}
	});

	// We don't want UI to flash when the server is too fast,
	// so we wait for either a 300ms timer or the server to respond.
	
	// Promise 1: Reset instant feedback
	this.resetInstantFeedbackTimer = new Promise((resolve) => {
		setTimeout(() => {
			resolve('timer');
		}, 300);
	});

	// Promise 2: Send data to server
	this.ajax = new Promise((resolve, reject) => {
		$.ajax({
			type: this.type,
			url: this.url,
			headers: this.ajaxHeaders,
			data: formData,
			dataType: 'json',
			encode: true,
			error: $.proxy((data) => {
				// this._onError(data); // Delayed via this.wait()
				resolve(['ajax-done-error', data]);
			}, this),
			success: $.proxy((data) => {
				// this._onSuccess(); // Delayed via this.wait()
				resolve(['ajax-done-success', data]);
			}, this)
		});
	});

	// Wait for the fastest of two promises
	this.wait(this.ajax, this.resetInstantFeedbackTimer);
	
	// Prevent form from submitting
	e.preventDefault();
};

// Wait for a timer and database callback before continuing
// The artificial wait is to prevent UI feedback from flashing too fast
HandleForm.prototype.wait = function(func1, func2) {
	Promise.all([func1, func2])
	 .then($.proxy(function(result) {
		if (result[0][0] == 'ajax-done-success') {
			const data = result[0][1];
			this._onSuccess(data);
		} else if (result[0][0] == 'ajax-done-error') {
			const data = result[0][1];
			this._onError(data);
		}
		this.resetInstantFeedback();
	 }, this))
	 .catch($.proxy(function(err) {
		console.error('Something went wrong:', err);
		this.resetInstantFeedback();
	 }, this));
}


// On Error
HandleForm.prototype._onError = function(data) {
	this._debug('_onError');
	if (data.responseText == 'Duplicate') {
		// Duplicate entry --> soft error
		this.onDuplicate();
	} else {
		// Clear previous errors
		this.clearAllErrors();
		
		const response = data.responseJSON;
		if (response) {
			// Display error per field
			for (let inputName in response) {
				this._debug('Error:' + inputName + response[inputName])
				const $ip = this.$form.find('input[name=' + inputName + ']');
				this.markError($ip, response[inputName]);
			}
		} else {
			// Display general error
			this.$form.find('.err-msg').text(data.responseText);
		}

		this.onError(data);
	}
};


// On Success
HandleForm.prototype._onSuccess = function(data) {
	this._debug('_onSuccess');
	this.clearAllErrors();
	// this._clearAllInputs();
	this.$form.find('input').eq(0).focus(); // Focus on first input
	this.onSuccess(data);
};


// Reset form
HandleForm.prototype.reset = function() {
	this._debug('reset');
	this.clearAllErrors();
	this.clearAllValues();
	this.onReset();
};


// Clear all input values
HandleForm.prototype.clearAllValues = function() {
	this._debug('_clearAllInputs');
	this.$form.find('input').each(function() {
		$(this).val('');
	});
};

// Clear all input errors that were marked invalid
HandleForm.prototype.clearAllErrors = function() {
	this._debug('_clearAllInputErrors');
	this.$form.find('input').each($.proxy(function(i, elm) {
		if (!$(elm).is('[type=submit]') && !$(elm).is('[type=button]')) {
			this.clearError($(elm));
		}
	}, this));
	this.$form.find('.err-msg').text('');
};


// Log all actions while debugging
HandleForm.prototype._debug = function(data) {
	if (this.debug)	console.log(data);
}








/**
 *  Fallback actions
 */

// Fallback for options.onSuccess
HandleForm.prototype._onSuccessDefault = function() {
	this._debug('_onSuccessDefault');
	alert('Record successfully added');
};

// Fallback for options.onDuplicate
HandleForm.prototype._onDuplicateDefault = function() {
	this._debug('_onDuplicateDefault');
	alert('This record was already added.');
};


// Fallback for options.instantFeedback
HandleForm.prototype._instantFeedbackDefault = function() {
	this._debug('_instantFeedbackDefault');
	// Store original submit button value so we can reset it
	const $submitBtn = this.$form.find('[type=submit]').eq(0);
	let originalValue = '';
	if ($submitBtn.is('input')) {
		originalValue = $submitBtn.val();
		this.$form.find('input[type=submit]').eq(0).val('Submitting...').data('original-value', originalValue);
	} else if ($submitBtn.is('button')) {
		originalValue = $submitBtn.html();
		this.$form.find('button[type=submit]').eq(0).html('Submitting...').data('original-value', originalValue);
	}
};


// Fallback for options.resetInstantFeedback
HandleForm.prototype._resetInstantFeedbackDefault = function() {
	this._debug('_resetInstantFeedbackDefault');
	// Reset submit button to original value
	const $submitBtn = this.$form.find('[type=submit]').eq(0);
	if ($submitBtn.is('input')) {
		$submitBtn.val($submitBtn.data('original-value'));
	} else {
		$submitBtn.html($submitBtn.data('original-value'));
	}
};


// Falback for options.markError
HandleForm.prototype._markErrorDefault = function($ip, errorMsg) {
	// Marks invalid input fields & sets error message.
	// Assumes the label comes after the input field,
	// using (flex-direction: column-reverse)
	// and has span inside for error message.
	this._debug('_markError');
	$ip.addClass('err').next('.field-err-msg').text(errorMsg);
};


// Fallback for clearing the error state of one field
HandleForm.prototype._clearErrorDefault = function($ip) {
	this._debug('_clearErrorDefault')
	$ip.removeClass('err').next('.field-err-msg').html('');
};