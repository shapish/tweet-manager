const config = require('config');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Joi = require('@hapi/joi');

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlength: 3,
		maxlength: 50
	},
	path: {
		type: String,
		required: true,
		minlength: 3,
		maxlength: 50
	},
	username: {
		type: String,
		required: true,
		minlength: 3,
		maxlength: 50
	},
	email: {
		type: String,
		required: true,
		minlength: 3,
		maxlength: 200,
		unique: true
	},
	password: {
		type: String,
		required: true,
		minlength: 6,
		maxlength: 1024
	},
	isAdmin: {
		type: Number,
		default: 0
	},
	s_showLabels: {
		type: Boolean,
		default: true
	},
	s_showMeta: {
		type: Boolean,
		default: false
	},
	s_clipTweets: {
		type: Boolean,
		default: false
	},
	s_pageSize: {
		type: Number,
		default: 10
	},
	s_listPages: {
		type: Number,
		default: 30
	}
});

userSchema.methods.generateAuthToken = function() {
	return jwt.sign({
		_id: this._id,
		isAdmin: this.isAdmin
	}, config.get('jwtPrivateKey'));
};

const User = mongoose.model('User', userSchema);

function validateUser(user) {
	const schema = Joi.object({
		name: Joi.string().min(3).max(50).required().messages(joiMsg(3,50)),
		email: Joi.string().min(3).max(200).required().email().messages(joiMsg(3,200)),
		password: Joi.string().min(6).max(1024).required().messages(joiMsg(6,1024))
	});
	return schema.validate(user, { abortEarly: false });
}

function joiMsg(min, max) {
	return {
		'string.base': 'Invalid format', // The input is not a string
		'string.email': 'Invalid email', // The input is not an email
		'string.empty': 'Required', // The input is empty (null)
		'any.required': 'Required', // The input it missing (undefined)
		'string.min': `Min. ${min} characters`,
		'string.max': `Max. ${max} characters`
	}
}


exports.User = User;
exports.validate = validateUser;
exports.joiMsg = joiMsg;