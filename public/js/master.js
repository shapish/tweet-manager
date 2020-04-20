new Nav();

// Shortcut to select elements.
// function $(x) {return document.getElementById(x);}

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