const paymentHandler = require('./payment');

module.exports = async (req, res) => {
  return paymentHandler(req, res);
};
