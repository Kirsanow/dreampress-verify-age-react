import { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import Logo from "./Logo";

export default function AgeVerification({ onComplete, enableRedirect = false }) {
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [livenessCheck, setLivenessCheck] = useState(false);
  const [livenessStep, setLivenessStep] = useState(0);
  const [baseFaceDescriptor, setBaseFaceDescriptor] = useState(null);
  const [lastDetection, setLastDetection] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadModels();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  const loadModels = async () => {
    setStatus("Loading AI models...");
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(`${import.meta.env.BASE_URL}models`),
        faceapi.nets.ageGenderNet.loadFromUri(`${import.meta.env.BASE_URL}models`),
        faceapi.nets.faceRecognitionNet.loadFromUri(`${import.meta.env.BASE_URL}models`),
        faceapi.nets.faceLandmark68Net.loadFromUri(`${import.meta.env.BASE_URL}models`),
      ]);
      setModelsLoaded(true);
      setStatus("Ready for verification");
    } catch (error) {
      console.error("Error loading models:", error);
      setStatus("Failed to load AI models");
    }
  };

  const drawFaceOverlay = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const displaySize = { 
      width: videoRef.current.videoWidth, 
      height: videoRef.current.videoHeight 
    };
    
    // Match canvas size to video
    faceapi.matchDimensions(canvasRef.current, displaySize);
    
    const detections = await faceapi
      .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();
    
    // Clear previous drawings
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    let currentDetection = null;
    
    if (detections.length > 0) {
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      currentDetection = resizedDetections[0].detection.box;
      setLastDetection(currentDetection);
    }
    
    // Use current detection or last known good detection to reduce blinking
    const detectionToUse = currentDetection || lastDetection;
    
    if (detectionToUse) {
      // Get face bounding box
      const box = detectionToUse;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const radius = Math.max(box.width, box.height) / 2 + 20;
      
      // Draw face circle with smooth appearance
      ctx.strokeStyle = currentDetection ? '#4ADE80' : '#10B981';
      ctx.lineWidth = 3;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Draw corner markers
      const markerLength = 30;
      ctx.lineWidth = 4;
      
      // Top-left
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY - radius + markerLength);
      ctx.lineTo(centerX - radius, centerY - radius);
      ctx.lineTo(centerX - radius + markerLength, centerY - radius);
      ctx.stroke();
      
      // Top-right
      ctx.beginPath();
      ctx.moveTo(centerX + radius - markerLength, centerY - radius);
      ctx.lineTo(centerX + radius, centerY - radius);
      ctx.lineTo(centerX + radius, centerY - radius + markerLength);
      ctx.stroke();
      
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY + radius - markerLength);
      ctx.lineTo(centerX - radius, centerY + radius);
      ctx.lineTo(centerX - radius + markerLength, centerY + radius);
      ctx.stroke();
      
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(centerX + radius - markerLength, centerY + radius);
      ctx.lineTo(centerX + radius, centerY + radius);
      ctx.lineTo(centerX + radius, centerY + radius - markerLength);
      ctx.stroke();
    } else {
      // Draw guide circle when no face detected
      const centerX = canvasRef.current.width / 2;
      const centerY = canvasRef.current.height / 2;
      const radius = Math.min(canvasRef.current.width, canvasRef.current.height) / 3;
      
      ctx.strokeStyle = '#6B7280';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const startCamera = async () => {
    console.log("startCamera called, modelsLoaded:", modelsLoaded);
    if (!modelsLoaded) {
      console.log("Models not loaded yet");
      return;
    }

    setIsLoading(true);
    setStatus("Starting camera...");

    try {
      console.log("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
        },
      });
      console.log("Camera stream obtained:", stream);

      // Show camera UI first, then set up the video
      setShowCamera(true);
      setStatus("Setting up camera...");

      // Wait a bit for React to render the video element
      setTimeout(async () => {
        if (videoRef.current) {
          console.log("Video element found, setting srcObject");
          videoRef.current.srcObject = stream;

          console.log("Starting video playback...");
          await videoRef.current.play();
          console.log("Video play() completed");

          setStatus("Position your face in the camera");
          console.log("Camera started and UI updated");
          
          // Start face detection overlay with reduced frequency to prevent blinking
          intervalRef.current = setInterval(() => {
            drawFaceOverlay();
          }, 200);
        } else {
          console.error("Video ref is still null after timeout");
          setStatus("Video element not found");
        }
        setIsLoading(false);
      }, 100);
    } catch (error) {
      console.error("Camera access error:", error);
      setStatus(`Camera error: ${error.message}`);
      setIsLoading(false);
    }
  };

  const livenessSteps = [
    "Look straight at the camera",
    "Look to your left", 
    "Look to your right",
    "Look straight again"
  ];

  const detectHeadPosition = (landmarks) => {
    try {
      // Use nose tip and face outline points to determine head orientation
      const noseTip = landmarks.getNose()[3]; // Center bottom of nose
      const leftFace = landmarks.getJawOutline()[0]; // Left edge of face
      const rightFace = landmarks.getJawOutline()[16]; // Right edge of face
      
      // Calculate ratios to determine head position
      const faceWidth = rightFace.x - leftFace.x;
      const noseToLeft = noseTip.x - leftFace.x;
      const noseToRight = rightFace.x - noseTip.x;
      
      const leftRatio = noseToLeft / faceWidth;
      const rightRatio = noseToRight / faceWidth;
      
      console.log(`Head detection - leftRatio: ${leftRatio.toFixed(2)}, rightRatio: ${rightRatio.toFixed(2)}`);
      
      // Much more lenient thresholds for mobile-friendly detection
      // Detection works on original stream (mirrored), but display is unmirrored for UX
      console.log(`Face width: ${faceWidth}, noseToLeft: ${noseToLeft}, noseToRight: ${noseToRight}`);
      
      if (leftRatio < 0.2) {
        return "right"; // Nose closer to left edge means head turned right (in mirrored coordinates)
      } else if (rightRatio < 0.2) {
        return "left"; // Nose closer to right edge means head turned left (in mirrored coordinates)  
      } else {
        return "straight"; // Nose roughly centered
      }
    } catch (error) {
      console.error("Error detecting head position:", error);
      return "straight"; // Default to straight if detection fails
    }
  };

  const performLivenessCheck = async () => {
    if (!videoRef.current || !modelsLoaded) return false;

    setLivenessCheck(true);
    setLivenessStep(0);
    setStatus(livenessSteps[0]);

    try {
      // Get initial face detection with descriptor
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setStatus("No face detected for liveness check");
        return false;
      }

      const initialDescriptor = detections[0].descriptor;
      setBaseFaceDescriptor(initialDescriptor);

      // Perform liveness steps with actual head movement detection
      for (let step = 1; step < livenessSteps.length; step++) {
        setLivenessStep(step);
        setStatus(livenessSteps[step]);
        
        // Expected head positions for each step
        const expectedPositions = ["straight", "left", "right", "straight"];
        const expectedPosition = expectedPositions[step];
        
        // Wait for user to move and then verify multiple times
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let correctPositionCount = 0;
        const requiredCorrectCount = 2; // Need 2 consecutive correct detections (more forgiving)
        
        // Check head position multiple times with more tolerance
        let faceNotFoundCount = 0;
        const maxFaceNotFoundCount = 3; // Allow 3 failed detections out of 6 (more forgiving)
        
        for (let check = 0; check < 6; check++) {
          const currentDetections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.2 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (currentDetections.length === 0) {
            faceNotFoundCount++;
            console.log(`Face not detected, attempt ${check + 1}/5, failed count: ${faceNotFoundCount}`);
            
            // If too many failures, return error
            if (faceNotFoundCount > maxFaceNotFoundCount) {
              setStatus("Face lost during liveness check. Please keep your face in view and try again.");
              return false;
            }
            
            // Wait and continue to next check
            await new Promise(resolve => setTimeout(resolve, 400));
            continue;
          }

          // Check face consistency (same person) - more tolerant during head movements
          const currentDescriptor = currentDetections[0].descriptor;
          const distance = faceapi.euclideanDistance(initialDescriptor, currentDescriptor);
          
          if (distance > 0.9) { // Very lenient threshold for mobile head movements
            setStatus("Different face detected - liveness check failed");
            return false;
          }

          // Check head position
          const landmarks = currentDetections[0].landmarks;
          const detectedPosition = detectHeadPosition(landmarks);
          
          console.log(`Step ${step}: Expected ${expectedPosition}, Detected ${detectedPosition}, Count: ${correctPositionCount}`);
          
          if (detectedPosition === expectedPosition) {
            correctPositionCount++;
            console.log(`✓ Correct position detected! Count now: ${correctPositionCount}`);
          } else {
            // Don't penalize wrong positions as harshly on mobile
            console.log(`✗ Wrong position. Expected ${expectedPosition}, got ${detectedPosition}`);
          }
          
          // Wait between checks
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        // Check if user followed the instruction correctly with more tolerance
        if (correctPositionCount < requiredCorrectCount) {
          setStatus(`Please follow the instruction: ${livenessSteps[step]}. Try again.`);
          await new Promise(resolve => setTimeout(resolve, 1500)); // Shorter wait time
          step--; // Retry this step
          continue;
        }
        
        setStatus(`Good! Now ${step < livenessSteps.length - 1 ? livenessSteps[step + 1] : 'completing verification...'}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setStatus("Liveness check passed! Analyzing age...");
      return true;
    } catch (error) {
      console.error("Liveness check error:", error);
      setStatus("Liveness check failed");
      return false;
    }
  };

  const verifyAge = async () => {
    if (!videoRef.current || !modelsLoaded) return;

    setIsLoading(true);
    
    // Perform liveness check first
    const livenessPass = await performLivenessCheck();
    if (!livenessPass) {
      setIsLoading(false);
      setLivenessCheck(false);
      return;
    }

    setStatus("Analyzing your age...");

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withAgeAndGender();

      if (detections.length === 0) {
        setStatus(
          "No face detected. Please position yourself clearly in the camera."
        );
        setIsLoading(false);
        return;
      }

      const detection = detections[0];
      const estimatedAge = Math.round(detection.age);
      const isOver18 = estimatedAge >= 18;

      setVerificationResult({
        age: estimatedAge,
        verified: isOver18,
      });

      setStatus(
        isOver18
          ? `Verification successful! Estimated age: ${estimatedAge}`
          : `Access denied. Estimated age: ${estimatedAge}`
      );

      // Stop camera and overlay
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }

      setShowCamera(false);
      setLivenessCheck(false);

      // Complete verification after delay
      setTimeout(() => {
        if (enableRedirect) {
          onComplete(isOver18.toString());
        } else {
          console.log("Redirect disabled. Verification result:", isOver18 ? "verified" : "denied");
          // Just keep the result visible for testing
        }
      }, 2000);
    } catch (error) {
      console.error("Age verification error:", error);
      setStatus("Verification failed. Please try again.");
      setLivenessCheck(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 gradient-bg">
      {/* Background gradient orbs */}
      <div className="gradient-orb-1"></div>
      <div className="gradient-orb-2"></div>
      <div className="gradient-orb-3"></div>

      <div className="relative z-10 w-full max-w-md text-center brand-card">
        <div className="brand-card-inner">
          <Logo className="mx-auto mb-6" />
          <h1 className="mb-2 text-2xl font-black tracking-tight text-white">
            Age Verification
          </h1>

          {!showCamera && !verificationResult && (
            <div className="flex flex-col items-center space-y-8">
              <p className="text-sm text-gray-300">
                We need to verify that you are 18 or older
              </p>

              <button
                onClick={startCamera}
                disabled={!modelsLoaded || isLoading}
                className="mx-auto btn-primary"
              >
                {isLoading ? "Loading..." : "Start Age Verification"}
              </button>
            </div>
          )}

          {showCamera && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="object-cover w-full h-64 bg-black/50"
                  style={{ transform: "scaleX(-1)" }}
                />
                
                {/* Hidden canvas for face detection */}
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
                />
                
                {/* Static professional face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="face-guide-container">
                    {/* Main face oval */}
                    <div className="face-guide-oval">
                      <div className="face-guide-border"></div>
                    </div>
                    
                    {/* Center positioning dot */}
                    <div className="face-guide-center"></div>
                  </div>
                </div>
              </div>

              <button
                onClick={verifyAge}
                disabled={isLoading || livenessCheck}
                className="mx-auto btn-primary"
              >
                {isLoading ? "Analyzing..." : livenessCheck ? "Follow Instructions..." : "Verify My Age"}
              </button>
              
              {livenessCheck && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
                  <div className="text-blue-400 font-medium">
                    Liveness Check - Step {livenessStep + 1} of {livenessSteps.length}
                  </div>
                  <div className="mt-2 text-sm text-blue-300">
                    Follow the instructions and keep your face in view
                  </div>
                </div>
              )}
            </div>
          )}

          {verificationResult && (
            <div
              className={`p-6 rounded-2xl ${
                verificationResult.verified
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <h2
                className={`text-lg font-semibold ${
                  verificationResult.verified
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {verificationResult.verified
                  ? "Verification Successful"
                  : "Access Denied"}
              </h2>
              <p className="mt-2 text-gray-400">
                Estimated age: {verificationResult.age} years
              </p>
            </div>
          )}

          <p className="mt-4 text-sm text-gray-400">{status}</p>
        </div>
      </div>
    </div>
  );
}
