const jwt = require('jsonwebtoken');
const config = require('config');

// Authenticate user
function auth(req, res, next) {
	const token = req.cookies.authToken;
	const forAPI = req.baseUrl.slice(0, 5) == '/api/';
	if (!token) {
		return forAPI ?
			res.status(401).send('Access denied. No token provided.') :
			res.redirect('/login');
	}
	
	try {
		const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
		req.user = decoded;
		next();
	}
	catch (ex) {
		res.status(400).send('Invalid token.');
	}
}

// Admin
function isAdmin1(req, res, next) {
	if (req.user.isAdmin != 2) return res.status(403).send('Admin access denied.');
	next();
}

// Super admin
function isAdmin2(req, res, next) {
	if (req.user.isAdmin != 2) return res.status(403).send('Super admin access denied.');
	next();
}

exports.auth = auth;
exports.isAdmin1 = isAdmin1;
exports.isAdmin2 = isAdmin2;