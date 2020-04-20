$('.chapter').each((i, elm) => {
	$(elm).data({
		'ogX': $(elm).offset().left,
		'ogY': $(elm).offset().top
	}).text($(elm).offset().top);
})

$('#chapters-wrap').sortable({
	revert: 100,
	start: (e, ui) => {
		const $dragged = $(ui.item);
		const tree = [];
		const index = $dragged.index();
		const $chapters = $('.chapter').not('.ui-sortable-placeholder');
		if (!$dragged.is('.sub, .sub-sub')) {
			for (let i=index+1; i<$chapters.length; i++) {
				if ($chapters.eq(i).is('.sub, .sub-sub')) {
					tree.push($chapters.eq(i));
				} else {
					break;
				}
			}
			console.log(tree)
		}
		$dragged.data('tree', tree)
		// .data({
		// 	'ogX': $dragged.offset().left,
		// 	'ogY': $dragged.offset().top
		// }).text($dragged.offset().top);
	},
	sort: (e, ui) => {
		// Get dragged item coordinates
		const $dragged = $(ui.item);
		const tree = $dragged.data('tree');
		const L = $dragged.offset().left;
		const R = $dragged.offset().left + $dragged.outerWidth();
		const T = $dragged.offset().top;
		const B = $dragged.offset().top + $dragged.outerHeight();

		// Move entire tree
		// Move the element's tree
		for (let i=tree.length-1; i>=0; i--) {
			// console.log('•', tree[i].text())
			if (i==0) {
				console.log(L + '-' + $dragged.data('ogY') + '=' + (L - $dragged.data('ogY')));
			}
			tree[i].css({ left: L - $dragged.data('ogX'), top: T - $dragged.data('ogY') });
		}

		// Check overlap with other items
		$('.chapter').not('.ui-sortable-placeholder').each((i, elm) => {
			if (elm == $dragged.get(0)) return;
			
			// Coordinates of target item
			const tL = $(elm).offset().left;
			const tR = $(elm).offset().left + $(elm).outerWidth();
			const tT = $(elm).offset().top;
			const tB = $(elm).offset().top + $(elm).outerHeight();
			
			// Detect overlap
			if (L < tR && R > tL && T < tB && B > tT) {
				// Yes
				if (!$(elm).hasClass('hover')) {
					$('.chapter').removeClass('hover');
					$(elm).addClass('hover');
					return false;
				}
			} else {
				// No
				if ($(elm).hasClass('hover')) {
					$(elm).removeClass('hover');
					return false;
				}
			}
		});
	},
	stop: (e, ui) => {
		const $dragged = $(ui.item);
		const $targetParent = $('.chapter.hover').removeClass('hover');
		const $prev = $dragged.prev();
		const tree = $dragged.data('tree');
		// console.log('$parent: ', $parent.get(0));
		// console.log('$prev: ', $prev.get(0));
		// console.log('');

		// Abort when the target is within the tree of the dragged element
		let targetTreeIndex = -1;
		tree.forEach(($subChapter, i) => {
			if ($subChapter.get(0) == $targetParent.get(0)) targetTreeIndex = i;
		});
		if (targetTreeIndex != -1) return;

		// When dropped on target
		if ($targetParent.length) {
			// Make sure the element is added after the parent
			if ($dragged.index() < $targetParent.index()) {
				$dragged.insertAfter($targetParent);
			}

			// Add appropriate sub-class	
			if ($targetParent.hasClass('sub')) {
				$dragged.addClass('sub-sub');
			} else {
				$dragged.addClass('sub');
			}
		} else {
			if ($prev.hasClass('sub-sub')) {
				//
			} else if ($prev.hasClass('sub')) {
				$dragged.removeClass('sub-sub');
			} else {
				$dragged.removeClass('sub-sub sub');
			}
		}

		// Move the element's tree
		for (let i=tree.length-1; i>=0; i--) {
			console.log('•', tree[i].text())
			tree[i].insertAfter($dragged);
		}
	}
});

// $('.chapter').draggable({
// 	start: () => {

// 	},
// 	drag: () => {

// 	},
// 	stop: () => {

// 	},
// });