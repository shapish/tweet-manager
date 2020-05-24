// Modules
const express = require('express');
const router = express.Router();

// Models
const Label = require('../models/label');
const { User } = require('../models/user');

// Middleware & functions
const {auth} = require('../middleware/auth');




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
	res.render('login', { page: 'login' });
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