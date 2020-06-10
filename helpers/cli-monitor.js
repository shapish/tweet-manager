/**
 * Super light weight console monitoring tool
 * Useful when batching processes, eg. scraping
 * - - -
 * (c) 2020 Moenen Erbuer, released under MIT license
 * https://opensource.org/licenses/MIT
 * v1.0.0
 * - - -
 * 
 * Usage:
 * const monitor = require('./cli-monitor') // node.js
 * const monitor = new Monitor() // browser
 * 
 * monitor.banner('Start')				--> Big fat banner, eg to start/end process / takes mandatory text + optional top + bottom gap (or -1 reverses defaults for footer)
 * monitor.title('Hello world!', 3);	--> Padded title / takes mandatory string + optional custom bottom gap (default: 0)
 * monitor.log('Hello, world', 2)	--> regular console.log / takes optional gap
 * monitor.wait('pom pom');				--> Show animated "waiting..." / takes optional custom string
 * monitor.progress(66,200, 100);	--> Display progress bar / takes mandatory completes + total number + optional width (default: 300px)
 * monitor.gap(10);						--> Displays gap / takes optional custom gap size (default: 5)
 * 
 * All strings take optional color method: monitor.banner('Start'.red)
 * 
 */





// https://www.npmjs.com/package/colors
var colors = require('colors');

function Monitor() {
	this.hc();
}


// Display big fat banner of process
Monitor.prototype.banner = function(text, gapT, gapB) {
	const reverseGaps = gapT == -1;
	gapT = gapT ? gapT : '\n'.repeat(reverseGaps ? 2 : 4);
	gapB = gapB ? gapB : '\n'.repeat(reverseGaps ? 4 : 2);
	const pad = '-'.repeat(10);
	const str =  pad + ' ' + text + ' ' + pad;
	const filler = '-'.repeat(str.length);
	const result = [gapT,filler,str,filler,gapB].join('\n');
	process.stdout.write(result);
}


// Display title
Monitor.prototype.title = function(text, gapT, gapB) {
	gapT = gapT || gapT === 0 ? gapT : 2;
	gapB = gapB || gapT === 0 ? gapB : 0;
	process.stdout.write('\n'.repeat(gapT) + '--- ' + text + ' ---\n' + '\n'.repeat(gapB));
}


// Display text
Monitor.prototype.log = function(text, gap) {
	gap = gap ? gap : 0;
	console.log(text + '\n'.repeat(gap));
}


// Display gap
Monitor.prototype.gap = function(size) {
	size = size ? size : 5;
	process.stdout.write('\n'.repeat(size));
}


// Display animated "waiting..."
Monitor.prototype.wait = function(msg) {
	if (msg === false) {
		// OFF
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		clearInterval(this.waitIv);
		return;
	} else {
		msg = msg ? msg : 'waiting';
	}
	
	let i = 0;
	this.waitIv = setInterval(_loop.bind(this), 400);

	function _loop() {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		i = (i + 1) % 4;
		var dots = new Array(i + 1).join('.');
		process.stdout.write(msg + dots);
	}
};


// Display status (%)
Monitor.prototype.progress = function(done, total, width) {
	width = width ? width : 300;
	const pct = Math.round(done / total * 100);
	const pctExact = done / total * 100;
	const complete = '\u2588';
	// const incomplete = '\u2591'; // Characters creating bar
	// const complete = '|';
	const incomplete = '_'; // Characters creating bar
	const wrap = '|';

	// Calculate bar width (43 characters = 300px)
	const totalChars = Math.round((width / 300) * 43);
	const completeChars = Math.round(pctExact * (totalChars / 100));
	const incompleteChars = totalChars - completeChars;
	// console.log(width, incompleteChars, completeChars, totalChars)

	// Display progress bar
	const str = `${this.prettyNr(done)} / ${this.prettyNr(total)}`;
	const pctStr = `${pct}%`;
	const gap = (totalChars - str.length - pctStr.length); // Right align numbers
	process.stdout.write(`\n${pctStr}${' '.repeat(gap)}${str}\n`); // Text
	process.stdout.write(`${wrap}${complete.repeat(completeChars)}${incomplete.repeat(incompleteChars)}${wrap}\n\n`); // Bar
}


// Hide cursor
Monitor.prototype.hc = function() {
	process.stderr.write('\x1B[?25l');
};


// Show cursor
Monitor.prototype.sc = function() {
	process.stderr.write('\x1B[?25h');
};

// Make numbers pretty --> 35,446
Monitor.prototype.prettyNr = function(nr) {
	return nr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = new Monitor();