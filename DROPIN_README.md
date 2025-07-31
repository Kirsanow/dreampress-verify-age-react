# Age Estimator Drop-in Script

The easiest way to add age verification to your website. Just add a single script tag and let the age estimator handle the rest.

## Quick Start

Add this line to the `<head>` section of any page that requires age verification:

```html
<script src="https://cdn.jsdelivr.net/npm/age-estimator@latest/build/dropin.min.js"></script>
```

That's it! The age estimator will automatically:
1. Check if the user has already verified their age
2. If not, show a beautiful age verification overlay
3. Guide the user through the facial age estimation process
4. Remember the user's verified age for future visits

## Configuration

You can customize the age estimator by adding a configuration object before the script tag:

```html
<script>
window.uvaeConfig = {
    cacheDuration: 3600000,  // Cache duration in milliseconds (default: 24 hours)
    minAge: 21,              // Minimum age required (default: 18)
    primaryColor: '#dc2626', // Primary color for buttons and icons (default: '#2463eb')
    zIndex: '100' .          // z-index of the overlay (default: '9999999')
};
</script>
<script src="https://cdn.jsdelivr.net/npm/age-estimator@latest/build/dropin.min.js"></script>
```

## Features

- **Privacy-Focused**: All processing happens locally on the user's device
- **No Server Required**: No backend setup needed
- **Liveness Detection**: Prevents spoofing attempts using photos
- **Automatic Caching**: Remembers verified users for 24 hours (configurable)
- **Responsive Design**: Works on all devices and screen sizes with a camera
- **Customizable**: Match your website's color palette
- **Lightweight**: Only ~9KB minified

## How It Works

1. When a user visits your page, the script checks for a cached age verification
2. If no valid signed verification token exists, a glass overlay appears blocking access to the content
3. The user clicks "Verify Age" to start the process
4. The age estimator opens in a new tab and guides the user through facial age estimation
5. If the user's estimated age meets your minimum requirement, they're granted access
6. The verification is cached for 24 hours to avoid repeated checks

## Security Features

- **Liveness Detection**: Requires a liveness detection to prevent users from using photos to verify age
- **Signed Verification Tokens**: Users can't just edit their local storage to bypass the age gate

Note: As this tool runs entirely on the frontend, it can be bypassed by any engineer who wants to put in the time and effort. However, the purpose of this is to be an easy drop in solution to prevent those who are underage from accessing restricted content, not a hacking challenge for engineers. Additionally there's an argument to be made on if websites are liable for people that locally modify the website to bypass age-gates. I can put boobs on google by modifying the web content locally, doesn't mean google is liable for those actions of mine. I am not a lawyer though, so don't take this as legal advice. In fact my recommendation is to use a proper identity verification service, but at least this script is free and easy to start off with

## Browser Support

Works in all modern browsers

## Privacy

- No data is ever sent to any servers
- All processing happens in the user's browser
- No personal information is stored
- Only the estimated age is shared with your website

## Legal Notice

This age estimator provides a basic level of age verification through facial analysis. While it offers more security than a simple checkbox, it should not be considered a replacement for proper ID validation. For applications requiring verified age confirmation, not just an estimation, we recommend using a comprehensive identity verification solution like [Universal Verify](https://universalverify.com).

## Support

Found a bug or have a feature request? [Open an issue](https://github.com/universal-verify/age-estimator/issues) on GitHub.