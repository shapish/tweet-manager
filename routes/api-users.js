const { auth, isAdmin2 } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const _ = require('lodash');
const { User, validate } = require('../models/user');
const express = require('express');
const router = express.Router();


// Create new user
router.post('/', async (req, res) => {

	// Validate input format
	const { error } = validate(req.body);
	if (error) {
		let errorList = {};
		for (let i in error.details) {
			const path = error.details[i].path[0];
			const message = error.details[i].message;
			errorList[path] = message;
		}
		res.status(400).send(errorList);
		return;
	}

	// Look up user by email
	let user = await User.findOne({ email: req.body.email });
	if (user) return res.status(400).send('Duplicate');
	
	// Create new user record
	user = new User(_.pick(req.body, ['name', 'email', 'password', 'isAdmin']));
	
	// Encrypt password
	const salt = await bcrypt.genSalt(10);
	user.password = await bcrypt.hash(user.password, salt);
	
	// Save new user
	await user.save();

	// Add authorization token to response header to recognize user on next visit
	const token = user.generateAuthToken();
	res.cookie('authToken', token);
	
	res.send(_.pick(user, ['_id', 'name', 'email', 'isAdmin']));
});


// Edit user info
router.put('/', auth, async (req, res) => {

	// Validate input format
	const { error } = validate(req.body);
	if (error) {
		let errorList = {};
		for (let i in error.details) {
			const path = error.details[i].path[0];
			const message = error.details[i].message;
			errorList[path] = message;
		}
		res.status(400).send(errorList);
		return;
	}

	// Encrypt password
	const salt = await bcrypt.genSalt(10);
	const password = await bcrypt.hash(req.body.password, salt);

	// Look up user by email
	let user = await User.findOneAndUpdate({ email: req.body.email }, {
		name: req.body.name,
		password: password
	});
	
	// Add authorization token to response header to recognize user on next visit
	const token = user.generateAuthToken();
	res.cookie('authToken', token);
	
	res.send(_.pick(user, ['_id', 'name', 'email', 'isAdmin']));
});


// Delete user
router.delete('/:id', [auth, isAdmin2], async (req, res) => {
	const user = await User.findByIdAndDelete(req.params.id);
	if (!user) return res.status(404).send(`There's no user with id "${req.params.id}"`); // 404
	res.send(user);
});


module.exports = router;