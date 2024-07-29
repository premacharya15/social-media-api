export default (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // MongoDB ID error
    if (err.name === "CastError") {
        res.status(400).json({
            success: false,
            message: `Resource Not Found. Invalid: ${err.path}`
        });
        return;
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        res.status(400).json({
            success: false,
            message: `${Object.keys(err.keyValue)} already exists`
        });
        return;
    }

    // Wrong JWT error
    if (err.name === "JsonWebTokenError") {
        res.status(400).json({
            success: false,
            message: 'JWT Error'
        });
        return;
    }

    // JWT expire error
    if (err.name === "TokenExpiredError") {
        res.status(400).json({
            success: false,
            message: 'JWT is Expired'
        });
        return;
    }

    // Default error response
    res.status(statusCode).json({
        success: false,
        message: message
    });
}