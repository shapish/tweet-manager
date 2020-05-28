// Modules
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const _ = require('lodash');
const Joi = require('@hapi/joi');

// Models
const { User, joiMsg } = require('../models/user');

// Middleware & functions
const {auth} = require('../middleware/auth');
const {cookieDate} = require('../functions/general');

// New login
router.post('/', async (req, res) => {
	console.log('login');
	const { error } = validate(req.body);
	if (error) {
		let errorList = {};
		for (let i in error.details) {
			const path = error.details[i].path[0];
			const message = error.details[i].message;
			errorList[path] = message;
		}
		console.log(errorList)
		res.status(400).send(errorList);
		return;
	}

	// Verify if email exists
	let user = await User.findOne({ email: req.body.email});
	if (!user) return res.status(400).send('Invalid email or password.');

	// Verify password
	const validPassword = await bcrypt.compare(req.body.password, user.password);
	if (!validPassword) return res.status(400).send('Invalid email or password.');

	// Generate authorization token
	const token = user.generateAuthToken();

	res.cookie('authToken', token, { expires: cookieDate() });
	res.send({ token: token });
});

function validate(user) {
	const schema = Joi.object({
		email: Joi.string().min(3).max(200).required().email().messages(joiMsg(3,200)),
		password: Joi.string().min(6).max(1024).required().messages(joiMsg(6, 1024))
	});
	return schema.validate(user, { abortEarly: false });
}

module.exports = router;