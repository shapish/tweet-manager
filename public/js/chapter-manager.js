function ChapterManager(id, options) {
	this.$wrap = $('#' + id);
	_setOptions.bind(this)();
	_init.bind(this)();

	// Parse options
	function _setOptions() {
		// Set control buttons
		this.$btnWrap = options.$btnWrap ? options.$btnWrap : $('#button-wrap');
		this.$btnEdit = options.$btnEdit ? options.$btnEdit : $('#btn-edit');
		this.$btnCancel = options.$btnCancel ? options.$btnCancel : $('#btn-cancel');
		this.$btnSave = options.$btnSave ? options.$btnSave : $('#btn-save');

		// Set API endpoints
		this.urlDelete = options.urlDelete ? options.urlDelete : '/api/chapters';
		this.urlSave = options.urlSave ? options.urlSave : '/api/chapters';

		// Set other options
		options = options ? options : {};
		this.$template = $('#' + (options.template ? options.template : 'template-chapter')); // HTML template for new chapters
		this.debug = options.debug ? options.debug : false;
	}

	function _init() {
		// Control buttons
		this.$btnEdit.click(this.edit.bind(this));
		this.$btnCancel.click(this.cancel.bind(this));
		this.$btnSave.click(this.save.bind(this));

		// Table elements
		this.$wrap.on('click', '.insert', this._insertForm.bind(this)); // <-- nice trick with event bubble
		this.$wrap.on('click', '.abandon', this._abandon.bind(this));
		this.$wrap.on('click', '.adopt', this._adopt.bind(this));
		this.$wrap.on('click', '.move', (e) => this._toggleMove.bind(this)($(e.target).closest('.cm-chapter')));
		this.$wrap.on('click', '.rename', this._showRenameForm.bind(this));
		this.$wrap.on('click', '.delete', this._confirmDeleteChapter.bind(this));

		// To detect changes on save
		this._storeInitialValues();
	}
}





/**
 * Public functions
 */

// Enable editing
ChapterManager.prototype.edit = function() {
	this.$wrap.addClass('cm-editing');
	this.$btnWrap.addClass('cm-editing');
	this._enableSort();
	this.deletedChapterIds = [];

	// Block accidental exit
	if (!this.debug) {
		window.onbeforeunload = function() { // ##
			return 'You have unsaved changes.';
		};
	}

	// Save current state in local storage
	localStorage.setItem('ogSortState', this.$wrap.html());
};

// Cancel
ChapterManager.prototype.cancel = function() {
	this._disableEdit();

	// Reset list to original state
	const ogState = localStorage.getItem('ogSortState', this.$wrap.html());
	this.$wrap.html(ogState);
	this._storeInitialValues();
};

// Save
ChapterManager.prototype.save = function() {
	this._disableEdit();
	this._numberChapters();
	this._saveToServer();
};

// Disable editing
ChapterManager.prototype._disableEdit = function() {
	this.$wrap.removeClass('cm-editing');
	this.$btnWrap.removeClass('cm-editing');
	this._disableSort();
	window.onbeforeunload = null;
};





/**
 * Adding & renaming chapters
 */

// Insert ADD form
ChapterManager.prototype._insertForm = function(e) {
	const $chapter = $(e.target).parent();
	const $ip = $('<input type="text">').insertAfter($chapter).focus();
	this.$wrap.addClass('no-insert');
	this._disableSort();

	// Exit move UI
	this._toggleMove(false);
	
	// Key events
	$ip.keyup((e) => {
		// console.log(e.which);
		if (e.which == 13) {
			// ENTER
			if ($ip.val().length > 0) this._submitAddForm($ip);
		} else if (e.which == 27) {
			// ESC
			this._removeForm($ip);
		}
	}).blur(() => {
		if ($ip.val() === '') this._removeForm($ip);
	});

	
};

// Show RENAME form
ChapterManager.prototype._showRenameForm = function(e) {
	const $chapter = $(e.target).closest('.cm-chapter');
	this.$wrap.addClass('no-insert');
	$chapter.hide();
	const $ip = $('<input type="text">').insertAfter($chapter).val($chapter.find('.title').text()).select();
	
	// Key events
	$ip.keyup((e) => {
		// console.log(e.which);
		if (e.which == 13) {
			// ENTER
			this._submitRenameForm($ip, $chapter);
		} else if (e.which == 27) {
			// ESC
			this._removeForm($ip, $chapter);
		}
	}).blur(() => {
		const noChange = $ip.val() == $chapter.data('title');
		if ($ip.val() === '' || noChange) this._removeForm($ip, $chapter);
	});
};

// Submit ADD form
ChapterManager.prototype._submitAddForm = function($ip) {
	_insertChapter.bind(this)();
	this._removeForm($ip);

	// Insert new chapter
	function _insertChapter() {
		const $newChapter = $(this.$template.prop('content')).clone();
		$newChapter.find('.title').text($ip.val());
		$newChapter.insertAfter($ip);
	}
};

// Submit RENAME form
ChapterManager.prototype._submitRenameForm = function($ip, $chapter) {
	_updateUi.bind(this)();
	this._removeForm($ip, $chapter);

	// Insert new chapter
	function _updateUi() {
		$chapter.show().find('.title').html($ip.val());
	}
}

// Remove ADD/RENAME form
ChapterManager.prototype._removeForm = function($ip, $chapter) {
	this.$wrap.removeClass('no-insert');
	this._enableSort();
	$ip.remove();
	if ($chapter) $chapter.show();
};





/**
 * Deleting chapters
 */

// Confirm delete
ChapterManager.prototype._confirmDeleteChapter = function(e) {
	const $chapter = $(e.target).closest('.cm-chapter');
	const chapterTitle = $chapter.find('.title').text();
	const $list = $chapter.is(':first-child') && !$chapter.parent().hasClass('level-0') ? $chapter.parent() : null;

	// Cycle trough sub chapters and put them in array for deletion
	let chaptersToDelete = [];
	let subChaptersTitles = [];
	if ($list) {
		// Add parent and all subs
		$list.children().each(_cycleChapters);
	} else {
		// Add single (no subs)
		chaptersToDelete.push($chapter);
	}

	// Compile message
	subChaptersTitles = subChaptersTitles.join('\n- ');
	const message = $list ? `!!! WARNING !!!\nYou are deleting the chapter "${chapterTitle}" and all its sub-chapters. Are you sure you want to do that?\n\n- ${subChaptersTitles}` : `Are you sure you want to delete the chapter "${chapterTitle}"?`
	const confirmDelete = confirm(message);

	// Show confirm
	if (confirmDelete) _deleteChapters.bind(this)();


	function _cycleChapters(i, elm) {
		if ($(elm).hasClass('sortable')) {
			$(elm).children().each(_cycleChapters);
		} else {
			chaptersToDelete.push($(elm));
			subChaptersTitles.push($(elm).find('.title').html());
		}
	}

	function _deleteChapters() {
		// Exit move UI
		this._toggleMove(false);

		// Delete
		chaptersToDelete.forEach(($chapter) => {
			// Add id to array to be deleted on save
			if ($chapter.is('[data-id]')) {
				this.deletedChapterIds.push($chapter.attr('data-id'));
			}
			// Update UI
			$chapter.remove();
		});
		
		// Reconfigure UI
		this._reset();
	}
};





/**
 * Sorting
 */

// Enable sorting
ChapterManager.prototype._enableSort = function() {
	if (this.debug) console.log('_enableSort')

	// Sort up to 10 levels deep
	for (let i=0; i<10; i++) {
		if (!$('.sortable.level-' + i).length) return false;
		const draggable = (i === 0) ? '>*' : ':not(:first-child):not(span):not(.adopt):not(.rename):not(.delete)'; // '>*' is the default value in Sortable.js
		$('.sortable.level-' + i).sortable('destroy').sortable({
			handle: '.content',
			draggable: draggable,
			group: 'chapters',
			animation: 200,
			onSort: this._onSort.bind(this),
			onStart: () => {
				$('body').addClass('dragging');
			},
			onEnd: () => {
				$('body').removeClass('dragging');
			}
		});
	}
};

// Disable sorting
ChapterManager.prototype._disableSort = function() {
	if (this.debug) console.log('_disableSort');
	// There's a disable option for this, but we need to destroy and reinitialize after each change anyways
	// otherwise newly formed parents won't sort
	$('.sortable').sortable('destroy');
};

// Do after each sort change
ChapterManager.prototype._onSort = function(e) {
	if (this.debug) console.log('onSort');

	// When moving a chapter from one level to another, prevent reset from being called twice
	clearTimeout(this.resetTimeout);
	this.resetTimeout = setTimeout(this._removeEmptyListWraps.bind(this), 10);

	// When moving a list from one level to another, update its level
	if ($(e.item).hasClass('sortable')) {
		this._updateLevel($(e.item));
	}
	
};

// Reset everything every time list changes
ChapterManager.prototype._reset = function() {
	if (this.debug) console.log('reset');

	// Clean out empty lists
	this._removeEmptyListWraps();
	
	// Make new lists sortable
	this._enableSort();
};

// Remove empty lists
ChapterManager.prototype._removeEmptyListWraps = function() {
	if (this.debug) console.log('removeEmptyListWraps');

	// We need to do this in two cycles, otherwise
	// Empty children lists will be counted as children

	// First cycle though all empty wraps (removed parent + subs)
	this.$wrap.find('.sortable').each((i, elm) => {
		if ($(elm).children().length === 0) {
			$(elm).remove();
		}
	});

	// Then cycle through all lists with only one child (removed subs)
	this.$wrap.find('.sortable').each((i, elm) => {
		if ($(elm).children().length == 1) {
			$(elm).children().first().unwrap();
		}
	});
};




/**
 * Abandoning child chapters
 */

ChapterManager.prototype._abandon = function(e) {
	const $chapter = $(e.target).closest('.cm-chapter');
	const wrapClass = $chapter.parent().get(0).className;

	// Exit move UI
	this._toggleMove(false);

	if (wrapClass.indexOf('level-0') == -1 && wrapClass.indexOf('level-') != -1) {
		$chapter.unwrap();
		$chapter.parent().find('.sortable').each((i, elm) => {
			this._updateLevel($(elm));
		});
	} else {
		console.error('Can\'t unwrap this list.');
	}
};




/**
 * Move chapter up and down
 */

// Toggle moving state
// Moving state (.cm-moving) can be applied to a chapter (.chapter) or a list (.sortable )
ChapterManager.prototype._toggleMove = function($chapter) {
	// Item is either chapter or group of chapters
	$item = $chapter ? (($chapter.is(':first-child') && !$chapter.parent().is('.level-0')) ? $chapter.parent() : $chapter) : false;
	
	// Check if we need to turn it on or off
	const turnOn = !$item ? false : !($item.hasClass('cm-moving'));
	if (!turnOn) {
		_off.bind(this)();
		return;
	} else {
		_on.bind(this)();
	}

	function _on() {
		this.$wrap.find('.cm-moving').removeClass('cm-moving');
		$item.addClass('cm-moving');
		_bindKeys.bind(this)();
	}

	function _off() {
		this.$wrap.find('.cm-moving').removeClass('cm-moving');
		_unbindKeys();
	}

	function _bindKeys() {
		$(window).off('keydown.movingChapter').on('keydown.movingChapter', (e) => {
			// console.log(e.which);
			if (e.which == 38) {
				// Up
				this._moveUp($item);
				e.preventDefault();
			} else if (e.which == 40) {
				// Down
				this._moveDown($item);
				e.preventDefault();
			} else if (e.which == 13 || e.which == 27) {
				// Enter || Esc
				_off.bind(this)();
			}
		});
	}

	function _unbindKeys() {
		$(window).off('keydown.movingChapter');
	}
};

// Move up
ChapterManager.prototype._moveUp = function($item) {
	$parent = $item.parent();
	isTopLevel = $parent.hasClass('level-0');
	// console.log('item: ', $item.attr('class'));

	// Catch impossible error
	if ($item.is(':first-child') && $item.parent().is('.level-0')) { return console.error('Can\'t move chapter further up'); }

	if ($item.index() == 1 && !isTopLevel) {
		// console.log('u1');
		// Move up + one level higher
		$item.insertBefore($parent);
		this._removeEmptyListWraps();
		if ($item.hasClass('sortable')) this._updateLevel($item);
	} else {
		// console.log('u2');
		// Move up
		$item.insertBefore($item.prev());
	}
};

// Move down
ChapterManager.prototype._moveDown = function($item) {
	$parent = $item.parent();
	isTopLevel = $parent.hasClass('level-0');
	// console.log('item: ', $item.attr('class'))

	// Catch impossible error
	if ($item.is(':last-child') && isTopLevel) { return console.error('Can\'t move chapter further down'); }

	if ($item.is(':last-child') && !isTopLevel) {
		// console.log('d1');
		// Move down + one level higher
		$item.insertAfter($parent);
		this._removeEmptyListWraps();
		if ($item.hasClass('sortable')) this._updateLevel($item);
	} else {
		// console.log('d2');
		// Move down
		$item.insertAfter($item.next());
	}
};




/**
 * Adopting next chapter
 */

// Adopt next chapter as child
ChapterManager.prototype._adopt = function(e) {
	const $chapter = $(e.target).closest('.cm-chapter');

	// Exit move UI
	this._toggleMove(false);

	// Check if chapter is already parent, then get level
	const isParent = ($chapter.is(':first-child') && !$chapter.parent().is('.level-0'));
	const $nextItem = isParent ? $chapter.parent().next() : $chapter.next(); // Can be chapter of list
	const level = this._getLevel($nextItem); // Define level for the current list
	
	// When adopting another list, we need to update its level
	if ($nextItem.is('.sortable')) {
		this._updateLevel($nextItem, level + 1);
	}

	if (isParent) {
		// Add next chapter as child
		$chapter.parent().append($nextItem);
	} else {
		// Become parent & add child
		$chapter.wrap('<div class="sortable level-' + level + '"></div>');
		$chapter.after($nextItem);
	}
	this._reset();
};

// Get the level of a chapter
ChapterManager.prototype._getLevel = function($item) {
	// ## Can be done more elegantly with regex
	let classValue = $item.parent().closest('.sortable').attr('class');
	classValue = classValue.slice(classValue.indexOf('level-') + 6);
	classValue = classValue.slice(0,1);
	return parseInt(classValue) + 1;
};

// When a list changes level
// Either by being adopted or by being dropped
ChapterManager.prototype._updateLevel = function($list, level) {
	// If no level is set, get it (used for _onSort)
	level = level ? level : this._getLevel($list);

	const list = $list.get(0);
	const prefix = 'level-';
	const classes = list.className.split(' ').filter(c => !c.startsWith(prefix));
	list.className = classes.join(' ').trim() + ' level-' + level;
};





/**
 * Saving Chapter
 */

// Store initial values so we can detect changes
ChapterManager.prototype._storeInitialValues = function() {
	this.$wrap.find('.cm-chapter').each((i, elm) => {
		$(elm).data({
			title: $(elm).find('.title').text(),
			index: $(elm).find('.index').text(),
		});
	});
};

// Number chapters
ChapterManager.prototype._numberChapters = function() {
	let level = 0; // Level of each chapter (0-2)
	let number = []; // Create our chapter number, eg. 6.3.1

	this.$wrap.find('.cm-chapter').each((i, elm) => {
		let $chapter = $(elm);

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
			// Cycle throug levels when going from 1.x.x.x.x to 2
			while ($chapter.parent().is(':last-child')) {
				$chapter = $chapter.parent();
				number[level] = 0;
				level--;
			}
		}
	});
};

// Save changes to server
ChapterManager.prototype._saveToServer = function() {
	if (this.debug) console.log('_saveToServer');

	// Prep:
	this._toggleMove(false); // Exit move UI
	_submitForms.bind(this)();
	this._numberChapters();

	// Detect changes - new and updated chapters
	const chapters = [];
	this.$wrap.find('.cm-chapter').each((i, elm) => {
		if (!_hasChanged($(elm))) return;

		// Get index
		const index = $(elm).find('.index').text();

		// Create separate sort index
		// This is to make sure 1.3 somes after 1.20
		let sortIndex = index.split('.');
		sortIndex.forEach((nr, i, arr) => arr[i] = +nr+10000);
		sortIndex = sortIndex.join('-');

		const chapter = {
			_id: $(elm).attr('data-id'),
			title: $(elm).find('.title').text(),
			index: index,
			sortIndex: sortIndex
		}
		chapters.push(chapter);
	});
	
	// Send requests to server
	if (chapters.length || this.deletedChapterIds.length) {
		$.ajax({
			type: 'PUT',
			url: this.urlSave,
			data: {
				chapters: chapters,
				deletedChapterIds: this.deletedChapterIds
			},
			dataType: 'json',
			encode: true,
			error: (error) => {
				if (this.debug) console.log('error!:', error);
			},
			success: (result) => {
				if (this.debug) console.log('success!:', result);
				_attachNewIds.bind(this)(result);
				this.deletedChapterIds = [];
				this._storeInitialValues();
			}
		});
	}

	function _hasChanged($chapter) {
		const indexChange = ($chapter.find('.index').text() != $chapter.data('index'));
		const titleChange = ($chapter.find('.title').text() != $chapter.data('title'));
		// console.log($chapter.find('.title').text(), indexChange, titleChange, $chapter.find('.index').text() +'!='+ $chapter.data('index'))
		return (indexChange || titleChange);
	}

	// Cycle through all open forms and submit them
	function _submitForms() {
		this.$wrap.find('input[type=text]').each((i, ip) => {
			const isRenameForm = (!$(ip).prev().is(':visible'))
			if (isRenameForm) {
				const $chapter = $(ip).prev();
				this._submitRenameForm($(ip), $chapter);
			} else {
				this._submitAddForm($(ip));
			}
		});
	}

	// Attach newly created IDs to new chapters
	function _attachNewIds(result) {
		// For each chapter with missing ID
		// Store index, title and jQuery reference in separate arrays
		const missingIdIndexes = [];
		const missingIdTitles = [];
		const missingIdChapters = [];
		this.$wrap.find('.cm-chapter').not('[data-id]').each((i, elm) => {
			missingIdIndexes.push($(elm).find('.index').text());
			missingIdTitles.push($(elm).find('.title').text());
			missingIdChapters.push($(elm));
		});

		// Match result with array, only attaching
		// id when both index and title match
		result.forEach(chapter => {
			indexIndex = missingIdIndexes.indexOf(chapter.index);
			titleIndex = missingIdTitles.indexOf(chapter.title);
			if (indexIndex != -1 && (indexIndex == titleIndex)) {
				missingIdChapters[indexIndex].attr('data-id', chapter._id);
				console.log(missingIdChapters[indexIndex].get(0))
			}
		});
	}
};