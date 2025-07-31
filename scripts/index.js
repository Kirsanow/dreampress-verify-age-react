import init, { sign } from '../wasm/local_signer.js';
//import disableDevtool from 'https://cdn.jsdelivr.net/npm/disable-devtool@0.3.8/+esm';

class Main {
    constructor() {
        init();
        this.intro = document.getElementById('intro');
        this.consentForm = document.getElementById('consent-form');
        this.loadingSection = document.getElementById('loading-section');
        this.webcamSection = document.getElementById('webcam-section');
        this.videoElement = document.getElementById('webcam');
        this.stream = null;
        this._parentWillTakeControl = false;
        this.loadModels();

        this.initializeEventListeners();
        this.setupPostMessageListeners();
    }

    async initializeEventListeners() {
        if (this.consentForm) {
            this.consentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const consentCheckbox = document.getElementById('biometric-consent');
                if (consentCheckbox.checked) {
                    this.requestWebcamAccess();
                }
            });
        }

        // Add try again button listener
        const tryAgainBtn = document.querySelector('.try-again-btn');
        if (tryAgainBtn) {
            tryAgainBtn.addEventListener('click', () => {
                document.getElementById('results-section').style.display = 'none';
                this.requestWebcamAccess();
            });
        }
    }

    setupPostMessageListeners() {
        if(window.opener) {
            window.addEventListener('message', (event) => {
                if(event.data.type === 'confirm-parent-commandeer') {
                    this._nonce = event.data.nonce;
                    this._parentWillTakeControl = true;
                    this._livenessCheck = event.data.livenessCheck;
                    this._openerOrigin = event.data.origin;
                    if(this._livenessCheck) {
                        this.promises = Promise.all([
                            this.promises,
                            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
                        ]);
                    }
                    this._cacheDuration = event.data.cacheDuration || 1000 * 60 * 60 * 24;
                }
            });
            window.opener.postMessage({ type: 'check-parent-commandeer' }, '*');
        }
    }

    async loadModels() {
        try {
            this.promises = Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
                faceapi.nets.ageGenderNet.loadFromUri('./models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('./models')
            ]).catch(() => {
                console.error('Error loading models');
                this.promises = null;
            });
        } catch (error) {
            console.error('Error loading models');
            this.promises = null;
        }
    }

    displayModelError() {
        if(this._parentWillTakeControl) {
            window.opener.postMessage({ type: 'age-estimation-error', error: 'Error loading models', nonce: this._nonce }, '*');
            return;
        }
        this.intro.style.display = 'none';
        this.consentForm.style.display = 'none';
        this.loadingSection.style.display = 'none';
        document.getElementById('model-error').style.display = 'block';
    }

    async requestWebcamAccess() {
        try {
            if(!this.promises) {
                this.displayModelError();
                return;
            }

            this.intro.style.display = 'none';
            this.consentForm.style.display = 'none';

            this.loadingSection.style.display = 'block';
            await new Promise(resolve => setTimeout(resolve, 200));
            try {
                await this.promises;
            } catch (error) {
                this.displayModelError();
                return;
            }

            await navigator.mediaDevices.getUserMedia({ video: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            for(const device of videoInputs) {
                if(!/obs|snap|manycam|virtual|v4l2|camtwist|splitcam|webcammax|youcam/i.test(device.label)) {
                    this.stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: device.deviceId } });
                    break;
                }
            };
            if(!this.stream) throw new Error('No webcam found');
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                this.startAgeEstimation();
            };
            this.videoElement.srcObject = this.stream;
            this.webcamSection.style.display = 'block';
            this.loadingSection.style.display = 'none';
            
        } catch (error) {
            console.error('Error accessing webcam:', error);
            if(this._parentWillTakeControl) {
                window.opener.postMessage({ type: 'age-estimation-error', error: 'Error accessing webcam', nonce: this._nonce }, '*');
                return;
            }
            alert('Unable to access webcam. Please ensure you have granted permission and your webcam is working properly.');
        }
    }

    async startAgeEstimation() {
        let lastDetection;
        const highProbabilityAges = [];
        const lowProbabilityAges = [];

        const processFrame = async () => {
            try {
                const detection = this._livenessCheck
                    ? await faceapi.detectSingleFace(
                        this.videoElement,
                        new faceapi.TinyFaceDetectorOptions()
                    ).withFaceLandmarks().withAgeAndGender().withFaceDescriptor()
                    : await faceapi.detectSingleFace(
                        this.videoElement,
                        new faceapi.TinyFaceDetectorOptions()
                    ).withFaceLandmarks().withAgeAndGender();

                if (detection) {
                    if(this._livenessCheck) {
                        lastDetection = detection;
                    }
                    const age = Math.round(detection.age);
                    let leftEye = detection.landmarks.getLeftEye()[0].x;
                    let rightEye = detection.landmarks.getRightEye()[0].x;
                    let eyeDistance = Math.abs(rightEye - leftEye);
                    let nose = detection.landmarks.getNose()[4].x;
                    let lookingStraight = Math.abs(nose - (leftEye + rightEye) / 2) < eyeDistance * 0.125;

                    // Update the processing text with results
                    this.webcamSection.querySelector('p').textContent = 'Processing age estimation...';

                    if(lookingStraight) {
                        if(detection.detection.score > 0.9) {
                            highProbabilityAges.push({ age, score: detection.detection.score });
                            lowProbabilityAges.push({ age, score: detection.detection.score });
                        } else if(detection.detection.score > 0.75) {
                            lowProbabilityAges.push({ age, score: detection.detection.score });
                        } else {
                            this.webcamSection.querySelector('p').textContent = 'Please ensure your face is clearly visible in the camera view.';
                        }
                    } else {
                        this.webcamSection.querySelector('p').textContent = 'Please ensure you are looking straight at the camera.';
                    }
                } else {
                    this.webcamSection.querySelector('p').textContent = 'No face detected. Please position your face in the camera view.';
                }
            } catch (error) {
                console.error('Error processing frame:', error);
            }

            // Schedule next frame
            if(highProbabilityAges.length >= 5) {
                let averageAge = this.computeAverageAge(highProbabilityAges);
                if(this._parentWillTakeControl) {
                    if(this._livenessCheck) {
                        this._ageFaceDescriptor = lastDetection.descriptor;
                        this.startLivenessCheck(averageAge);
                        return;
                    }
                    this.sendAgeToParent(averageAge);
                } else {
                    this.stopWebcam();
                    this.displayAge(averageAge);
                }
            } else if(lowProbabilityAges.length >= 10) {
                let averageAge = this.computeAverageAge(lowProbabilityAges);
                if(this._parentWillTakeControl) {
                    if(this._livenessCheck) {
                        this._ageFaceDescriptor = lastDetection.descriptor;
                        this.startLivenessCheck(averageAge);
                        return;
                    }
                    this.sendAgeToParent(averageAge);
                } else {
                    this.stopWebcam();
                    this.displayAge(averageAge);
                }
            } else {
                setTimeout(() => processFrame(), 250);
            }
        };

        // Start processing frames
        processFrame();
    }

    async startLivenessCheck(averageAge) {
        let direction = 'to your left';
        let flipped = false;
        const processFrame = async () => {
            try {
                const detection = await faceapi.detectSingleFace(
                    this.videoElement,
                    new faceapi.TinyFaceDetectorOptions()
                ).withFaceLandmarks().withFaceDescriptor();

                if (detection) {
                    const age = Math.round(detection.age);

                    this.webcamSection.querySelector('p').textContent = 'Please look ' + direction;

                    //check if the face is looking to the left or right
                    let leftEye = detection.landmarks.getLeftEye()[0].x;
                    let rightEye = detection.landmarks.getRightEye()[0].x;
                    let eyeDistance = Math.abs(rightEye - leftEye);
                    let nose = detection.landmarks.getNose()[4].x;
                    let lookingLeft = nose < leftEye || Math.abs(leftEye - nose) < eyeDistance * 0.25;
                    let lookingRight = nose > rightEye || Math.abs(rightEye - nose) < eyeDistance * 0.25;
                    let lookingStraight = Math.abs(nose - (leftEye + rightEye) / 2) < eyeDistance * 0.125;

                    if(direction == 'to your left' && lookingLeft) {//looking left
                        direction = 'to your right';
                    } else if(direction == 'to your left' && lookingRight) {//looking left flipped
                        direction = 'to your right';
                        flipped = true;
                    } else if(direction == 'to your right' && !flipped && lookingRight) {//looking right
                        direction = 'straight';
                    } else if(direction == 'to your right' && flipped && lookingLeft) {//looking right flipped
                        direction = 'straight';
                    } else if(direction == 'straight' && detection.detection.score > 0.85 && lookingStraight){
                        let livenessFaceDescriptor = detection.descriptor;
                        let livenessScore = faceapi.euclideanDistance(this._ageFaceDescriptor, livenessFaceDescriptor);
                        if(livenessScore < 0.6) {
                            this.sendAgeToParent(averageAge);
                            return;
                        } else {
                            this.stopWebcam();
                            window.opener.postMessage({ type: 'age-estimation-error', error: 'Different face detected for liveness check', nonce: this._nonce }, '*');
                            return;
                        }
                    }

                } else {
                    this.webcamSection.querySelector('p').textContent = 'No face detected. Please position your face in the camera view.';
                }
            } catch (error) {
                console.error('Error processing frame:', error);
            }

            setTimeout(() => processFrame(), 250);
        };

        // Start processing frames
        processFrame();
    }

    // compute weighted average where the score is the weight
    computeAverageAge(ages) {
        const totalAge = ages.reduce((sum, age) => sum + age.age * age.score, 0);
        const totalWeight = ages.reduce((sum, age) => sum + age.score, 0);
        return Math.floor(totalAge / totalWeight);
    }

    sendAgeToParent(age) {
        const checkmarkOverlay = document.getElementById('checkmark-overlay');
        checkmarkOverlay.classList.remove('hidden');
        
        setTimeout(() => {
            this.stopWebcam();
            let result = {
                age: age,
                createdAt: Date.now(),
                exp: Date.now() + this._cacheDuration,
                sub: simpleHash(navigator.userAgent + this._openerOrigin),
            };
            let base64UrlSafeResult = btoa(JSON.stringify(result));
            let signature = sign(base64UrlSafeResult);
            let token = base64UrlSafeResult + '.' + signature;
            window.opener.postMessage({ type: 'age-estimation-result', age: age, token: token, nonce: this._nonce }, '*');
        }, 1000);
    }

    displayAge(age) {
        this.webcamSection.style.display = 'none';
        const resultsSection = document.getElementById('results-section');
        document.getElementById('estimated-age').textContent = `${age} years`;
        resultsSection.style.display = 'block';
    }

    stopWebcam() {
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    }
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

//disableDevtool();

let main = new Main();
export default main;
