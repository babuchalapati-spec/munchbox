function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  const status = err.status || (res.statusCode !== 200 ? res.statusCode : 500);
  res.status(status).json({
    message: err.message || 'Server error',
  });
}

module.exports = { notFound, errorHandler };
