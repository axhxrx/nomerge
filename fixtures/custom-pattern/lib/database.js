// Database module
function connect() {
  // DONOTMERGE: Using test database
  const db = connectToDatabase("test-db");
  return db;
}

function query(sql) {
  // DONOTMERGE: Add SQL injection protection
  return executeQuery(sql);
}

export { connect, query };
