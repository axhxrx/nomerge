// Authentication module
function login(username, password) {
  // TODO: Add proper password hashing
  // FIXME: This is insecure!
  return username === "admin" && password === "admin";
}

function logout() {
  // TODO: Clear session properly
  console.log("Logged out");
}

export { login, logout };
