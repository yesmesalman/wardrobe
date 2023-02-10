class Global {
  static BASE_URL = "http://127.0.0.1:3000";

  static apiRequest(path, body) {
    return fetch(`${Global.BASE_URL}/api/${path}`, {
      method: "POST",
      body: body,
    });
  }
}

export default Global;