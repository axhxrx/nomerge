// API client
async function fetchData(endpoint) {
  // WIP: Need to add error handling
  const response = await fetch(endpoint);
  return response.json();
}

export { fetchData };
