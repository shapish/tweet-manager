function LabelManager(id, options) {
	this.$wrap = $('#' + id);
	this._initButtons()
	this._initlabels();
}

// Initialize buttons
LabelManager.prototype._initButtons = function() {
	$('#btn-edit').click(edit);
	$('#btn-done').click(disableEdit);
	$('#btn-merge').click(this._merge.bind(this));
	$('#btn-merge-cancel').click(this._cancelMerge.bind(this));
	$('#btn-merge-done').click(this._mergeDone.bind(this));
	$('#clean-label-data').click(this._cleanLabelData.bind(this));

	function edit() {
		$('#button-wrap, #labels-wrap').addClass('cm-editing');
	}

	function disableEdit() {
		// Submit forms
		var e = $.Event('keyup');
		e.which = 13; // 13
		$('#labels-wrap input').each((i, elm) => {
			$(elm).trigger(e);
		});

		// Disable edit
		$('#button-wrap, #labels-wrap').removeClass('cm-editing');
	}

	// edit(); // ##
};

// Initialize labels
LabelManager.prototype._initlabels = function() {
	this.$wrap.find('.label').each((i, elm) => {
		$(elm).off('click');
		$(elm).click((e) => {
			$label = $(e.target).closest('.label');
			if ($(e.target).is('.delete')) {
				console.log(this)
				this._deleteLabel($label);
			} else if ($(e.target).is('.rename')) {
				this._rename($label);
			} else if ($label.closest('#labels-wrap').is('.cm-editing')) {
				this._toggleSelect($label);
			}
		});
	});
	
	// $('#labels-wrap .label').eq(3).trigger('click');
	// $('#labels-wrap .label').eq(4).trigger('click'); // ##
};


// Toggle select label
LabelManager.prototype._toggleSelect = function($label) {
	if ($label.hasClass('sel')) {
		// Deselect
		$label.removeClass('sel');
		$('#' + $label.attr('data-id')).remove();

		// Show appropriate message
		const labelCount = $('#merge-list .labels-wrap').children().length;
		_toggleMessage(labelCount);

		// Hide list when empty
		if (labelCount === 0) {
			$('#interface').removeClass('merging')
		}
	} else {
		// Select
		$label.addClass('sel');

		// Send to merge list
		const $clone = $label.clone();
		$clone.attr('id', $label.attr('data-id')).find('.cm-actions').remove();
		$clone.appendTo('#merge-list .labels-wrap');

		// Show appropriate message
		const labelCount = $('#merge-list .labels-wrap').children().length;
		_toggleMessage(labelCount);

		// Show merge list
		if (labelCount == 1) $('#interface').addClass('merging');
	}

	function _toggleMessage(labelCount) {
		if (labelCount == 1) {
			$('#merge-list p.m1').show();
			$('#merge-list p.m2').hide();
			$('#btn-merge').prop('disabled', true);
		} else {
			$('#merge-list p.m1').hide();
			$('#merge-list p.m2').show();
			$('#btn-merge').prop('disabled', false);
		}
	}
};


// Merge labels
LabelManager.prototype._merge = function() {
	let mainId;
	let mainValue;
	const mergeIds = [];
	let labelvalues = [];
	let count = 0;
	

	// Save ids in array
	$('#merge-list .labels-wrap').children().each((i, elm) => {
		if (i == 0) {
			mainId = $(elm).attr('id');
			mainValue = $(elm).find('.value').text();
		} else {
			mergeIds.push($(elm).attr('id'));
		}
		count += +$(elm).find('.count').text();
		labelvalues.push($(elm).find('.value').text());
	});

	// Confirm merge
	labelvalues = labelvalues.join('\n• ');
	const confirmMerge = confirm(`Are you sure you wanr to merge the following labels:\n\n• ${labelvalues}`);
	if (!confirmMerge) return;
	
	// Send to server
	$.ajax({
		type: 'PUT',
		url: '/api/labels/merge',
		data: {
			mainValue: mainValue,
			mainId: mainId,
			mergeIds: mergeIds,
			count: count
		},
		dataType: 'json',
		encode: true,
		error: (error) => {
			console.error('Can\'t merge label', error);
		},
		success: _success.bind(this)
	});

	// Callback
	function _success(result) {
		const {mainValue} = result;
		const {mergedLabelValues} = result;
		const {count} = result;
		const $success = $('#merge-list .success');
		const labelsList = [mainValue].concat(mergedLabelValues);

		// Strikethrough merged labels
		$('#labels-wrap .label.sel').each((i, label) => {
			const value = $(label).find('.value').text();
			if (value == mainValue) {
				// Main tweet: Update count
				$(label).find('.count').html(count);
			} else {
				// Rest: Mark as merged
				$(label).addClass('merged');
			}
		})

		// List labels in success message
		$success.find('.number').text(mergedLabelValues.length + 1);
		labelsList.forEach((label) => {
			const html = '<div>' + label + '</div>';
			$success.find('.label-values').append(html);
		});

		// Show success
		$('#merge-list').addClass('success');
		$('#labels-wrap').addClass('paralize');
	}
};

// Cancel merge
LabelManager.prototype._cancelMerge = function() {
	this._mergeDone(true);
};

// Exit merge UI
LabelManager.prototype._mergeDone = function(abort) {
	const id = $('#merge-list .label:first-child').attr('id');

	// Hide & clear merge UI
	$('#merge-list .labels-wrap, #merge-list .label-values').html('');
	$('#merge-list').removeClass('success');
	$('#labels-wrap').removeClass('paralize');
	$('#interface').removeClass('merging');
	
	// Update UI
	$('#labels-wrap .label.sel').removeClass('sel');
	if (abort === true) return; // When user clicks cancel
	$('#labels-wrap .label.merged').each((i, elm) => {
		this._removeLabelUi($(elm));
	});

};


// Delete label
LabelManager.prototype._deleteLabel = function($label) {
	const value = $label.find('.value').text();
	const confirmDelete = confirm(`Are you sure you want to delete the label "${value}"?`);
	if (confirmDelete) {
		$.ajax({
			type: 'DELETE',
			url: '/api/labels/' + $label.attr('data-id'),
			data: {
				value: value
			},
			dataType: 'json',
			encode: true,
			error: (error) => {
				console.error('Can\'t remove label', error);
			},
			success: (result) => {
				this._removeLabelUi($label);
			}
		});
	}
};

// Remove label UI & alpahbet header is needed
LabelManager.prototype._removeLabelUi = function($label) {
	if ($label.prev().is('h3') && ($label.next().is('h3') || !$label.next().length)) $label.prev().remove();	
	$label.remove();
}



// Rename label
LabelManager.prototype._rename = function($label) {
	const ogValue = $label.find('.value').text();
	
	// Create input
	const $ip = $('<input type="text">')
		.val(ogValue)
		.insertAfter($label)
		.select()
		.blur(_onBlur)
		.keyup(keyHandler)
	$label.hide();

	// Blur event
	function _onBlur(e) {
		if ($(e.target).val() == ogValue) _hideForm();
	}

	// Keys
	function keyHandler(e) {
		// console.log('key:', e.which);
		if (e.which == 13) {
			// Enter
			_submitForm();
		} else if (e.which == 27) {
			// Esc
			_hideForm();
		}
	}

	// Hide input
	function _hideForm() {
		$label.show();
		$ip.remove();
	}

	// Send to server
	function _submitForm() {
		$.ajax({
			type: 'PUT',
			url: '/api/labels/' + $label.attr('data-id'),
			data: {
				value: $ip.val(),
				ogValue: ogValue
			},
			dataType: 'json',
			encode: true,
			error: _error,
			success: _success
		})	
	}


	function _success(result) {
		$label.find('.value').text(result.value);
		_hideForm();
	}

	function _error(error) {
		// Show error state
		$ip.addClass('error');
		const html = $('<div>').addClass('error').html(error.responseText)
		$ip.after(html);

		// Remove error state
		setTimeout(() => {
			$ip.removeClass('error');
			$ip.next().remove();
		}, 4000);
	}
};


// Clean label data
// - - -
// Errors in the code or a server timeout might cause inconsistent data
// between tweets (that just store label names) and label documents.
// This loops through all tweets with labels, makes sure there's a label
// document for each label and fixes the count for each label.
LabelManager.prototype._cleanLabelData = function(e) {
	$.ajax({
		type: 'PUT',
		url: 'api/labels/clean',
		error: (error) => {
			console.error('Server error', error);
		},
		success: (result) => {
			const {removedLabels} = result; // Array
			const {restoredLabels} = result; // Array
			const {updatedCounts} = result; // Object
			let countsUpdated = false;
			for (let label in updatedCounts) {
				countsUpdated = true;
				break;
			}
			let log = '\nLABEL CLEANING RESULTS\n';
			log += '- - - - - - - - - - -\n';

			if (restoredLabels.length) {
				log += '\n';
				log += 'Restored missing labels:\n';
				for (let i in restoredLabels) log += ('• ' + restoredLabels[i] + '\n');
			} else {
				log += '\n';
				log += 'No labels restored.\n'
			}

			if (removedLabels.length) {
				log += '\n';
				log += 'Removed unused labels:\n';
				for (let i in removedLabels) log += ('• ' + removedLabels[i] + '\n');
			} else {
				log += '\n';
				log += 'No labels removed.\n'
			}

			if (countsUpdated) {
				log += '\n'
				log += 'Updated label counts:\n';
				for (let label in updatedCounts) log += ('• ' + label + ': ' + updatedCounts[label] + '\n');
			} else {
				log += '\n';
				log += 'No counts updated.\n'
			}

			if (!removedLabels.length && !restoredLabels.length && !countsUpdated) {
				log += '\nData is clean!\n';
				const ogText = $(e.target).text();
				$(e.target).text('Data is clean!');
				setTimeout(() => {
					$(e.target).text(ogText);
				}, 2000);
			} else {
				$(e.target).html('Check console & reload.').off('click').click(() => { location.reload() });
			}
			console.log(log);
		}
	})
}

new LabelManager('labels-wrap');