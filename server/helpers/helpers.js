const successResponse = (res, message, data) => {
    return res.json({ success: true, message, data });
}

const errorResponse = (res, message) => {
    return res.status(400).json({ success: false, message });
}

const validationErrorResponse = (res, arr) => {
    return res.status(500).json({ success: false, message: arr[0].msg, data: arr });
}

export { successResponse, errorResponse, validationErrorResponse };