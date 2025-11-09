// Edge case tests
function test1() {
  // Pattern at end of line nomerge
  return 1;
}

function test2() {
  /* Multi-line comment with
     nomerge in the middle
     of the comment */
  return 2;
}

function test3() {
  const str = "this string contains nomerge as part of text";
  return str;
}

// nomerge at start of line
function test4() {
  return 4;
}
