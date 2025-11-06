// A perfectly clean repository
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export { calculateTotal };
