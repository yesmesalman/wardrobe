const express = require('express');
const router = express.Router();
const helpers = require('./../helpers/helpers');

router.get('/', (req, res) => {
  return helpers.successResponse(res, "Welcome", []);
});

module.exports = router;