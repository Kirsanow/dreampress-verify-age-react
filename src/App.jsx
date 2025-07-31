import { useState, useEffect } from "react";
import AgeVerification from "./components/AgeVerification";
import Loading from "./components/Loading";
import "./App.css";

function App() {
  const [isUKUser, setIsUKUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [userId, setUserId] = useState("");
  
  // Feature flag for enabling redirects (set to false for testing)
  const [enableRedirect, setEnableRedirect] = useState(false);

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const callback = urlParams.get("callback_url");
    const user = urlParams.get("user_id");
    const redirect = urlParams.get("enable_redirect");

    if (callback) setCallbackUrl(decodeURIComponent(callback));
    if (user) setUserId(user);
    
    // Enable redirect if URL parameter is set or if callback URL exists
    if (redirect === "true" || callback) {
      setEnableRedirect(true);
    }

    // Check if user is in UK
    // checkGeolocation();
  }, []);

  const checkGeolocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      // setIsUKUser(data.country_code === 'GB')
      setIsUKUser(true);
    } catch (error) {
      console.error("Geolocation check failed:", error);
      setIsUKUser(false);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationComplete = (verified) => {
    if (callbackUrl) {
      // Create redirect URL with verification result
      const url = new URL(callbackUrl);
      url.searchParams.set("verified", verified);
      url.searchParams.set("timestamp", Date.now());

      if (userId) {
        url.searchParams.set("user_id", userId);
      }

      // Generate hash for security
      const dataToHash = `${verified}-${Date.now()}-${userId || ""}`;
      const hash = btoa(dataToHash)
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 16);
      url.searchParams.set("hash", hash);

      // Store verification result
      sessionStorage.setItem("age_verified", verified);
      sessionStorage.setItem("verification_timestamp", Date.now().toString());

      // Redirect back to Bubble app
      window.location.href = url.toString();
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!isUKUser) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 gradient-bg">
        <div className="gradient-orb-1"></div>
        <div className="gradient-orb-2"></div>
        <div className="gradient-orb-3"></div>
        <div className="brand-card max-w-md text-center relative z-10">
          <div className="brand-card-inner">
          <h1 className="mb-4 text-xl text-white">Access Restricted</h1>
          <p className="text-gray-300">
            This age verification service is only available for users in the
            United Kingdom.
          </p>
          </div>
        </div>
      </div>
    );
  }

  return <AgeVerification onComplete={handleVerificationComplete} enableRedirect={enableRedirect} />;
}

export default App;
