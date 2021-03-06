// Modules
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('config');

// Models
const Label = require('../models/label');
const { User } = require('../models/user');

// Middleware & functions
const {auth} = require('../middleware/auth');
const scrapeControl = new (require('../scraper/scrape-control'))();

// (async function x() {
// 	const { scrapingLatest, findMissing } = await scrapeControl.get();
// 	console.log(scrapingLatest, Boolean(scrapingLatest), scrapingLatest === true)
// })();


// Landing -> Search
router.get('/', auth, (req, res) => { res.redirect('/search') });



// Overview
router.get('/overview', auth, async (req, res) => {
	res.render('overview', {
		user: req.user
	});
});



// Labels
router.get('/labels', auth, async (req, res) => {
	
	let labels = await Label.find().sort('value -count');
	return res.render('labels', {
		labels: labels,
		user: req.user
	});

});



// Users
router.get('/users', auth, async (req, res) => {
	if (!req.user.isAdmin) {
		return res.redirect('/');
	}
	
	const users = await User.find().sort('name').select('name email');
	res.render('users', {
		page: 'users',
		user: req.user,
		users: users
	});
});



// Seeder
router.get('/seed', auth, async (req, res) => {
	const { seeding, extracting, transferring } = await scrapeControl.get();
	res.render('seed', {
		seeding: seeding,
		extracting: extracting,
		transferring: transferring,
		user: req.user
	});
});



// Scraper
router.get('/scrape', auth, async (req, res) => {
	const { scrapingLatest, fillingMissing } = await scrapeControl.get();
	res.render('scrape', {
		scrapingLatest: scrapingLatest,
		fillingMissing: fillingMissing,
		user: req.user
	});
});



// Me
router.get('/me', auth, async (req, res) => {
	const user = await User.findById(req.user._id).select('-password');
	console.log(req.user)
	res.render('me', {
		user: req.user,
		me: user
	});
});




// Login
router.get('/login', async (req, res) => {
	const token = req.cookies.authToken;
	if (token) {
		const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
		if (decoded) res.redirect('/search');
	} else {
		res.render('login', { page: 'login' });
	}
});



// Signup
router.get('/signup', async (req, res) => {
	res.render('login', { page: 'signup' });
});


// Logout
router.get('/logout', async (req, res) => {
	res.cookie('authToken', '');
	res.redirect('/login');
});

module.exports = router;