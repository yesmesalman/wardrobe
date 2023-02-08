import { successResponse, errorResponse, validationErrorResponse } from './../../helpers/helpers.js';
import Device from './../../models/Device.js';
import { check, validationResult } from 'express-validator';

const registerDeviceValidation = [
    check('uniqueId').isLength({ min: 5 }).withMessage("device unique ID is required")
];

const registerDevice = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return validationErrorResponse(res, errors.array());
        }

        const body = req.body
        var device = await Device.findOne({ where: { uniqueId: body.uniqueId } });

        if (device) {
            device = await device.update({ ...body });
        } else {
            device = await Device.create({ ...body });
        }

        return successResponse(res, "register device", {});

    } catch (e) {
        return errorResponse(res, e);
    }
}

export {
    registerDeviceValidation, registerDevice
}