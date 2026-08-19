const webpush = require('web-push');

const vapidPublicKey = 'YOUR_PUBLIC_KEY';   // paste from above
const vapidPrivateKey = 'YOUR_PRIVATE_KEY'; // paste from above
webpush.setVapidDetails('mailto:you@example.com', vapidPublicKey, vapidPrivateKey);

// In production, you'd store subscription from the client.
// For demo, we'll send to a fixed subscription.
// You need to collect subscription from the client side (browser).
// Here we just trigger a silent push to wake the SW.

module.exports = (req, res) => {
  // Send a push to all subscriptions (you'd have stored them)
  // For this demo, we'll assume you store them in a DB.
  res.status(200).send('Push sent');
};
