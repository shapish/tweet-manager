/*

Creates Pagination Object
- - -

{
	pageNumber: x,
	totalPages: x,
	paginationStart: x,
	paginationEnd: x

}

*/

module.exports = function Pg(p, user) {
	// No. of pages listed in pagination
	const _listPages = user.s_listPages;
	// Number of tweets per page
	this.pageSize = user.s_pageSize;
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