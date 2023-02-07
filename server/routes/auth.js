const express = require('express');
const router = express.Router();
const helpers = require('./../helpers/helpers');

router.get('/', (req, res) => {
  return helpers.successResponse(res, "Welcome", []);
});

router.get('/register-device', (req, res) => {
  return helpers.successResponse(res, "register device", req.body);
});

module.exports = router;