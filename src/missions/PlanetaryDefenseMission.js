import { AudioInstance } from '../managers/AudioManager.js';
import { ProgressInstance } from '../managers/ProgressManager.js';

class PlanetaryDefenseMission {
  constructor() {
    this.currentSceneId = 'LEVEL_1';
    this.history = []; // Array of { sceneId, choice }
    this.selectedDecision = null;
    this.score = 5000;
    this.elapsedTime = 0;
    this.timerInterval = null;

    // Callbacks for UI updates
    this.onSceneUpdate = null;
    this.onEndingReached = null;

    // Exactly 11 scientific endings as specified
    this.endingsData = {
      A1: {
        code: 'A1',
        title: 'LARGE TRAJECTORY CHANGE',
        asteroidState: 2, // Rubble pile with ejecta
        craftType: 'STRIKE-2',
        bgType: 'KINETIC_IMPACT_HIGH',
        whatHappened: 'The high-velocity kinetic impact transferred immense momentum to the asteroid. However, because it was a loosely packed rubble pile, the collision also blew off a massive cloud of ejecta debris.',
        whatYouLearned: 'Kinetic impact momentum transfer depends heavily on the asteroid\'s internal cohesion. Ejecta recoil can provide extra momentum (the beta factor), but can also spread secondary debris.',
        status: 'HIGH DEFLECTION ACHIEVED'
      },
      A2: {
        code: 'A2',
        title: 'SMALLER TRAJECTORY CHANGE',
        asteroidState: 2, // Rubble pile with modest shift
        craftType: 'STRIKE-2',
        bgType: 'KINETIC_IMPACT_LOW',
        whatHappened: 'The lower-velocity kinetic impact successfully transferred momentum with minimal surface disruption. The trajectory shifted slightly, though by a smaller margin than a high-speed strike.',
        whatYouLearned: 'Lower impact velocities reduce the severity of asteroid fragmentation and surface disruption, but transfer less total momentum, requiring earlier warning time to ensure Earth clearance.',
        status: 'MODEST DEFLECTION CONFIRMED'
      },
      A3: {
        code: 'A3',
        title: 'GRADUAL TRAJECTORY CHANGE',
        asteroidState: 2,
        craftType: 'GRAVITY TRACTOR',
        bgType: 'GRAVITY_TRACTOR',
        whatHappened: 'The gravity tractor maintained precise formation flight with the rubble-pile asteroid over an extended operational window. Its minute gravitational attraction steadily pulled the asteroid into a safe, altered orbit.',
        whatYouLearned: 'Gravity-tractor deflection is completely non-contact, eliminating all fragmentation risks. However, it is extremely gradual and depends strictly on sustained formation flight and multi-year lead time.',
        status: 'GRADUAL TRAJECTORY DEFLECTION VERIFIED'
      },
      A4: {
        code: 'A4',
        title: 'INSUFFICIENT TRAJECTORY CHANGE',
        asteroidState: 2,
        craftType: 'GRAVITY TRACTOR',
        bgType: 'GRAVITY_TRACTOR_ABORT',
        whatHappened: 'The spacecraft broke formation before enough gravitational pull had accumulated over time. The asteroid\'s trajectory altered only fractionally, leaving it uncomfortably close to the orbital hazard zone.',
        whatYouLearned: 'A gravity tractor provides no sudden momentum kick. Terminating formation flight early cancels the cumulative gravitational tow before a safe orbital shift can be accomplished.',
        status: 'INSUFFICIENT TRAJECTORY ALTERATION'
      },
      B1: {
        code: 'B1',
        title: 'SUCCESSFUL DEFLECTION',
        asteroidState: 3, // Solid compact body
        craftType: 'STRIKE-1',
        bgType: 'CENTRAL_IMPACT_SUCCESS',
        whatHappened: 'STRIKE-1 struck the center of mass dead on. The monolithic structure absorbed and transferred the kinetic energy cleanly, shifting the projected path completely outside the critical Earth-impact corridor.',
        whatYouLearned: 'Targeting the center of mass on a cohesive body delivers the cleanest and most mathematically predictable momentum transfer, effectively mitigating orbital threat.',
        status: 'TARGET DEFLECTED FROM EARTH CORRIDOR'
      },
      B2: {
        code: 'B2',
        title: 'FRAGMENT MONITORING MISSION',
        asteroidState: 5, // Multiple tracked fragments
        craftType: 'STRIKE-1',
        bgType: 'FRAGMENTATION',
        whatHappened: 'Impacting the visibly fractured region shattered the asteroid into several large fragments. Ari prioritized comprehensive tracking, deploying radar telemetry across all diverging pieces.',
        whatYouLearned: 'Impacting fractured or uncertain structures carries high risk of catastrophic disruption. When fragmentation occurs, planetary defense shifts from single-body deflection to multi-target orbital tracking.',
        status: 'MULTI-TARGET TRACKING ACTIVE'
      },
      B3: {
        code: 'B3',
        title: 'SECONDARY INTERCEPTION MISSION',
        asteroidState: 5, // Multiple fragments with interception vector
        craftType: 'STRIKE-1',
        bgType: 'SECONDARY_INTERCEPTION',
        whatHappened: 'After the structural breakup, Mission Control immediately authorized secondary interception spacecraft to target and deflect the largest fragment that remained on an Earth-crossing trajectory.',
        whatYouLearned: 'Fragmentation turns one asteroid hazard into multiple independent trajectories. Defense architectures must be modular enough to launch rapid follow-up interceptions against high-risk remnants.',
        status: 'SECONDARY DEFENSE FLEET SCRAMBLED'
      },
      C1: {
        code: 'C1',
        title: 'PRECISION DEFLECTION MISSION',
        asteroidState: 3, // Cohesive compact sample
        craftType: 'STRIKE-1',
        bgType: 'SAMPLE_COMPACT_IMPACT',
        whatHappened: 'Physical sampling of the smooth surface revealed dense, cohesive asteroid material. Armed with precise density and mass metrics, Mission Control designed an optimized kinetic impactor.',
        whatYouLearned: 'Direct physical samples eliminate structural uncertainty. Knowing exact mineral composition and density allows scientists to calibrate the exact kinetic energy required for clean deflection.',
        status: 'PRECISION IMPACT TRAJECTORY VALIDATED'
      },
      C2: {
        code: 'C2',
        title: 'LONG-DURATION DEFLECTION MISSION',
        asteroidState: 3,
        craftType: 'GRAVITY TRACTOR',
        bgType: 'GRAVITY_TRACTOR',
        whatHappened: 'Having determined the asteroid\'s high density from the smooth sample, scientists deployed a gravity tractor. The high target mass maximized the mutual gravitational tug, gently reshaping its orbital path.',
        whatYouLearned: 'A denser asteroid exerts stronger mutual gravity with a tractor spacecraft. A non-contact gravitational strategy avoids all surface disruption while leveraging the asteroid\'s own mass.',
        status: 'SUSTAINED GRAVITATIONAL SHIFT'
      },
      C3: {
        code: 'C3',
        title: 'GRAVITY TRACTOR MISSION',
        asteroidState: 4, // Highly fragmented
        craftType: 'GRAVITY TRACTOR',
        bgType: 'GRAVITY_TRACTOR',
        whatHappened: 'The sample from the rocky region showed fragile, loosely bound gravel. Recognizing that any physical blow would cause fragmentation, Ari selected a gravity tractor to gently deflect it without contact.',
        whatYouLearned: 'When sample analysis proves an asteroid lacks internal cohesion, kinetic impact is disqualified due to debris dispersion. Gravity tractors represent the safest non-destructive solution for fragile bodies.',
        status: 'NON-DESTRUCTIVE DEFLECTION DEPLOYED'
      },
      C4: {
        code: 'C4',
        title: 'FRAGMENT INTERCEPTION MISSION',
        asteroidState: 5,
        craftType: 'ORBITER-X',
        bgType: 'FRAGMENT_PREPARATION',
        whatHappened: 'Recognizing that the rocky asteroid was inherently fragile, Commander Ari prepared comprehensive interception protocols for each piece, coordinating secondary defense units before any disruption occurred.',
        whatYouLearned: 'Predicting fragmentation before acting allows planetary defense agencies to preposition tracking satellites and secondary interceptors, rather than reacting blindly to an unexpected breakup.',
        status: 'COORDINATED INTERCEPTION READINESS'
      }
    };
  }

  startMission() {
    this.currentSceneId = 'LEVEL_1';
    this.history = [];
    this.selectedDecision = null;
    this.elapsedTime = 0;
    this.startTimer();
    this.loadScene('LEVEL_1');
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedTime++;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  loadScene(sceneId) {
    this.currentSceneId = sceneId;
    AudioInstance.playBeep();

    const sceneData = this.getSceneData(sceneId);
    if (this.onSceneUpdate) {
      this.onSceneUpdate(sceneData);
    }
  }

  makeDecision(choiceKey) {
    AudioInstance.playClick();
    this.history.push({ sceneId: this.currentSceneId, choice: choiceKey });

    const currentScene = this.getSceneData(this.currentSceneId);
    if (currentScene && currentScene.decision) {
      const selectedOption = currentScene.decision.options.find(opt => opt.key === choiceKey);
      if (selectedOption) {
        if (selectedOption.nextScene) {
          this.loadScene(selectedOption.nextScene);
        } else if (selectedOption.ending) {
          this.triggerEnding(selectedOption.ending);
        }
      }
    }
  }

  triggerEnding(endingKey) {
    this.stopTimer();
    AudioInstance.playDiscoveryFanfare();

    const ending = this.endingsData[endingKey];
    const minutes = Math.floor(this.elapsedTime / 60);
    const seconds = Math.floor(this.elapsedTime % 60);
    const bestTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.00`;

    // Save Mission 5 progress in ProgressManager
    ProgressInstance.completeMission('mission_5', 5000, 3, bestTimeStr);

    if (this.onEndingReached) {
      this.onEndingReached(endingKey, ending);
    }
  }

  getSceneData(sceneId) {
    switch (sceneId) {
      // -------------------------------------------------------------
      // 1. OPENING SCENE — PRIMARY MISSION CONTROL (BACKGROUND A)
      // -------------------------------------------------------------
      case 'LEVEL_1':
        return {
          id: 'LEVEL_1',
          bgId: 'BG_A_MISSION_CONTROL',
          title: 'LEVEL 1 — ASTEROID DETECTED',
          subtitle: 'PRIMARY MISSION CONTROL // EARTH HAZARD MONITORING',
          asteroidState: 1,
          craftType: null,
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_open_1',
              expression: 'serious',
              text: 'Mission Control, report.'
            },
            {
              speaker: 'LEO',
              role: 'Flight Systems Specialist',
              audioId: 'leo_open_2',
              expression: 'urgent',
              text: 'Commander, we\'ve detected a potentially hazardous asteroid on a trajectory that could intersect Earth\'s orbital region.'
            },
            {
              speaker: 'MAYA',
              role: 'Asteroid & Material Scientist',
              audioId: 'maya_open_3',
              expression: 'analytical',
              text: 'We don\'t know enough about its structure. It could be a solid body, or it could be a loosely packed rubble pile.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_open_4',
              expression: 'concerned',
              text: 'How much time do we have?'
            },
            {
              speaker: 'LEO',
              role: 'Flight Systems Specialist',
              audioId: 'leo_open_5',
              expression: 'serious',
              text: 'Limited time. We need to decide what mission to send.'
            }
          ],
          decision: {
            id: 'D1',
            title: 'WHAT SHOULD WE DO?',
            subtitle: 'Choose primary defense strategy:',
            options: [
              {
                key: 'A',
                title: 'STUDY THE ASTEROID',
                desc: 'Gather information before acting.',
                nextScene: 'LEVEL_2A'
              },
              {
                key: 'B',
                title: 'DEFLECT THE ASTEROID IMMEDIATELY',
                desc: 'Attempt immediate trajectory change.',
                nextScene: 'LEVEL_2B'
              },
              {
                key: 'C',
                title: 'COLLECT A SAMPLE FIRST',
                desc: 'Obtain physical material before selecting a defense strategy.',
                nextScene: 'LEVEL_2C'
              }
            ]
          }
        };

      // -------------------------------------------------------------
      // 2. BRANCH A — RECONNAISSANCE (BACKGROUND C)
      // -------------------------------------------------------------
      case 'LEVEL_2A':
        return {
          id: 'LEVEL_2A',
          bgId: 'BG_C_RECONNAISSANCE',
          title: 'LEVEL 2A — ASTRA-1 RECONNAISSANCE',
          subtitle: 'APPROACH TRAJECTORY // DEEP SPACE OBSERVATION',
          asteroidState: 1,
          craftType: 'ASTRA-1',
          dialogues: [
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_2a_1',
              expression: 'focused',
              text: 'ASTRA-1 has launched and is approaching the asteroid.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_2a_2',
              expression: 'focused',
              text: 'Keep the spacecraft on observation mode. We need as much information as possible.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_2a_3',
              expression: 'thinking',
              text: 'We can investigate the asteroid in two different ways.'
            }
          ],
          decision: {
            id: 'D2',
            title: 'DECISION 2 — INVESTIGATION METHOD',
            subtitle: 'Select reconnaissance scan technique:',
            options: [
              {
                key: 'A',
                title: 'SCAN THE SURFACE',
                desc: 'Map boulder distribution and surface topography.',
                nextScene: 'LEVEL_SURFACE_SCAN'
              },
              {
                key: 'B',
                title: 'ANALYZE THE INTERNAL STRUCTURE',
                desc: 'Use radar sounding to estimate subsurface density distribution.',
                nextScene: 'LEVEL_INTERNAL_SCAN'
              }
            ]
          }
        };

      // -------------------------------------------------------------
      // 2A-1: SURFACE ANALYSIS (BACKGROUND D)
      // -------------------------------------------------------------
      case 'LEVEL_SURFACE_SCAN':
        return {
          id: 'LEVEL_SURFACE_SCAN',
          bgId: 'BG_D_ASTEROID_SURFACE',
          title: 'SURFACE ANALYSIS — TOPOGRAPHY SCAN',
          subtitle: 'ASTRA-1 SURFACE MAPPING // OPTICAL RADAR',
          asteroidState: 2,
          craftType: 'ASTRA-1',
          dialogues: [
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_surf_1',
              expression: 'analytical',
              text: 'Surface scan complete. We\'re seeing large boulders separated by loose material.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_surf_2',
              expression: 'concerned',
              text: 'That suggests weak surface cohesion, but we still don\'t know what\'s underneath.'
            }
          ],
          autoTransitionTo: 'LEVEL_COMBINED_ANALYSIS',
          autoTransitionDelay: 1200
        };

      // -------------------------------------------------------------
      // 2A-2: INTERNAL STRUCTURE ANALYSIS (BACKGROUND E)
      // -------------------------------------------------------------
      case 'LEVEL_INTERNAL_SCAN':
        return {
          id: 'LEVEL_INTERNAL_SCAN',
          bgId: 'BG_E_INTERNAL_STRUCTURE',
          title: 'INTERNAL STRUCTURE ANALYSIS — RADAR SOUNDING',
          subtitle: 'SUBSURFACE DENSITY PROFILING // VOLUMETRIC TOMOGRAPHY',
          asteroidState: 2,
          craftType: 'ASTRA-1',
          dialogues: [
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_int_1',
              expression: 'focused',
              text: 'We\'ll use radar and spacecraft measurements to estimate how material is distributed beneath the surface.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_int_2',
              expression: 'analytical',
              text: 'Internal scan complete. The measurements show significant low-density regions beneath the surface.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_int_3',
              expression: 'surprised',
              text: 'So this isn\'t a solid body.'
            }
          ],
          autoTransitionTo: 'LEVEL_COMBINED_ANALYSIS',
          autoTransitionDelay: 1200
        };

      // -------------------------------------------------------------
      // 2A-3: COMBINED ANALYSIS CONVERGENCE (BACKGROUND B)
      // -------------------------------------------------------------
      case 'LEVEL_COMBINED_ANALYSIS':
        return {
          id: 'LEVEL_COMBINED_ANALYSIS',
          bgId: 'BG_B_ASTEROID_TRACKING',
          title: 'COMBINED TELEMETRY ANALYSIS',
          subtitle: 'STRUCTURAL CLASSIFICATION // RUBBLE-PILE AGGREGATE',
          asteroidState: 2,
          craftType: 'ASTRA-1',
          dialogues: [
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_comb_1',
              expression: 'analytical',
              text: 'Combining the measurements, the asteroid is very likely a rubble-pile structure.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_comb_2',
              expression: 'serious',
              text: 'That changes our options. A direct impact might not behave the way we expect.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_comb_3',
              expression: 'thinking',
              text: 'Then we need to choose our defense carefully.'
            }
          ],
          decision: {
            id: 'D3',
            title: 'WHICH DEFENSE METHOD?',
            subtitle: 'Select strategy for rubble-pile asteroid:',
            options: [
              {
                key: 'A',
                title: 'USE A KINETIC IMPACTOR',
                desc: 'Transfer momentum via direct spacecraft collision.',
                nextScene: 'LEVEL_3A_KINETIC'
              },
              {
                key: 'B',
                title: 'USE A GRAVITY TRACTOR',
                desc: 'Use spacecraft mass to pull the asteroid gradually.',
                nextScene: 'LEVEL_3B_TRACTOR'
              }
            ]
          }
        };

      // -------------------------------------------------------------
      // 2A-4: KINETIC IMPACT APPROACH (BACKGROUND F)
      // -------------------------------------------------------------
      case 'LEVEL_3A_KINETIC':
        return {
          id: 'LEVEL_3A_KINETIC',
          bgId: 'BG_F_KINETIC_IMPACT',
          title: 'LEVEL 3A — KINETIC IMPACTOR APPROACH',
          subtitle: 'STRIKE-2 TERMINAL INTERCEPTION // RUBBLE PILE TARGET',
          asteroidState: 2,
          craftType: 'STRIKE-2',
          dialogues: [
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_kin_1',
              expression: 'focused',
              text: 'The impactor is approaching the asteroid.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_kin_2',
              expression: 'analytical',
              text: 'Impact velocity will determine how much momentum we transfer.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_kin_3',
              expression: 'serious',
              text: 'We have two possible approaches.'
            }
          ],
          decision: {
            id: 'D4',
            title: 'DECISION 4 — IMPACT VELOCITY STRATEGY',
            subtitle: 'Select collision velocity:',
            options: [
              {
                key: 'A',
                title: 'HIGHER IMPACT VELOCITY',
                desc: 'Maximize immediate momentum transfer.',
                nextScene: 'LEVEL_A1_RESULT'
              },
              {
                key: 'B',
                title: 'LOWER IMPACT VELOCITY',
                desc: 'Limit the severity of the initial collision.',
                nextScene: 'LEVEL_A2_RESULT'
              }
            ]
          }
        };

      case 'LEVEL_A1_RESULT':
        return {
          id: 'LEVEL_A1_RESULT',
          bgId: 'BG_F_KINETIC_IMPACT',
          title: 'IMPACT EXECUTION — HIGH VELOCITY',
          subtitle: 'MOMENTUM TRANSFER // MAXIMUM EJECTA RECOIL',
          asteroidState: 2,
          craftType: 'STRIKE-2',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_kin_high',
              expression: 'confident',
              text: 'Use the higher impact velocity. We need the largest practical momentum transfer.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_kin_high_res',
              expression: 'focused',
              text: 'Impact confirmed. A large amount of momentum has been transferred.'
            }
          ],
          endingTarget: 'A1'
        };

      case 'LEVEL_A2_RESULT':
        return {
          id: 'LEVEL_A2_RESULT',
          bgId: 'BG_F_KINETIC_IMPACT',
          title: 'IMPACT EXECUTION — LOWER VELOCITY',
          subtitle: 'MOMENTUM TRANSFER // CONTROLLED COLLISION',
          asteroidState: 2,
          craftType: 'STRIKE-2',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_kin_low',
              expression: 'serious',
              text: 'Use a lower impact velocity. Limit the severity of the initial collision.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_kin_low_res',
              expression: 'focused',
              text: 'Impact confirmed. The asteroid\'s trajectory has shifted slightly.'
            }
          ],
          endingTarget: 'A2'
        };

      // -------------------------------------------------------------
      // 2A-5: GRAVITY TRACTOR (BACKGROUND G)
      // -------------------------------------------------------------
      case 'LEVEL_3B_TRACTOR':
        return {
          id: 'LEVEL_3B_TRACTOR',
          bgId: 'BG_G_GRAVITY_TRACTOR',
          title: 'LEVEL 3B — GRAVITY TRACTOR FORMATION',
          subtitle: 'NON-CONTACT DEFLECTION // MUTUAL GRAVITATIONAL VECTOR',
          asteroidState: 2,
          craftType: 'GRAVITY TRACTOR',
          dialogues: [
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_trac_1',
              expression: 'focused',
              text: 'The spacecraft has entered formation with the asteroid.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_trac_2',
              expression: 'focused',
              text: 'We\'re using the spacecraft\'s gravity to gradually pull the asteroid.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_trac_3',
              expression: 'analytical',
              text: 'The force is extremely small, but every additional hour increases the accumulated trajectory change.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_trac_4',
              expression: 'thinking',
              text: 'How long should we maintain formation?'
            }
          ],
          decision: {
            id: 'D5',
            title: 'DECISION 5 — FORMATION DURATION',
            subtitle: 'Select formation flight duration:',
            options: [
              {
                key: 'A',
                title: 'STAY LONGER',
                desc: 'Maintain formation flight for maximum orbital deflection.',
                nextScene: 'LEVEL_A3_RESULT'
              },
              {
                key: 'B',
                title: 'LEAVE EARLY',
                desc: 'Break formation flight before completing the planned window.',
                nextScene: 'LEVEL_A4_RESULT'
              }
            ]
          }
        };

      case 'LEVEL_A3_RESULT':
        return {
          id: 'LEVEL_A3_RESULT',
          bgId: 'BG_G_GRAVITY_TRACTOR',
          title: 'TRACTOR DEPLOYMENT — SUSTAINED TOW',
          subtitle: 'LONG-DURATION FORMATION // MEASURABLE TRAJECTORY BEND',
          asteroidState: 2,
          craftType: 'GRAVITY TRACTOR',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_trac_stay',
              expression: 'confident',
              text: 'Stay with the asteroid. We need maximum trajectory change.'
            }
          ],
          endingTarget: 'A3'
        };

      case 'LEVEL_A4_RESULT':
        return {
          id: 'LEVEL_A4_RESULT',
          bgId: 'BG_G_GRAVITY_TRACTOR',
          title: 'TRACTOR DEPLOYMENT — EARLY ABORT',
          subtitle: 'SHORT FORMATION FLIGHT // MINIMAL ORBITAL SHIFT',
          asteroidState: 2,
          craftType: 'GRAVITY TRACTOR',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_trac_leave',
              expression: 'concerned',
              text: 'Break formation. We don\'t have enough time.'
            }
          ],
          endingTarget: 'A4'
        };

      // -------------------------------------------------------------
      // 3. BRANCH B — DIRECT IMPACT (BACKGROUND F)
      // -------------------------------------------------------------
      case 'LEVEL_2B':
        return {
          id: 'LEVEL_2B',
          bgId: 'BG_F_KINETIC_IMPACT',
          title: 'LEVEL 2B — DIRECT IMPACT (STRIKE-1)',
          subtitle: 'RAPID INTERCEPTION // UNKNOWN INTERNAL STRUCTURE',
          asteroidState: 1,
          craftType: 'STRIKE-1',
          dialogues: [
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_2b_1',
              expression: 'focused',
              text: 'STRIKE-1 is approaching the asteroid.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_2b_2',
              expression: 'concerned',
              text: 'We still don\'t know its internal structure.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_2b_3',
              expression: 'serious',
              text: 'If we hit the wrong area, the asteroid could react differently than expected.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_2b_4',
              expression: 'thinking',
              text: 'Then where should we aim?'
            }
          ],
          decision: {
            id: 'D6',
            title: 'DECISION 6 — TARGETING REGION',
            subtitle: 'Choose kinetic impact aim point:',
            options: [
              {
                key: 'A',
                title: 'TARGET THE CENTER',
                desc: 'Aim directly for the center of mass.',
                nextScene: 'LEVEL_3C_CENTRAL'
              },
              {
                key: 'B',
                title: 'TARGET A VISIBLY FRACTURED REGION',
                desc: 'Strike a visible structural fault line.',
                nextScene: 'LEVEL_3D_FRACTURED'
              }
            ]
          }
        };

      case 'LEVEL_3C_CENTRAL':
        return {
          id: 'LEVEL_3C_CENTRAL',
          bgId: 'BG_F_KINETIC_IMPACT',
          title: 'LEVEL 3C — CENTRAL IMPACT EXECUTION',
          subtitle: 'TERMINAL APPROACH // DIRECT DEFLECTION CONFIRMATION',
          asteroidState: 3,
          craftType: 'STRIKE-1',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_b_center',
              expression: 'confident',
              text: 'Aim directly for the center.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_cent_1',
              expression: 'focused',
              text: 'STRIKE-1 is entering the final approach.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_cent_2',
              expression: 'urgent',
              text: 'Impact in 5... 4... 3... 2... 1.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_cent_3',
              expression: 'relieved',
              text: 'Impact confirmed!'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_cent_4',
              expression: 'surprised',
              text: 'The asteroid\'s trajectory has changed.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_cent_5',
              expression: 'focused',
              text: 'Is the change enough?'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_cent_6',
              expression: 'focused',
              text: 'Trajectory solution confirmed.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_cent_7',
              expression: 'confident',
              text: 'The projected path has moved outside the critical Earth-impact corridor.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_cent_8',
              expression: 'relieved',
              text: 'The deflection is sufficient.'
            }
          ],
          endingTarget: 'B1'
        };

      case 'LEVEL_3D_FRACTURED':
        return {
          id: 'LEVEL_3D_FRACTURED',
          bgId: 'BG_H_FRAGMENTATION',
          title: 'LEVEL 3D — STRUCTURAL IMPACT & BREAKUP',
          subtitle: 'CATASTROPHIC DISRUPTION // MULTIPLE FRAGMENT CLOUD',
          asteroidState: 4,
          craftType: 'STRIKE-1',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_b_fractured',
              expression: 'serious',
              text: 'Target the visibly fractured region. We may transfer momentum differently, but we\'re taking a greater structural risk.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_frac_1',
              expression: 'focused',
              text: 'Impact confirmed.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_frac_2',
              expression: 'surprised',
              text: 'Wait... we\'re detecting multiple objects.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_frac_3',
              expression: 'concerned',
              text: 'The asteroid has fragmented!'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_frac_4',
              expression: 'urgent',
              text: 'How many fragments?'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_frac_5',
              expression: 'serious',
              text: 'We\'re tracking multiple fragments. Their trajectories are diverging.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_frac_6',
              expression: 'thinking',
              text: 'Then we need to decide what to do next.'
            }
          ],
          decision: {
            id: 'D7',
            title: 'DECISION 7 — FRAGMENT RESPONSE',
            subtitle: 'Choose action for multiple diverging fragments:',
            options: [
              {
                key: 'A',
                title: 'TRACK EVERY FRAGMENT',
                desc: 'Map individual trajectories before taking another physical action.',
                nextScene: 'LEVEL_B2_RESULT'
              },
              {
                key: 'B',
                title: 'SECONDARY INTERCEPTION',
                desc: 'Deploy interceptor craft against the primary hazard fragment.',
                nextScene: 'LEVEL_B3_RESULT'
              }
            ]
          }
        };

      case 'LEVEL_B2_RESULT':
        return {
          id: 'LEVEL_B2_RESULT',
          bgId: 'BG_H_FRAGMENTATION',
          title: 'RESPONSE: MULTI-FRAGMENT TRACKING',
          subtitle: 'SPACE SURVEILLANCE RADAR // ORBITAL CORRIDOR MONITORING',
          asteroidState: 5,
          craftType: 'STRIKE-1',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_frac_track',
              expression: 'serious',
              text: 'Don\'t make another impact yet. Track every fragment.'
            }
          ],
          endingTarget: 'B2'
        };

      case 'LEVEL_B3_RESULT':
        return {
          id: 'LEVEL_B3_RESULT',
          bgId: 'BG_H_FRAGMENTATION',
          title: 'RESPONSE: SECONDARY INTERCEPTION',
          subtitle: 'SECOND-TIER KINETIC IMPULSE // CRITICAL REMNANT INTERCEPT',
          asteroidState: 5,
          craftType: 'STRIKE-1',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_frac_intercept',
              expression: 'confident',
              text: 'Prepare another interception mission.'
            }
          ],
          endingTarget: 'B3'
        };

      // -------------------------------------------------------------
      // 4. BRANCH C — SAMPLE ANALYSIS (BACKGROUND I)
      // -------------------------------------------------------------
      case 'LEVEL_2C':
        return {
          id: 'LEVEL_2C',
          bgId: 'BG_I_SAMPLE_COLLECTION',
          title: 'LEVEL 2C — ORBITER-X SAMPLE COLLECTION',
          subtitle: 'PHYSICAL MATERIAL EXTRACTION // COMPOSITION STUDY',
          asteroidState: 1,
          craftType: 'ORBITER-X',
          dialogues: [
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_2c_1',
              expression: 'focused',
              text: 'ORBITER-X has reached the asteroid.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_2c_2',
              expression: 'analytical',
              text: 'We need physical material before deciding how to defend Earth.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_2c_3',
              expression: 'focused',
              text: 'I\'m detecting two possible sampling locations.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_2c_4',
              expression: 'thinking',
              text: 'Which locations?'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_2c_5',
              expression: 'analytical',
              text: 'One appears smooth and stable. The other contains loose, rocky material.'
            }
          ],
          decision: {
            id: 'D8',
            title: 'DECISION 8 — SAMPLING SITE SELECTION',
            subtitle: 'Choose extraction site:',
            options: [
              {
                key: 'A',
                title: 'SAMPLE THE SMOOTH REGION',
                desc: 'Collect material from the cohesive, stable surface.',
                nextScene: 'LEVEL_3E_SMOOTH'
              },
              {
                key: 'B',
                title: 'SAMPLE THE ROCKY REGION',
                desc: 'Collect material from the loose, fractured regolith.',
                nextScene: 'LEVEL_3F_ROCKY'
              }
            ]
          }
        };

      case 'LEVEL_3E_SMOOTH':
        return {
          id: 'LEVEL_3E_SMOOTH',
          bgId: 'BG_J_SAMPLE_ANALYSIS',
          title: 'LEVEL 3E — STABLE SURFACE ANALYSIS',
          subtitle: 'COHESIVE SAMPLE // PREDICTABLE IMPACT CALIBRATION',
          asteroidState: 3,
          craftType: 'ORBITER-X',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_c_smooth',
              expression: 'focused',
              text: 'Use the stable surface.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_sm_1',
              expression: 'focused',
              text: 'Sampling arm deployed.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_sm_2',
              expression: 'confident',
              text: 'Contact confirmed.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_sm_3',
              expression: 'relieved',
              text: 'Sample collected successfully.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_sm_4',
              expression: 'analytical',
              text: 'The sample appears relatively cohesive.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_sm_5',
              expression: 'thinking',
              text: 'So the material may respond more predictably to an impact.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_sm_6',
              expression: 'serious',
              text: 'We still have two possible defense strategies.'
            }
          ],
          decision: {
            id: 'D9',
            title: 'DECISION 9 — DEFENSE SELECTION (COMPACT)',
            subtitle: 'Select defense approach for cohesive asteroid:',
            options: [
              {
                key: 'A',
                title: 'BUILD A KINETIC IMPACTOR',
                desc: 'Prepare a precision kinetic impact mission.',
                nextScene: 'LEVEL_C1_RESULT'
              },
              {
                key: 'B',
                title: 'BUILD A GRAVITY TRACTOR',
                desc: 'Use gradual gravitational deflection instead.',
                nextScene: 'LEVEL_C2_RESULT'
              }
            ]
          }
        };

      case 'LEVEL_C1_RESULT':
        return {
          id: 'LEVEL_C1_RESULT',
          bgId: 'BG_F_KINETIC_IMPACT',
          title: 'DEFENSE EXECUTION — PRECISION IMPACTOR',
          subtitle: 'CALIBRATED MOMENTUM TRANSFER // COHESIVE TARGET',
          asteroidState: 3,
          craftType: 'STRIKE-1',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_sm_kinetic',
              expression: 'confident',
              text: 'Prepare a precision kinetic impact mission.'
            }
          ],
          endingTarget: 'C1'
        };

      case 'LEVEL_C2_RESULT':
        return {
          id: 'LEVEL_C2_RESULT',
          bgId: 'BG_G_GRAVITY_TRACTOR',
          title: 'DEFENSE EXECUTION — GRAVITY TRACTOR',
          subtitle: 'NON-CONTACT DEFLECTION // COMPACT MASS TOW',
          asteroidState: 3,
          craftType: 'GRAVITY TRACTOR',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_sm_tractor',
              expression: 'focused',
              text: 'Use gradual gravitational deflection instead.'
            }
          ],
          endingTarget: 'C2'
        };

      case 'LEVEL_3F_ROCKY':
        return {
          id: 'LEVEL_3F_ROCKY',
          bgId: 'BG_J_SAMPLE_ANALYSIS',
          title: 'LEVEL 3F — ROCKY REGION ANALYSIS',
          subtitle: 'FRAGMENTED SAMPLE // HIGH STRUCTURAL BREAKUP RISK',
          asteroidState: 4,
          craftType: 'ORBITER-X',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_c_rocky',
              expression: 'serious',
              text: 'Collect material from the rocky region.'
            },
            {
              speaker: 'MISSION_CONTROL',
              role: 'Mission Control',
              audioId: 'mc_rk_1',
              expression: 'focused',
              text: 'Sampling arm has reached the rocky region.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_rk_2',
              expression: 'confident',
              text: 'Sample collection complete.'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_rk_3',
              expression: 'concerned',
              text: 'The material is highly fragmented.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_rk_4',
              expression: 'thinking',
              text: 'So an impact could create even more fragments?'
            },
            {
              speaker: 'MAYA',
              role: 'Dr. Maya',
              audioId: 'maya_rk_5',
              expression: 'serious',
              text: 'Exactly.'
            },
            {
              speaker: 'LEO',
              role: 'Leo',
              audioId: 'leo_rk_6',
              expression: 'urgent',
              text: 'We need to avoid creating a larger fragmentation problem.'
            },
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_rk_7',
              expression: 'focused',
              text: 'Then we have two possible response strategies.'
            }
          ],
          decision: {
            id: 'D10',
            title: 'DECISION 10 — FRAGMENTATION DEFENSE',
            subtitle: 'Choose action for highly fragmented structure:',
            options: [
              {
                key: 'A',
                title: 'AVOID IMPACT',
                desc: 'Do not strike it. Prepare a gravity tractor.',
                nextScene: 'LEVEL_C3_RESULT'
              },
              {
                key: 'B',
                title: 'PREPARE FOR FRAGMENTATION',
                desc: 'Prepare interception systems for the resulting pieces.',
                nextScene: 'LEVEL_C4_RESULT'
              }
            ]
          }
        };

      case 'LEVEL_C3_RESULT':
        return {
          id: 'LEVEL_C3_RESULT',
          bgId: 'BG_G_GRAVITY_TRACTOR',
          title: 'DEFENSE: NON-CONTACT GRAVITY TRACTOR',
          subtitle: 'AVOIDING BREAKUP // CONTROLLED GENTLE DEFLECTION',
          asteroidState: 4,
          craftType: 'GRAVITY TRACTOR',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_rk_avoid',
              expression: 'serious',
              text: 'Do not strike it. Prepare a gravity tractor.'
            }
          ],
          endingTarget: 'C3'
        };

      case 'LEVEL_C4_RESULT':
        return {
          id: 'LEVEL_C4_RESULT',
          bgId: 'BG_H_FRAGMENTATION',
          title: 'DEFENSE: PRE-INTERCEPTION PREPARATION',
          subtitle: 'COORDINATED DEFENSE // INTERCEPTING RESULTING REMNANTS',
          asteroidState: 5,
          craftType: 'ORBITER-X',
          dialogues: [
            {
              speaker: 'ARI',
              role: 'Commander Ari',
              audioId: 'ari_rk_frag',
              expression: 'confident',
              text: 'If fragmentation is unavoidable, prepare interception systems for the resulting pieces.'
            }
          ],
          endingTarget: 'C4'
        };

      default:
        return this.getSceneData('LEVEL_1');
    }
  }
}

export const PlanetaryDefenseMissionInstance = new PlanetaryDefenseMission();
export { PlanetaryDefenseMission };
