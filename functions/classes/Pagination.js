/*

Pagination Object
- - -

{
	pageNumber: x,
	totalPages: x,
	paginationStart: x,
	paginationEnd: x

}

*/

module.exports = function Pg(p) {
	const _listPages = 30; // Page numbers visible

	// Public properties
	this.pageSize = 10; // Results per page
	this.pageNumber = p ? parseInt(p) : 1,
	// Updated after db query:
	this.totalPages = 0,
	this.paginationStart = 0,
	this.paginationEnd = 0,

	// Update
	this.complete = (resultCount) => {
		// Pagination parameters B
		this.totalPages = Math.ceil(resultCount / this.pageSize);
		
		// Where the pagination begins and ends
		this.paginationStart = Math.floor(this.pageNumber / _listPages) * _listPages;
		this.paginationStart = this.paginationStart === 0 ? 1 : this.paginationStart;
		this.paginationEnd = Math.min(this.totalPages, this.paginationStart + _listPages);
		
		// Adjust pagination start/end on first/last pages
		if (this.totalPages < this.paginationEnd || this.totalPages == _listPages + 1) {
			this.paginationEnd = this.totalPages;
			this.paginationStart = this.totalPages - _listPages;
		}
	}
}