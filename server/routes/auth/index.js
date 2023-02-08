import { Router } from 'express';
const router = Router();
import { registerDeviceValidation, registerDevice } from './devices.js';

router.post('/register-device', registerDeviceValidation, registerDevice);

export default router;