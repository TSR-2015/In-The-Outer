import { AudioInstance } from '../managers/AudioManager.js';

class EarthToMoonMission {
  constructor() {
    this.stage = 'INTRO'; // INTRO, Q1, LAUNCH, ATMOSPHERE, SEPARATION, LEO, Q3, DEPLOYMENT, TLI, Q4, TRANSFER, APPROACH, DESCENT, Q5, Q2, SUCCESS_PAUSE, COMPLETE, FAILED
    
    // Telemetry variables
    this.altitude = 0; // km
    this.velocity = 0; // km/s
    this.fuel = 100; // %
    this.elapsedTime = 0; // seconds
    this.score = 0;
    
    this.objective = "Awaiting launch instructions...";
    this.progress = 0; // 0 to 100 %
    
    // Quiz state
    this.correctAnswersCount = 0;
    this.wrongAnswersCount = 0;
    this.failedQuestionData = null; // Stores quiz details on wrong answer
    
    this.countdown = 5.0; // Countdown timer
    this.descentCountdown = 30.0; // Telemetry loss countdown
    this.successPause = 0;
    this.completionTriggered = false;
    
    // Callback functions to trigger UI updates
    this.onUIUpdate = null;
    this.onQuizTrigger = null;
    this.onQuizClose = null;
    this.onMissionComplete = null;
    this.onMissionFailed = null;
    this.onCameraTransition = null; // notifies scene controller of camera changes
    
    // Quiz definitions
    this.questions = {
      Q1: {
        id: "Q1",
        question: "What minimum speed must the spacecraft reach to escape Earth's gravity?",
        options: [
          { text: "7.9 km/s (Orbital velocity)", val: "A" },
          { text: "11.2 km/s (Escape velocity)", val: "B" },
          { text: "15.0 km/s (Hyperbolic velocity)", val: "C" },
          { text: "5.0 km/s (Suborbital velocity)", val: "D" }
        ],
        correct: "B",
        explanation: "Earth's escape velocity is approximately 11.2 km/s. Below this speed, the spacecraft cannot break free of Earth's gravity."
      },
      Q3: {
        id: "Q3",
        question: "Before heading to the Moon, spacecraft usually enter a:",
        options: [
          { text: "Lunar Orbit", val: "A" },
          { text: "Solar Orbit", val: "B" },
          { text: "Low Earth Orbit (LEO)", val: "C" },
          { text: "Geostationary Orbit", val: "D" }
        ],
        correct: "C",
        explanation: "Entering Low Earth Orbit (LEO) allows the spacecraft to perform system health checks and align its trajectory for the Trans-Lunar Injection burn."
      },
      Q4: {
        id: "Q4",
        question: "Approximately how long does it take a spacecraft to travel from Earth to the Moon?",
        options: [
          { text: "12 hours", val: "A" },
          { text: "1 day", val: "B" },
          { text: "3 to 5 days", val: "C" },
          { text: "10 days", val: "D" }
        ],
        correct: "C",
        explanation: "Standard Trans-Lunar transfers (like Apollo or Artemis) take about 3 to 5 days to cover the ~384,400 km separation distance."
      },
      Q5: {
        id: "Q5",
        question: "Telemetry is lost for 30 seconds during descent. What is the best response?",
        options: [
          { text: "Abort the landing sequence immediately", val: "A" },
          { text: "Restart the guidance computer", val: "B" },
          { text: "Wait for signal recovery while autonomous systems continue", val: "C" },
          { text: "Shut down the descent engine completely", val: "D" }
        ],
        correct: "C",
        explanation: "Descent guidance systems are autonomous. Briefly losing communication is normal, and shutting down or aborting could result in a crash."
      },
      Q2: {
        id: "Q2",
        question: "What is the final action before touching down on the Moon?",
        options: [
          { text: "Increase horizontal speed", val: "A" },
          { text: "Reduce vertical speed using descent engines", val: "B" },
          { text: "Deploy atmospheric parachutes", val: "C" },
          { text: "Ignite auxiliary escape boosters", val: "D" }
        ],
        correct: "B",
        explanation: "You must throttle down and fire the descent engine downwards to slow vertical velocity to under 2 m/s for a gentle landing. Parachutes do not work in the lunar vacuum."
      }
    };
  }

  startMission() {
    this.stage = 'INTRO';
    this.altitude = 0;
    this.velocity = 0;
    this.fuel = 100;
    this.elapsedTime = 0;
    this.score = 0;
    this.countdown = 5.0;
    this.correctAnswersCount = 0;
    this.wrongAnswersCount = 0;
    this.failedQuestionData = null;
    this.successPause = 0;
    this.completionTriggered = false;
    
    this.objective = "Prepare for countdown...";
    this.progress = 0;
    
    if (this.onCameraTransition) {
      this.onCameraTransition('launchpad');
    }
  }

  handleAnswer(questionId, selectedValue) {
    const q = this.questions[questionId];
    if (!q) return;

    if (selectedValue === q.correct) {
      AudioInstance.playScienceBeep();
      this.correctAnswersCount++;
      this.score += 2000;
      
      // Close modal
      if (this.onQuizClose) this.onQuizClose();
      
      // Transition to next stages depending on the question answered
      if (questionId === 'Q1') {
        this.stage = 'LAUNCH';
        this.objective = "Launching spacecraft...";
        AudioInstance.playLaunchRumble();
      } else if (questionId === 'Q3') {
        this.stage = 'DEPLOYMENT';
        this.objective = "Deploying communications satellite...";
        if (this.onCameraTransition) this.onCameraTransition('deployment');
      } else if (questionId === 'Q4') {
        this.stage = 'TRANSFER';
        this.objective = "Navigating deep space transfer corridor...";
        AudioInstance.playThrusterPulse();
      } else if (questionId === 'Q5') {
        this.stage = 'DESCENT';
        this.descentCountdown = -1; // telemetry restored flag
        this.countdown = 200.0; // altitude at 200m for final landing approach
        this.progress = 97;
        this.objective = "TELEMETRY RESTORED. Descending to landing pad...";
        AudioInstance.playThrusterPulse();
      } else if (questionId === 'Q2') {
        this.progress = 100;
        AudioInstance.playTouchdown();
        this.completeMissionNow();
      }
    } else {
      this.wrongAnswersCount++;
      this.stage = 'FAILED';
      this.failedQuestionData = {
        question: q.question,
        correctText: q.options.find(o => o.val === q.correct).text,
        explanation: q.explanation
      };
      if (this.onQuizClose) this.onQuizClose();
      if (this.onMissionFailed) this.onMissionFailed(this.failedQuestionData);
    }
  }

  update(delta) {
    if (this.stage === 'FAILED' || this.stage === 'COMPLETE') return;

    this.elapsedTime += delta;

    switch (this.stage) {
      case 'INTRO':
        this.countdown -= delta;
        this.progress = Math.min(5, Math.floor((5.0 - this.countdown) * 1));
        this.objective = `T-MINUS ${Math.ceil(this.countdown)} SECONDS`;
        
        if (this.countdown <= 0) {
          // Trigger first checkpoint question before launch
          this.stage = 'Q1';
          if (this.onQuizTrigger) this.onQuizTrigger(this.questions.Q1);
        }
        break;

      case 'Q1':
        // Countdown is paused awaiting correct answer
        break;

      case 'LAUNCH':
        // Rocket lifts off and ascends vertically
        this.progress = Math.min(25, this.progress + delta * 2.0);
        this.altitude = parseFloat((this.altitude + delta * 8.5).toFixed(1)); // goes up to 80 km
        this.velocity = parseFloat((this.velocity + delta * 0.25).toFixed(2)); // goes up to 5.0 km/s
        this.fuel = Math.max(85, parseFloat((this.fuel - delta * 0.4).toFixed(1)));
        this.objective = "Ascending through Earth's atmosphere...";

        if (this.altitude >= 60.0) {
          this.stage = 'ATMOSPHERE';
          if (this.onCameraTransition) this.onCameraTransition('atmosphere');
        }
        break;

      case 'ATMOSPHERE':
        // Sky turns black, Earth curvature visible
        this.progress = Math.min(40, this.progress + delta * 1.5);
        this.altitude = parseFloat((this.altitude + delta * 12.0).toFixed(1)); // goes up to 180 km
        this.velocity = parseFloat((this.velocity + delta * 0.18).toFixed(2)); // goes up to 7.8 km/s
        this.fuel = Math.max(70, parseFloat((this.fuel - delta * 0.35).toFixed(1)));
        this.objective = "Leaving Earth's atmosphere. Space injection...";

        if (this.altitude >= 150.0) {
          this.stage = 'SEPARATION';
          this.countdown = 3.0; // 3 seconds camera focus on booster
          if (this.onCameraTransition) this.onCameraTransition('separation');
        }
        break;

      case 'SEPARATION':
        // Booster separates and camera tracks it
        this.countdown -= delta;
        this.progress = Math.min(45, this.progress + delta * 1.0);
        this.altitude = parseFloat((this.altitude + delta * 4.0).toFixed(1)); // coasting up to 200 km
        this.velocity = parseFloat((this.velocity - delta * 0.05).toFixed(2)); // speed decays slightly
        this.fuel = Math.max(68, parseFloat((this.fuel - delta * 0.05).toFixed(1)));
        this.objective = "Booster separation sequence active...";

        if (this.countdown <= 0) {
          this.stage = 'LEO';
          if (this.onCameraTransition) this.onCameraTransition('orbit');
        }
        break;

      case 'LEO':
        // Orbital insertion achieved
        this.progress = Math.min(55, this.progress + delta * 1.2);
        this.altitude = parseFloat((250 + Math.sin(this.elapsedTime * 0.5) * 5).toFixed(1)); // LEO orbit altitude
        this.velocity = 7.78; // LEO speed
        this.objective = "Low Earth Orbit achieved. System check...";

        if (this.progress >= 55) {
          this.stage = 'Q3';
          if (this.onQuizTrigger) this.onQuizTrigger(this.questions.Q3);
        }
        break;

      case 'Q3':
        // Paused on LEO question
        break;

      case 'DEPLOYMENT':
        // Satellite deployment sequence
        this.progress = Math.min(65, this.progress + delta * 1.5);
        this.altitude = 250;
        this.velocity = 7.5; // slows down rocket slightly
        this.objective = "Deploying communications satellite...";
        
        if (this.progress >= 65) {
          this.stage = 'TLI';
          if (this.onCameraTransition) this.onCameraTransition('launchpad'); // pivot camera to TLI angle
        }
        break;

      case 'TLI':
        // Trans-Lunar Injection engine ignition
        this.progress = Math.min(75, this.progress + delta * 1.5);
        this.altitude = parseFloat((this.altitude + delta * 80.0).toFixed(1));
        this.velocity = parseFloat((this.velocity + delta * 0.45).toFixed(2)); // increases to 11.2 km/s
        this.fuel = Math.max(45, parseFloat((this.fuel - delta * 0.8).toFixed(1)));
        this.objective = "Trans-Lunar Injection burn active...";

        if (this.velocity >= 11.0) {
          this.stage = 'Q4';
          if (this.onQuizTrigger) this.onQuizTrigger(this.questions.Q4);
        }
        break;

      case 'Q4':
        // Paused on Travel duration question
        break;

      case 'TRANSFER':
        // Space travel timelapse
        this.progress = Math.min(85, this.progress + delta * 5.0);
        // Altitude changes from Earth LEO to Moon distance (~384,400 km)
        const travelPct = (this.progress - 75) / 10; // 0 to 1
        this.altitude = parseFloat((250 + travelPct * 383000).toFixed(1));
        // Speed slows down as it pulls away from Earth gravity, then accelerates towards Moon
        if (travelPct < 0.8) {
          this.velocity = parseFloat((11.2 - travelPct * 9.0).toFixed(2)); // decels to ~2.2 km/s
        } else {
          this.velocity = parseFloat((2.2 + (travelPct - 0.8) * 4.0).toFixed(2)); // incels back to ~3.0 km/s due to lunar gravity
        }
        this.objective = "Navigating deep space transfer corridor...";

        if (this.progress >= 85) {
          this.stage = 'APPROACH';
          if (this.onCameraTransition) this.onCameraTransition('approach');
        }
        break;

      case 'APPROACH':
        // Lunar orbit insertion
        this.progress = Math.min(90, this.progress + delta * 4.0);
        this.altitude = parseFloat((384400 - (this.progress - 85) * 8000).toFixed(1)); // getting closer to surface
        this.velocity = parseFloat((3.0 - (this.progress - 85) * 0.28).toFixed(2)); // slows down to 1.6 km/s
        this.fuel = Math.max(38, parseFloat((this.fuel - delta * 0.3).toFixed(1)));
        this.objective = "Entering lunar orbit. Descent preparation...";

        if (this.progress >= 90) {
          this.stage = 'DESCENT';
          this.countdown = 1000.0; // Altitude starts at 1000m
          this.descentCountdown = 2.0; // Loss of telemetry timer (fast 2 seconds)
          if (this.onCameraTransition) this.onCameraTransition('descent');
        }
        break;

      case 'DESCENT':
        // Controlled descent with telemetry loss & final touchdown approach
        this.fuel = Math.max(20, parseFloat((this.fuel - delta * 0.4).toFixed(1)));
        
        // Loss of telemetry mechanism
        if (this.descentCountdown > 0) {
          this.progress = Math.min(95, this.progress + delta * 2.0);
          this.countdown = Math.max(250.0, this.countdown - delta * 250.0);
          this.velocity = parseFloat((1.6 - (1000 - this.countdown) * 0.0015).toFixed(2));
          this.descentCountdown -= delta;
          this.objective = `TELEMETRY LOST: SIGNAL RECOVERY IN ${Math.max(1, Math.ceil(this.descentCountdown))}s`;
          
          if (this.descentCountdown <= 0) {
            // Trigger Q5 (Telemetry loss question)
            this.stage = 'Q5';
            if (this.onQuizTrigger) this.onQuizTrigger(this.questions.Q5);
          }
        } else {
          // Telemetry restored, descending from 200m down to landing pad
          this.progress = Math.min(99, this.progress + delta * 3.0);
          this.countdown = Math.max(15.0, this.countdown - delta * 120.0);
          this.velocity = parseFloat((0.8 - (200 - this.countdown) * 0.003).toFixed(2));
          this.objective = "TELEMETRY RESTORED. Descending to landing pad...";
          
          if (this.countdown <= 20.0) {
            // Trigger final landing question
            this.stage = 'Q2';
            if (this.onQuizTrigger) this.onQuizTrigger(this.questions.Q2);
          }
        }
        break;

      case 'Q5':
        // Paused on telemetry loss question
        break;

      case 'Q2':
        // Paused on final landing speed question
        break;

      case 'TOUCHDOWN':
        // Spacecraft settles on surface
        this.progress = 100;
        this.countdown = 0;
        this.velocity = 0;
        this.completeMissionNow();
        break;

      case 'SUCCESS_PAUSE':
        // Hold the completed probe in view before showing the success screen.
        this.successPause -= delta;
        this.progress = 100;
        this.velocity = 0;
        this.objective = 'Lunar probe objective complete. Verifying orbital stability...';
        if (this.successPause <= 0) this.completeMissionNow();
        break;
    }

    // Completion is authoritative: the success window appears at 100%, with no
    // hidden touchdown or orbital-stability delay.
    if (this.progress >= 100 && this.stage !== 'SUCCESS_PAUSE' && this.stage !== 'COMPLETE' && this.stage !== 'FAILED') {
      this.completeMissionNow();
    }

    if (this.onUIUpdate) {
      this.onUIUpdate();
    }
  }

  completeMissionNow() {
    if (this.completionTriggered) return;
    this.completionTriggered = true;
    this.stage = 'COMPLETE';
    this.progress = 100;
    this.velocity = 0;
    this.objective = 'Lunar orbit achieved. Mission successful.';

    // Audio is cosmetic — a failure here must never block the mission
    // from actually completing, so isolate it from the callback below.
    try {
      AudioInstance.playLevelComplete();
    } catch (err) {
      console.error('[EarthToMoonMission] playLevelComplete failed:', err);
    }

    if (this.onMissionComplete) this.onMissionComplete();
  }
}

export const EarthToMoonMissionInstance = new EarthToMoonMission();
export { EarthToMoonMission };
