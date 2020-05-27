/*
	jQuery autoComplete v1.0.7
	Copyright (c) 2014 Simon Steinberger / Pixabay
	Updated by Moenen Erbuer (c) 2020 to include suggesting new values
	GitHub: https://github.com/Pixabay/jQuery-autoComplete
	License: http://www.opensource.org/licenses/mit-license.php
*/

(function($) {
	$.fn.autoComplete = function(options) {
		// Read options
		const o = $.extend({}, $.fn.autoComplete.defaults, options);

		// Catch destroy option
		if (typeof options == 'string') {
			this.each(function() {
				const $ip = $(this);
				if (options == 'destroy') {
					$(window).off('resize.autocomplete', _positionSC);
					$ip.off('blur.autocomplete focus.autocomplete keydown.autocomplete keyup.autocomplete');
					if ($ip.data('autocomplete')) {
						$ip.attr('autocomplete', $ip.data('autocomplete'));
					} else {
						$ip.removeAttr('autocomplete');
					}
					$($ip.data('sc')).remove();
					$ip.removeData('sc').removeData('autocomplete');
				}
			});
			return this;
		}

		// Loop through all activated inputs
		return this.each(function() {
			const $ip = $(this);
			
			// Create suggestions container
			$ip.sc = $('<div class="autocomplete-suggestions '+o.menuClass+'"></div>');
			$ip.sc.appendTo('body');

			// Prep for clean destroy
			$ip.data('sc', $ip.sc).data('autocomplete', $ip.attr('autocomplete'));

			// Base settings
			$ip.attr('autocomplete', 'off');
			$ip.cache = {};
			$ip.lastVal = '';

			// Update suggestions
			$ip.updateSC = function(next) {
				// Position
				_positionSC($ip);

				// Update content
				$ip.sc.show();
				if (!$ip.sc.maxHeight) $ip.sc.maxHeight = parseInt($ip.sc.css('max-height'));
				if (!$ip.sc.suggestionHeight) $ip.sc.suggestionHeight = $('.autocomplete-suggestion', $ip.sc).first().outerHeight();
				if ($ip.sc.suggestionHeight) {
					if (!next) {
						$ip.sc.scrollTop(0);
					} else {
						const scrTop = $ip.sc.scrollTop(), selTop = next.offset().top - $ip.sc.offset().top;
						if (selTop + $ip.sc.suggestionHeight - $ip.sc.maxHeight > 0) {
							$ip.sc.scrollTop(selTop + $ip.sc.suggestionHeight + scrTop - $ip.sc.maxHeight);
						} else if (selTop < 0) {
							$ip.sc.scrollTop(selTop + scrTop);
						}
					}
				}
			}

			// Hover suggestions
			$ip.sc.on('mouseleave', '.autocomplete-suggestion', function () {
				$('.autocomplete-suggestion.selected').removeClass('selected');
			});
			$ip.sc.on('mouseenter', '.autocomplete-suggestion', function () {
				$('.autocomplete-suggestion.selected').removeClass('selected');
				$(this).addClass('selected');
			});

			// Select suggestion	
			$ip.sc.on('mousedown click', '.autocomplete-suggestion', function (e) {
				const item = $(this);
				const val = item.data('val');
				if (val || item.hasClass('autocomplete-suggestion')) { // else outside click
					$ip.val(val);
					o.onSelect(e, val, item);
					$ip.sc.hide();
				}
				return false;
			});

			// Blur event
			$ip.on('blur.autocomplete', function() {
				try { over_sb = $('.autocomplete-suggestions:hover').length; } catch(e) { over_sb = 0; } // IE7 fix :hover
				if (!over_sb) {
					$ip.lastVal = $ip.val();
					$ip.sc.hide();
					setTimeout(() => { $ip.sc.hide(); }, 350); // hide suggestions on fast input
				} else if (!$ip.is(':focus')) {
					setTimeout(() => { $ip.focus(); }, 20);
				}
			});

			// Show suggest on focus
			if (!o.minChars) {
				$ip.on('focus.autocomplete', function() {
					$ip.lastVal = '\n';
					$ip.trigger('keyup.autocomplete');
				});
			}
			
			// Keyboard events UX
			$ip.on('keydown.autocomplete', function(e) {
				if ((e.which == 40 || e.which == 38) && $ip.sc.html()) {
					// Down / Up
					let next, sel = $('.autocomplete-suggestion.selected', $ip.sc);
					if (!sel.length) {
						next = (e.which == 40) ? $('.autocomplete-suggestion', $ip.sc).first() : $('.autocomplete-suggestion', $ip.sc).last();
						$ip.val(next.addClass('selected').data('val'));
					} else {
						next = (e.which == 40) ? sel.next('.autocomplete-suggestion') : sel.prev('.autocomplete-suggestion');
						if (next.length) { sel.removeClass('selected'); $ip.val(next.addClass('selected').data('val')); }
						else { sel.removeClass('selected'); $ip.val($ip.lastVal); next = 0; }
					}
					$ip.updateSC(0, next);
					return false;
				} else if (e.which == 27) {
					// Esc
					$ip.val($ip.lastVal).sc.hide();
				} else if (e.which == 13 || e.which == 9) {
					// Enter / Tab
					const sel = $('.autocomplete-suggestion.selected', $ip.sc);
					if (sel.length && $ip.sc.is(':visible')) {
						o.onSelect(e, sel.data('val'), sel);
						setTimeout(() => { $ip.sc.hide(); }, 20);
					}
				}
			});

			// Keyboard events typing
			const blockedKeys = [13, 27, 35, 36, 37, 38, 39, 40];
			$ip.on('keyup.autocomplete', function(e) {
				if (!blockedKeys.includes(e.which)) {
					const val = $ip.val();
					if (val.length >= o.minChars) {
						if (val != $ip.lastVal) {
							$ip.lastVal = val;
							clearTimeout($ip.timer);
							if (o.cache) {
								if (val in $ip.cache) {
									suggest($ip.cache[val]);
									return;
								}
								// No requests if previous suggestions were empty
								for (let i=1; i<val.length-o.minChars; i++) {
									const part = val.slice(0, val.length-i);
									if (part in $ip.cache && !$ip.cache[part].length) {
										suggest([]);
										return;
									}
								}
							}
							$ip.timer = setTimeout(function() {
								o.source(val, suggest);
							}, o.delay);
						}
					} else {
						$ip.lastVal = val;
						$ip.sc.hide();
					}
				}
			});

			// Suggest results
			function suggest(data) {
				let val = $ip.val();
				val = val.replace(/[^0-9a-zA-Z- ]/g, ''); // Sanitize
				$ip.cache[val] = data;
				let string = '';
				if (data.length && val.length >= o.minChars) {
					for (let i=0; i<data.length; i++) {
						string += o.renderItem(data[i], val);
					}
				}
				// Offer to add unknown terms (prefix with add: )
				if (!data.includes(val) && val.length > 1) {
					string += o.renderItem(val, val, true);
				}
				if (string.length) {
					$ip.sc.html(string);
					$ip.updateSC(0);
				} else {
					$ip.sc.hide();
				}
			}
		});

		// Position suggestion container
		function _positionSC($ip) {
			$ip.sc.css({
				top: $ip.offset().top + $ip.outerHeight(),
				left: $ip.offset().left,
				width: $ip.outerWidth()
			});
		}

	}

	// Default options
	$.fn.autoComplete.defaults = {
		source: 0,
		minChars: 3,
		delay: 150,
		cache: 1,
		menuClass: '',
		renderItem: function (item, search, newTerm) {
			// For new terms, prefix with 'add: ';
			const prefix = newTerm ? 'add: ' : '';
			// Escape special characters
			search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
			const re = new RegExp('(' + search.split(' ').join('|') + ')', 'gi');
			return '<div class="autocomplete-suggestion" data-val="' + item + '">' + prefix + item.replace(re, "<b>$1</b>") + '</div>';
		},
		onSelect: function(e, term, item) {}
	};
}(jQuery));
