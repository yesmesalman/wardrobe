const express = require('express');
const router = express.Router();
const helpers = require('./../helpers/helpers');

router.post('/', (req, res) => {
  return helpers.successResponse(res, "Welcome", []);
});

router.post('/register-device', (req, res) => {
  return helpers.successResponse(res, "register device", req.body);
});

module.exports = router;