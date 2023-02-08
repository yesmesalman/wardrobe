const successResponse = (res, successMessage, data) => {
    return res.json({ success: true, message: successMessage, data });
}

const errorResponse = (res, errorMessage) => {
    return res.status(500).json({ success: false, message: errorMessage });
}

export { successResponse, errorResponse };