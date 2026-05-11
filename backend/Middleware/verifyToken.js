const jwt = require('jsonwebtoken');

const verifyToken = (roles = []) => (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

    const token = authHeader.replace('Bearer ', '');

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        req.user = verified;

        // Check Roles if specified
        if (roles.length > 0 && !roles.includes(verified.role)) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
        }

        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid Token' });
    }
};

module.exports = verifyToken;
