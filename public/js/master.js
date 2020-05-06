function setOverview(id, pctArchived, pctProcessed, total) {
	this.$display = $('#' + id);
	this.$bar = this.$display.find('.bar');
	this.$text = this.$display.find('span');
	this.$archived = this.$bar.find('.archived');
	this.$processed = this.$bar.find('.processed');
	
	// Update ui.
	this.$archived.width(pctArchived);
	this.$processed.width(pctProcessed);
	this.$text.text(total + ' tweets');
}

// Update dropdowns custom ui
$('select').on('change', (e) => {
	const value = e.target.value;
	const $selOption = $(e.target).children('option[value="' + value + '"]');
	const displayValue = $selOption.attr('data-display-value') ? $selOption.attr('data-display-value') : $selOption.text();
	const $parent = $(e.target).parent();
	if ($parent.is('.dd-display')) {
		$parent.attr('data-value', value);
		$parent.attr('data-display-value', displayValue);
		$parent.children('.dsp').text(displayValue);
	}
});


// Global loading state
function loading(on) {
	if (on === false) {
		$('body').removeClass('loading');
	} else {
		$('body').addClass('loading');
	}
}