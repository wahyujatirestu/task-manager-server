const routeNotFound = (req, res, next) => {
    const error = new Error(`Route not found: ${req.originalUrl}`);
    res.status(404);
    next(error);
};

const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;

    // Prisma-specific error handling
    if (err.code === 'P2025') {
        // Prisma error code for "Record not found"
        statusCode = 404;
        message = 'Resource not found';
    } else if (err.code === 'P2002') {
        // Prisma error code for "Unique constraint failed"
        statusCode = 409; // Conflict
        message = 'Duplicate field value entered';
    }

    res.status(statusCode).json({
        message: message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export { routeNotFound, errorHandler };
