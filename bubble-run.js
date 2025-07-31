var verified = properties.param1;
var userId = properties.param2;
var timestamp = properties.param3;
var receivedHash = properties.param4;

// Debug logging
console.log("Input params:", {
  verified: verified,
  userId: userId,
  timestamp: timestamp,
  receivedHash: receivedHash,
});

// Recreate the hash to validate
var hashData =
  verified + ":" + userId + ":" + timestamp + ":dreampress_secret_2024";
console.log("Hash data string:", hashData);

var expectedHash = btoa(hashData)
  .replace(/[^a-zA-Z0-9]/g, "")
  .substring(0, 16);

// Check if hash matches and timestamp is recent (within 5 minutes)
var currentTime = Date.now();
var timeDiff = currentTime - parseInt(timestamp);
var isRecent = timeDiff < 300000; // 5 minutes in milliseconds

console.log("Hash comparison:", {
  receivedHash: receivedHash,
  expectedHash: expectedHash,
  matches: receivedHash === expectedHash,
});
console.log("Time check:", {
  currentTime: currentTime,
  timestamp: timestamp,
  timeDiff: timeDiff,
  isRecent: isRecent,
});

// Check THREE things: hash valid, time recent, AND verification successful
if (receivedHash === expectedHash && isRecent && verified === 'true') {
  console.log("Hash verification PASSED and age verified");
  bubble_fn_age("true");
} else {
  console.log("Hash verification FAILED or age not verified. Verified:", verified);
  bubble_fn_age("false");
}
