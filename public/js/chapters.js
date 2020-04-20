$('#btn-sort').click(enableSort);
$('#btn-cancel').click(disableSort);
$('#btn-save').click(saveSort);
$('#chapters-wrap').on('click', '.insert', insertForm); // <-- nice trick with event bubble
$('#chapters-wrap').on('click', '.edit', showEditForm);
$('#chapters-wrap').on('click', '.delete', deleteChapter);
$('#chapters-wrap').on('click', '.adopt', adopt);
calibrateAdoptBtns();
numberChapters(); // ##
// enableSort(); // ##





/**
 * Sorting chapters
 */

// Enable sort
function enableSort() {
	$('#button-wrap, #chapters-wrap').addClass('sorting');
	$('.sortable').sortable('destroy').sortable({
		group: 'chapters',
		animation: 200,
		store: {
			get: (sortable) => {
				console.log(sortable.el)
				var order = localStorage.getItem(sortable.options.group.name);
				// console.log('get:', order ? order.split('|') : [])
				return order ? order.split('|') : [];
			},
			set: (sortable) => {
				console.log(sortable.el)
				var order = sortable.toArray();
				console.log('set:', order.join('|'))
				localStorage.setItem(sortable.options.group.name, order.join('|'));
			}
		},
		onSort: onSort
	});

	// Block accidental exit ##
	// window.onbeforeunload = function() {
	// 	return 'You have unsaved changes.';
	// };
}

// Disable sort
function disableSort() {
	$('.sortable').sortable('destroy');
	$('#button-wrap, #chapters-wrap').removeClass('sorting');
}

// Save sort
function saveSort() {
	window.onbeforeunload = null;
	disableSort();
}

// On sort action
function onSort(e) {
	reset();
	console.log('onSort');
}

// Reset everything after lists changes
function reset() {
	console.log('reset');
	// Clean out empty lists
	removeEmptyListWraps();
	// Display adopt buttons
	calibrateAdoptBtns();
	// Make new lists sortable
	// enableSort();
}

// Unwrap empty lists
function removeEmptyListWraps() {
	console.log('removeEmptyListWraps');
	$('#chapters-wrap .sortable').each((i, elm) => {
		if ($(elm).children().length == 1) {
			$(elm).children().first().unwrap();
		}
	});
}





/**
 * 
 * Numbering Chapters
 */
function numberChapters() {
	const chaptersArr = $('#chapters-wrap .chapter').toArray();
	let level = 0; // Level of each chapter (0-2)
	let number = [0,0,0]; // Create our chapter number, eg. 6.3.1

	for (let i in chaptersArr) {
		const $chapter = $(chaptersArr[i]);

		// Get level for this chapter
		const thisLevel = level;

		// Get chapter number
		number[thisLevel]++;

		// Clear out zeros
		const cleanNumber = [...number];
		for (let i=2; i>=0; i--) {
			if (cleanNumber[i] === 0) {
				cleanNumber.pop();
			} else {
				break;
			}
		}

		// Display chapter number
		$chapter.find('.index').text(cleanNumber.join('.'));

		// Set level for next chapter
		if (parseInt(i) !== 0 && $chapter.is(':first-child')) {
			level++;
		} else if ($chapter.is(':last-child')) {
			number[level] = 0;
			level--;
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
		console.log('AJAX: ' + $ip.val());

		// On success:
		_insertChapter();
		_removeForm();
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
		console.log('AJAX: ' + $ip.val());

		// On success:
		_updateChapter();
		_removeForm();
	}

	// Remove new chapter form
	function _removeForm() {
		$('#chapters-wrap').removeClass('no-insert');
		$ip.remove();
	}

	// Insert new chapter
	function _updateChapter() {
		$chapter.show().find('.title').html($ip.val());
	}
}

function renameChapter(e) {

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
 * Adopting next chapter
 */

// Show adopt button for chapters that can adopt
function calibrateAdoptBtns() {
	$('#chapters-wrap .chapter').each((i, elm) => {
		const $chapter = $(elm);
		const $nextChapter = $chapter.next();
		const $adoptBtn = $chapter.find('.adopt').first();

		// Chapter is already parent
		const alreadyParent = $chapter.is(':first-child') && !$chapter.parent().is('.root');
		// No next chapter at same level available
		const noNextChapter = !$nextChapter.length
		// Chapter is at third level already
		const tooDeep = $chapter.parent().parent().parent().is('.root');
		// Level 1 – Next chapter already has two levels
		const nextTooDeep1 = $nextChapter.is('.sortable') && $nextChapter.find('.sortable').length;
		// Level 2 – Next chapter already has one level
		const nextTooDeep2 = $nextChapter.is('.sortable') && !$chapter.parent().is('.root');
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
	const $chapter = $(e.target).parent();
	const $nextChapter = $chapter.next();
	
	$chapter.wrap('<div class="sortable"></div>');
	$nextChapter.insertAfter($chapter);
	reset();
}





/**
 * Saving Chapter
 */
function save() {
	numberChapters();
	const newChapters = [];
	const updatedChapters = [];
	$('#chapters-wrap .chapter').each((i, elm) => {
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
	});

	console.log(newChapters);
	console.log(updatedChapters);
}
