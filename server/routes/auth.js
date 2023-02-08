import { Router } from 'express';
const router = Router();
import { successResponse } from './../helpers/helpers.js';
import Device from './../models/Device.js';

router.post('/', (req, res) => {
  return successResponse(res, "Welcome", []);
});

router.post('/register-device', async (req, res) => {
  // const devices = await Device.findAll();
  // console.log("devices", devices)

  return successResponse(res, "register device", req.body);
});

export default router;