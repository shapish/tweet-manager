debug = false;
$('#btn-edit').click(enableEdit);
$('#btn-cancel').click(cancelEdits);
$('#btn-save').click(saveEdits);
$('#chapters-wrap').on('click', '.insert', insertForm); // <-- nice trick with event bubble
$('#chapters-wrap').on('click', '.edit', showEditForm);
$('#chapters-wrap').on('click', '.delete', deleteChapter);
$('#chapters-wrap').on('click', '.adopt', adopt);
enableEdit(); // ##
initialize();





// Initialize fresh HTML
function initialize() {
	storeInitialValues();
	setAdoptBtns();
}




/**
 * Numbering Chapters
 */
function numberChapters() {
	const chaptersArr = $('#chapters-wrap .chapter').toArray();
	let level = 0; // Level of each chapter (0-2)
	let number = []; // Create our chapter number, eg. 6.3.1

	for (let i in chaptersArr) {
		const $chapter = $(chaptersArr[i]);

		// Get level for this chapter
		const thisLevel = level;

		// Get chapter number
		number[thisLevel] = number[thisLevel] ? number[thisLevel] + 1 : 1;

		// Clear out zeros
		const cleanNumber = [...number]; // Dupicate array
		for (let i=cleanNumber.length - 1; i>=0; i--) {
			if (cleanNumber[i] === 0) {
				cleanNumber.pop();
			} else {
				break;
			}
		}

		// Display chapter number
		$chapter.find('.index').text(cleanNumber.join('.'));

		// Set level for next chapter
		if ($chapter.is(':first-child')) {
			if (!(parseInt(i) == 0 && $chapter.parent().is('.level-0'))) {
				level++;
			}
		} else if ($chapter.is(':last-child')) {
			number[level] = 0;
			level--;
			// When going from 1.1.1 to 2 = two levels
			if ($chapter.parent().is(':last-child')) {
				number[level] = 0;
				level--;
			}
		}
	}
}





/**
 * Adding new chapter
 */

// Insert new chapter form
function insertForm(e) {
	const $chapter = $(e.target).parent();
	const $ip = $('<input type="text">').insertAfter($chapter).focus();
	$('#chapters-wrap').addClass('no-insert');
	disableSort();
	
	// Key events
	$ip.keyup(function(e) {
		// console.log(e.which);
		if (e.which == 13) {
			// ENTER
			if ($ip.val().length > 0) _submitForm();
		} else if (e.which == 27) {
			// ESC
			_removeForm();
		}
	}).blur(function() {
		if ($ip.val() === '') _removeForm();
	});

	// Submit new chapter form
	function _submitForm() {
		if (debug) console.log('AJAX: ' + $ip.val());
		$.ajax({
			type: 'POST',
			url: '/api/chapters',
			data: {
				title: $ip.val(),
				index: $('#chapters-wrap').children().length + 1
			},
			dataType: 'json',
			encode: true,
			error: (error) => {
				console.log('error!:', error);
			},
			success: (data) => {
				console.log('success!:', data);
				_insertChapter();
				_removeForm();
			}
		});
	}

	// Remove new chapter form
	function _removeForm() {
		$('#chapters-wrap').removeClass('no-insert');
		$ip.remove();
		reset();
	}

	// Insert new chapter
	function _insertChapter() {
		const $newChapter = $($('#template-chapter').prop('content')).clone();
		$newChapter.find('.title').text($ip.val())
		$newChapter.insertAfter($ip);
	}
}





/**
 * Renaming chapters
 */
function showEditForm(e) {
	const $chapter = $(e.target).closest('.chapter');
	$('#chapters-wrap').addClass('no-insert');
	$chapter.hide();
	const $ip = $('<input type="text">').insertAfter($chapter).val($chapter.find('.title').text()).select();
	
	// Key events
	$ip.keyup(function(e) {
		// console.log(e.which);
		if (e.which == 13) {
			// ENTER
			_submitForm($ip)
		} else if (e.which == 27) {
			// ESC
			_removeForm($ip)
		}
	}).blur(function() {
		if ($ip.val() === '') _removeForm();
	});

	// Submit new chapter form
	function _submitForm() {
		if (debug) console.log('AJAX: ' + $ip.val());
		$.ajax({
			type: 'PUT',
			url: '/api/chapters/' + $chapter.attr('data-id'),
			data: {
				title: $ip.val()
			},
			dataType: 'json',
			encode: true,
			error: (error) => {
				console.log('error!:', error);
			},
			success: (data) => {
				console.log('success!:', data);
				_updateUi();
				_removeForm();
			}
		});
	}

	// Remove new chapter form
	function _removeForm() {
		$('#chapters-wrap').removeClass('no-insert');
		$ip.remove();
	}

	// Insert new chapter
	function _updateUi() {
		$chapter.show().find('.title').html($ip.val());
	}
}





/**
 * Deleting chapters
 */

function deleteChapter(e) {
	const $chapter = $(e.target).closest('.chapter');
	$chapter.remove();
	reset();
}





/**
 * Sorting
 */

// Enable sort
function enableSort() {
	if (debug) console.log('enableSort')

	// Sort up to 10 levels deep
	for (let i=0; i<10; i++) {
		if (!$('.sortable.level-' + i).length) return false;
		
		$('.sortable.level-' + i).sortable('destroy').sortable({
			handle: '.block',
			draggable: ':not(:first-child):not(span):not(.adopt):not(.edit):not(.delete)',
			group: 'chapters',
			animation: 200,
			onSort: onSort
		});
	}
}

// Disable sort
function disableSort() {
	$('.sortable').sortable('destroy');
}

// On sort action
function onSort(e) {
	if (debug) console.log('onSort');
	reset();
}

// Reset everything every time list changes
function reset() {
	if (debug) console.log('reset');

	// Clean out empty lists
	removeEmptyListWraps();
	
	// Display adopt buttons
	setAdoptBtns();
	
	// Make new lists sortable
	enableSort();
}

// Unwrap empty lists
function removeEmptyListWraps() {
	if (debug) console.log('removeEmptyListWraps');
	$('#chapters-wrap .sortable').each((i, elm) => {
		if ($(elm).children().length == 1) {
			$(elm).children().first().unwrap();
		}
	});
}





/**
 * Adopting next chapter
 */

// Show adopt button for chapters that can adopt
function setAdoptBtns() {
	return;
	$('#chapters-wrap .chapter').each((i, elm) => {
		const $chapter = $(elm);
		const $nextChapter = $chapter.next();
		const $adoptBtn = $chapter.find('.adopt').first();

		// Chapter is already parent
		const alreadyParent = $chapter.is(':first-child') && !$chapter.parent().is('.level-0');
		// No next chapter at same level available
		const noNextChapter = !$nextChapter.length
		// Chapter is at third level already
		const tooDeep = $chapter.parent().parent().parent().is('.level-0');
		// Level 1 – Next chapter already has two levels
		const nextTooDeep1 = $nextChapter.is('.sortable') && $nextChapter.find('.sortable').length;
		// Level 2 – Next chapter already has one level
		const nextTooDeep2 = $nextChapter.is('.sortable') && !$chapter.parent().is('.level-0');
		// Next chapter goes too deep
		const error = alreadyParent || noNextChapter || tooDeep || nextTooDeep1 || nextTooDeep2;

		if (error) {
			$chapter.removeClass('canAdopt');
		} else {
			$chapter.addClass('canAdopt');
		}
	});
}

// Adopt next chapter as child
function adopt(e) {
	const $chapter = $(e.target).closest('.chapter');

	// Check if this chapter is already parent
	const isParent = ($chapter.is(':first-child') && !$chapter.parent().is('.level-0'));
	
	if (isParent) {
		// Add next chapter as child
		const $nextchapter = $chapter.parent().next();
		console.log($nextchapter.get(0))
		$chapter.parent().append($nextchapter);
	} else {
		// Become parent & add child
		const $nextChapter = $chapter.next();
		$chapter.wrap('<div class="sortable"></div>');
		$chapter.after($nextChapter);
	}
	
	
	reset();
}





/**
 * Editing Mode
 */

// Enable sort
function enableEdit() {
	$('#button-wrap, #chapters-wrap').addClass('editing');
	enableSort();

	// Block accidental exit ##
	// window.onbeforeunload = function() {
	// 	return 'You have unsaved changes.';
	// };

	// Save current state in local storage
	localStorage.setItem('ogState', $('#chapters-wrap').html());
}

function disableEdit() {
	$('#button-wrap, #chapters-wrap').removeClass('editing');
	disableSort();
	window.onbeforeunload = null;
}

// Cancel
function cancelEdits() {
	disableEdit();

	// Reset list to original state
	const ogState = localStorage.getItem('ogState', $('#chapters-wrap').html());
	$('#chapters-wrap').html(ogState);
	initialize();
}

// Save
function saveEdits() {
	disableEdit();
	numberChapters();
	saveToServer();
}





/**
 * Saving Chapter
 */

 // Store initial values so we can detect changes
function storeInitialValues() {
	$('#chapters-wrap .chapter').each((i, elm) => {
		$(elm).data({
			title: $(elm).find('.title').text(),
			index: $(elm).find('.index').text(),
		});
	});
}

// Save changes to server
function saveToServer() {
	numberChapters();
	const newChapters = [];
	const updatedChapters = [];
	// const chapters = [];

	// Detect changes
	$('#chapters-wrap .chapter').each((i, elm) => {
		if (!hasChanged($(elm))) return;
		const chapter = {
			title: $(elm).find('.title').text(),
			index: $(elm).find('.index').text()
		}
		if ($(elm).is('[data-id]')) {
			chapter._id = $(elm).attr('data-id');
			updatedChapters.push(chapter);
		} else {
			newChapters.push(chapter);
		}
		// chapters.push(chapter);
	});
	
	// Send to server
	$.ajax({
		type: 'PUT',
		url: '/api/chapters',
		data: {
			newChapters: newChapters,
			updatedChapters: updatedChapters
		},
		dataType: 'json',
		encode: true,
		error: (error) => {
			console.log('error!:', error);
		},
		success: (data) => {
			console.log('success!:', data);
		}
	});

	function hasChanged($chapter) {

		const indexChange = ($chapter.find('.index').text() != $chapter.data('index'));
		const titleChange = ($chapter.find('.title').text() != $chapter.data('title'));
		// console.log($chapter.find('.title').text(), indexChange, titleChange, $chapter.find('.index').text() +'!='+ $chapter.data('index'))
		return (indexChange || titleChange);
	}

	// console.log(newChapters);
	// console.log(updatedChapters);
}
