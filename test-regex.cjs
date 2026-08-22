const regex = /\b(sandbox|sbx|sbox|testbed|tstdrv|sb)\b/i;
console.log(regex.test('SB_GAP_Amazon S3')); // should be true but likely false
const fixedRegex = /(^|[^a-zA-Z0-9])(sandbox|sbx|sbox|testbed|tstdrv|sb)([^a-zA-Z0-9]|$)/i;
console.log(fixedRegex.test('SB_GAP_Amazon S3'));
