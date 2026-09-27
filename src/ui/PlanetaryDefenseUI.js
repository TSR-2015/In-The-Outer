import { PlanetaryDefenseMissionInstance } from '../missions/PlanetaryDefenseMission.js';
import { PlanetaryDefenseSceneInstance } from '../scene/PlanetaryDefenseScene.js';
import { PlanetaryDefenseVisualsInstance } from '../scene/PlanetaryDefenseVisuals.js';
import { AudioInstance } from '../managers/AudioManager.js';
import { GameStateInstance } from '../managers/GameStateManager.js';

class PlanetaryDefenseUI {
  constructor() {
    this.currentDialogueIndex = 0;
    this.currentSceneData = null;
    this.dialogueTimer = null;
    this.mouthAnimInterval = null;
    this.activeAudio = null;
    this.isMuted = false;
    this.isVoicePlaying = false;
    this.speechAnimTick = 0;
    this.debugVisible = false;
  }

  init() {
    const pd = PlanetaryDefenseMissionInstance;

    this.setupUIControls();

    pd.onSceneUpdate = (sceneData) => {
      this.currentSceneData = sceneData;
      this.currentDialogueIndex = 0;

      // Update 2D Canvas Scene Engine
      PlanetaryDefenseSceneInstance.setSceneData(sceneData);

      // Hide decision panel & ending modal
      this.toggleDecisionPanel(false);
      this.toggleEndingCard(false);
      this.toggleConfirmationBanner(false);
      this.toggleDialoguePanel(true);

      this.updateDebugHUD();
      this.playNextDialogueStep();
    };

    pd.onEndingReached = (endingKey, endingData) => {
      this.stopCurrentVoice();
      this.toggleDialoguePanel(false);
      this.toggleDecisionPanel(false);
      this.toggleConfirmationBanner(false);
      this.showEndingCard(endingKey, endingData);
      this.updateDebugHUD(endingKey);
    };

    pd.startMission();
  }

  setupUIControls() {
    // Skip Button
    const skipBtn = document.getElementById('btn-pd-skip-dialogue');
    if (skipBtn) {
      skipBtn.onclick = () => {
        AudioInstance.playClick();
        this.skipCurrentDialogue();
      };
    }

    // Replay Line Button
    const replayBtn = document.getElementById('btn-pd-replay-line');
    if (replayBtn) {
      replayBtn.onclick = () => {
        AudioInstance.playClick();
        this.replayCurrentLine();
      };
    }

    // Voice Mute Toggle
    const muteBtn = document.getElementById('btn-pd-voice-mute');
    if (muteBtn) {
      muteBtn.onclick = () => {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
          this.stopCurrentVoice();
          muteBtn.textContent = 'VOICE: OFF';
          muteBtn.classList.add('muted');
        } else {
          muteBtn.textContent = 'VOICE: ON';
          muteBtn.classList.remove('muted');
          this.replayCurrentLine();
        }
      };
    }

    // Dev Debug Toggle (~ or click)
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~' || e.key === 'F2') {
        this.toggleDebugHUD();
      }
    });

    const debugToggleBtn = document.getElementById('btn-pd-debug-toggle');
    if (debugToggleBtn) {
      debugToggleBtn.onclick = () => this.toggleDebugHUD();
    }
  }

  playNextDialogueStep() {
    this.stopCurrentVoice();

    if (!this.currentSceneData || !this.currentSceneData.dialogues) return;

    if (this.currentDialogueIndex >= this.currentSceneData.dialogues.length) {
      // Finished all dialogue lines for current scene
      this.toggleDialoguePanel(false);

      if (this.currentSceneData.decision) {
        this.showDecisionPanel();
      } else if (this.currentSceneData.autoTransitionTo) {
        // Auto transition (e.g. Surface or Internal scan -> Combined analysis)
        setTimeout(() => {
          PlanetaryDefenseMissionInstance.loadScene(this.currentSceneData.autoTransitionTo);
        }, this.currentSceneData.autoTransitionDelay || 1000);
      } else if (this.currentSceneData.endingTarget) {
        // Direct consequence leading into an ending
        setTimeout(() => {
          PlanetaryDefenseMissionInstance.triggerEnding(this.currentSceneData.endingTarget);
        }, 1200);
      }
      return;
    }

    const item = this.currentSceneData.dialogues[this.currentDialogueIndex];
    this.renderDialogueLine(item);

    // Play Voice Audio with Mouth Animation Sync & Fallback
    this.playVoiceAudio(item, () => {
      // Auto-advance once spoken voice concludes
      this.currentDialogueIndex++;
      this.dialogueTimer = setTimeout(() => {
        this.playNextDialogueStep();
      }, 700);
    });
  }

  renderDialogueLine(item) {
    const charId = item.speaker.toLowerCase();
    const portraitImg = document.getElementById('pd-char-portrait-img');
    const speakerNameEl = document.getElementById('pd-speaker-name');
    const speakerRoleEl = document.getElementById('pd-speaker-role');
    const dialogueTextEl = document.getElementById('pd-dialogue-text');

    if (portraitImg) {
      portraitImg.src = PlanetaryDefenseVisualsInstance.drawCharacterPortrait(charId, item.expression, 240, false, 0);
    }
    if (speakerNameEl) speakerNameEl.textContent = item.speaker.replace('_', ' ').toUpperCase();
    if (speakerRoleEl) speakerRoleEl.textContent = item.role.toUpperCase();
    if (dialogueTextEl) dialogueTextEl.textContent = item.text;

    // Highlight active speaker in roster badges
    this.highlightActiveSpeakerBadge(item.speaker);
    this.updateDebugHUD();
  }

  playVoiceAudio(item, onFinish) {
    if (this.isMuted) {
      // Calculate reading duration based on word count (approx 200 words/min)
      const words = item.text.split(' ').length;
      const readingDuration = Math.max(2200, words * 380);
      this.dialogueTimer = setTimeout(onFinish, readingDuration);
      return;
    }

    this.isVoicePlaying = true;
    this.startMouthAnimation(item);

    const audioUrl = `audio/mission5/${item.audioId}.wav`;
    const audio = new Audio(audioUrl);
    this.activeAudio = audio;

    let hasFinished = false;
    const safeFinish = () => {
      if (hasFinished) return;
      hasFinished = true;
      this.isVoicePlaying = false;
      this.stopMouthAnimation(item);
      this.activeAudio = null;
      if (onFinish) onFinish();
    };

    audio.onended = safeFinish;

    audio.onerror = (err) => {
      console.warn(`[PlanetaryDefense Audio] Audio file unavailable (${audioUrl}), using Web Speech fallback:`, err);
      this.fallbackWebSpeech(item, safeFinish);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.warn('[PlanetaryDefense Audio] Autoplay policy prevented playback, falling back to Web Speech:', e);
        this.fallbackWebSpeech(item, safeFinish);
      });
    }
  }

  fallbackWebSpeech(item, onFinish) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(item.text);

        // Customize voice parameters based on speaker
        if (item.speaker === 'MAYA') {
          utterance.pitch = 1.15;
          utterance.rate = 1.0;
        } else if (item.speaker === 'ARI') {
          utterance.pitch = 0.9;
          utterance.rate = 0.9;
        } else if (item.speaker === 'LEO') {
          utterance.pitch = 1.05;
          utterance.rate = 1.1;
        } else {
          utterance.pitch = 1.0;
          utterance.rate = 1.0;
        }

        utterance.onend = () => {
          this.isVoicePlaying = false;
          this.stopMouthAnimation(item);
          if (onFinish) onFinish();
        };

        utterance.onerror = () => {
          this.isVoicePlaying = false;
          this.stopMouthAnimation(item);
          if (onFinish) onFinish();
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('SpeechSynthesis error:', e);
      }
    }

    // Ultimate fallback: Text timing timer
    const words = item.text.split(' ').length;
    const readingDuration = Math.max(2200, words * 380);
    this.dialogueTimer = setTimeout(() => {
      this.isVoicePlaying = false;
      this.stopMouthAnimation(item);
      if (onFinish) onFinish();
    }, readingDuration);
  }

  startMouthAnimation(item) {
    if (this.mouthAnimInterval) clearInterval(this.mouthAnimInterval);
    const charId = item.speaker.toLowerCase();
    const portraitImg = document.getElementById('pd-char-portrait-img');
    if (!portraitImg) return;

    this.speechAnimTick = 0;
    this.mouthAnimInterval = setInterval(() => {
      this.speechAnimTick += 0.2;
      portraitImg.src = PlanetaryDefenseVisualsInstance.drawCharacterPortrait(
        charId,
        item.expression,
        240,
        this.isVoicePlaying,
        this.speechAnimTick
      );
    }, 120);
  }

  stopMouthAnimation(item) {
    if (this.mouthAnimInterval) {
      clearInterval(this.mouthAnimInterval);
      this.mouthAnimInterval = null;
    }
    const charId = item.speaker.toLowerCase();
    const portraitImg = document.getElementById('pd-char-portrait-img');
    if (portraitImg) {
      portraitImg.src = PlanetaryDefenseVisualsInstance.drawCharacterPortrait(charId, item.expression, 240, false, 0);
    }
  }

  stopCurrentVoice() {
    if (this.dialogueTimer) {
      clearTimeout(this.dialogueTimer);
      this.dialogueTimer = null;
    }
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {}
      this.activeAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    this.isVoicePlaying = false;
    if (this.mouthAnimInterval) {
      clearInterval(this.mouthAnimInterval);
      this.mouthAnimInterval = null;
    }
  }

  skipCurrentDialogue() {
    this.stopCurrentVoice();
    this.currentDialogueIndex++;
    this.playNextDialogueStep();
  }

  replayCurrentLine() {
    this.stopCurrentVoice();
    if (!this.currentSceneData || !this.currentSceneData.dialogues) return;
    const item = this.currentSceneData.dialogues[this.currentDialogueIndex];
    if (item) {
      this.renderDialogueLine(item);
      this.playVoiceAudio(item, () => {
        this.currentDialogueIndex++;
        this.dialogueTimer = setTimeout(() => {
          this.playNextDialogueStep();
        }, 700);
      });
    }
  }

  highlightActiveSpeakerBadge(speakerKey) {
    const badges = document.querySelectorAll('.pd-roster-badge');
    badges.forEach(b => {
      if (b.dataset.speaker === speakerKey.toLowerCase()) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  showDecisionPanel() {
    const decisionData = this.currentSceneData ? this.currentSceneData.decision : null;
    if (!decisionData) return;

    AudioInstance.playAlarm();

    const titleEl = document.getElementById('pd-decision-title');
    const subEl = document.getElementById('pd-decision-sub');
    const optionsGrid = document.getElementById('pd-decision-options');

    if (titleEl) titleEl.textContent = decisionData.title;
    if (subEl) subEl.textContent = decisionData.subtitle;

    if (optionsGrid) {
      optionsGrid.innerHTML = '';
      decisionData.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'pd-decision-btn font-mono';
        btn.innerHTML = `
          <div class="pd-btn-header">
            <span class="pd-btn-key">[ ${opt.key} ]</span>
            <span class="pd-btn-title">${opt.title}</span>
          </div>
          <div class="pd-btn-desc">${opt.desc}</div>
        `;

        btn.onclick = () => {
          this.confirmAndMakeDecision(opt);
        };

        optionsGrid.appendChild(btn);
      });
    }

    this.toggleDecisionPanel(true);
    this.updateDebugHUD();
  }

  confirmAndMakeDecision(option) {
    AudioInstance.playSelectProbe();
    this.toggleDecisionPanel(false);

    // Show Decision Confirmation Suspense Banner for 1.2 seconds
    this.showConfirmationBanner(option.title);

    setTimeout(() => {
      this.toggleConfirmationBanner(false);
      PlanetaryDefenseMissionInstance.makeDecision(option.key);
    }, 1200);
  }

  showConfirmationBanner(optionTitle) {
    const banner = document.getElementById('pd-decision-confirm-banner');
    const bannerText = document.getElementById('pd-confirm-choice-text');
    if (banner && bannerText) {
      bannerText.textContent = optionTitle;
      banner.classList.remove('hidden');
      banner.classList.add('active');
    }
  }

  toggleConfirmationBanner(show) {
    const banner = document.getElementById('pd-decision-confirm-banner');
    if (!banner) return;
    if (show) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
  }

  showEndingCard(endingKey, endingData) {
    const cardModal = document.getElementById('pd-ending-modal');
    if (!cardModal) return;

    const keyEl = document.getElementById('pd-ending-key');
    const titleEl = document.getElementById('pd-ending-title');
    const statusEl = document.getElementById('pd-ending-status');
    const happenedEl = document.getElementById('pd-ending-happened');
    const learnedEl = document.getElementById('pd-ending-learned');
    const replayBtn = document.getElementById('btn-pd-replay');
    const mapBtn = document.getElementById('btn-pd-map');

    if (keyEl) keyEl.textContent = `ENDING ${endingData.code || endingKey}`;
    if (titleEl) titleEl.textContent = endingData.title;
    if (statusEl) statusEl.textContent = endingData.status || 'MISSION OUTCOME SECURED';
    if (happenedEl) happenedEl.textContent = endingData.whatHappened;
    if (learnedEl) learnedEl.textContent = endingData.whatYouLearned;

    if (replayBtn) {
      replayBtn.onclick = () => {
        AudioInstance.playClick();
        this.toggleEndingCard(false);
        PlanetaryDefenseMissionInstance.startMission();
      };
    }

    if (mapBtn) {
      mapBtn.onclick = () => {
        AudioInstance.playClick();
        this.toggleEndingCard(false);
        GameStateInstance.changeState('PROGRESS');
      };
    }

    this.toggleEndingCard(true);
  }

  toggleDialoguePanel(show) {
    const el = document.getElementById('pd-dialogue-panel');
    if (!el) return;
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  toggleDecisionPanel(show) {
    const el = document.getElementById('pd-decision-panel');
    if (!el) return;
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  toggleEndingCard(show) {
    const modal = document.getElementById('pd-ending-modal');
    if (!modal) return;
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
      modal.style.display = 'flex';
    } else {
      modal.classList.remove('active');
      modal.classList.add('hidden');
      modal.style.display = '';
    }
  }

  toggleDebugHUD() {
    this.debugVisible = !this.debugVisible;
    const dbgEl = document.getElementById('pd-debug-overlay');
    if (!dbgEl) return;
    if (this.debugVisible) dbgEl.classList.remove('hidden');
    else dbgEl.classList.add('hidden');
  }

  updateDebugHUD(endingKey = null) {
    const sceneEl = document.getElementById('dbg-scene-id');
    const decisionEl = document.getElementById('dbg-decision-id');
    const endingEl = document.getElementById('dbg-ending-id');
    const audioEl = document.getElementById('dbg-audio-status');

    if (sceneEl) sceneEl.textContent = this.currentSceneData ? this.currentSceneData.id : '--';
    if (decisionEl) {
      decisionEl.textContent =
        this.currentSceneData && this.currentSceneData.decision
          ? this.currentSceneData.decision.id || 'ACTIVE'
          : 'NONE';
    }
    if (endingEl) endingEl.textContent = endingKey || (this.currentSceneData?.endingTarget || '--');
    if (audioEl) audioEl.textContent = this.isMuted ? 'MUTED' : this.isVoicePlaying ? 'PLAYING' : 'IDLE';
  }
}

export const PlanetaryDefenseUIInstance = new PlanetaryDefenseUI();
export { PlanetaryDefenseUI };
