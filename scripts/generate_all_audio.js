import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = 'd:/pr/public/audio/mission5';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Master list of all spoken dialogue lines in Mission 5
const dialogueLines = [
  // LEVEL 1: OPENING SCENE
  { id: 'ari_open_1', speaker: 'ARI', text: 'Mission Control, report.' },
  { id: 'leo_open_2', speaker: 'LEO', text: "Commander, we've detected a potentially hazardous asteroid on a trajectory that could intersect Earth's orbital region." },
  { id: 'maya_open_3', speaker: 'MAYA', text: "We don't know enough about its structure. It could be a solid body, or it could be a loosely packed rubble pile." },
  { id: 'ari_open_4', speaker: 'ARI', text: 'How much time do we have?' },
  { id: 'leo_open_5', speaker: 'LEO', text: 'Limited time. We need to decide what mission to send.' },

  // LEVEL 2A: ASTRA-1 RECONNAISSANCE
  { id: 'mc_2a_1', speaker: 'MISSION_CONTROL', text: 'ASTRA-1 has launched and is approaching the asteroid.' },
  { id: 'ari_2a_2', speaker: 'ARI', text: 'Keep the spacecraft on observation mode. We need as much information as possible.' },
  { id: 'maya_2a_3', speaker: 'MAYA', text: 'We can investigate the asteroid in two different ways.' },

  // SURFACE ANALYSIS
  { id: 'leo_surf_1', speaker: 'LEO', text: "Surface scan complete. We're seeing large boulders separated by loose material." },
  { id: 'maya_surf_2', speaker: 'MAYA', text: "That suggests weak surface cohesion, but we still don't know what's underneath." },

  // INTERNAL STRUCTURE ANALYSIS
  { id: 'maya_int_1', speaker: 'MAYA', text: "We'll use radar and spacecraft measurements to estimate how material is distributed beneath the surface." },
  { id: 'maya_int_2', speaker: 'MAYA', text: 'Internal scan complete. The measurements show significant low-density regions beneath the surface.' },
  { id: 'leo_int_3', speaker: 'LEO', text: "So this isn't a solid body." },

  // COMBINED ANALYSIS
  { id: 'maya_comb_1', speaker: 'MAYA', text: 'Combining the measurements, the asteroid is very likely a rubble-pile structure.' },
  { id: 'leo_comb_2', speaker: 'LEO', text: 'That changes our options. A direct impact might not behave the way we expect.' },
  { id: 'ari_comb_3', speaker: 'ARI', text: 'Then we need to choose our defense carefully.' },

  // LEVEL 3A: KINETIC IMPACT APPROACH
  { id: 'mc_kin_1', speaker: 'MISSION_CONTROL', text: 'The impactor is approaching the asteroid.' },
  { id: 'maya_kin_2', speaker: 'MAYA', text: 'Impact velocity will determine how much momentum we transfer.' },
  { id: 'leo_kin_3', speaker: 'LEO', text: 'We have two possible approaches.' },
  { id: 'ari_kin_high', speaker: 'ARI', text: 'Use the higher impact velocity. We need the largest practical momentum transfer.' },
  { id: 'mc_kin_high_res', speaker: 'MISSION_CONTROL', text: 'Impact confirmed. A large amount of momentum has been transferred.' },
  { id: 'ari_kin_low', speaker: 'ARI', text: 'Use a lower impact velocity. Limit the severity of the initial collision.' },
  { id: 'mc_kin_low_res', speaker: 'MISSION_CONTROL', text: "Impact confirmed. The asteroid's trajectory has shifted slightly." },

  // LEVEL 3B: GRAVITY TRACTOR
  { id: 'mc_trac_1', speaker: 'MISSION_CONTROL', text: 'The spacecraft has entered formation with the asteroid.' },
  { id: 'leo_trac_2', speaker: 'LEO', text: "We're using the spacecraft's gravity to gradually pull the asteroid." },
  { id: 'maya_trac_3', speaker: 'MAYA', text: 'The force is extremely small, but every additional hour increases the accumulated trajectory change.' },
  { id: 'ari_trac_4', speaker: 'ARI', text: 'How long should we maintain formation?' },
  { id: 'ari_trac_stay', speaker: 'ARI', text: 'Stay with the asteroid. We need maximum trajectory change.' },
  { id: 'ari_trac_leave', speaker: 'ARI', text: "Break formation. We don't have enough time." },

  // BRANCH B: DIRECT IMPACT (STRIKE-1)
  { id: 'mc_2b_1', speaker: 'MISSION_CONTROL', text: 'STRIKE-1 is approaching the asteroid.' },
  { id: 'maya_2b_2', speaker: 'MAYA', text: "We still don't know its internal structure." },
  { id: 'leo_2b_3', speaker: 'LEO', text: 'If we hit the wrong area, the asteroid could react differently than expected.' },
  { id: 'ari_2b_4', speaker: 'ARI', text: 'Then where should we aim?' },
  { id: 'ari_b_center', speaker: 'ARI', text: 'Aim directly for the center.' },
  { id: 'ari_b_fractured', speaker: 'ARI', text: "Target the visibly fractured region. We may transfer momentum differently, but we're taking a greater structural risk." },

  // CENTRAL IMPACT (LEVEL 3C)
  { id: 'mc_cent_1', speaker: 'MISSION_CONTROL', text: 'STRIKE-1 is entering the final approach.' },
  { id: 'leo_cent_2', speaker: 'LEO', text: 'Impact in 5... 4... 3... 2... 1.' },
  { id: 'mc_cent_3', speaker: 'MISSION_CONTROL', text: 'Impact confirmed!' },
  { id: 'maya_cent_4', speaker: 'MAYA', text: "The asteroid's trajectory has changed." },
  { id: 'ari_cent_5', speaker: 'ARI', text: 'Is the change enough?' },
  { id: 'mc_cent_6', speaker: 'MISSION_CONTROL', text: 'Trajectory solution confirmed.' },
  { id: 'leo_cent_7', speaker: 'LEO', text: 'The projected path has moved outside the critical Earth-impact corridor.' },
  { id: 'maya_cent_8', speaker: 'MAYA', text: 'The deflection is sufficient.' },

  // STRUCTURAL IMPACT (LEVEL 3D)
  { id: 'mc_frac_1', speaker: 'MISSION_CONTROL', text: 'Impact confirmed.' },
  { id: 'leo_frac_2', speaker: 'LEO', text: "Wait... we're detecting multiple objects." },
  { id: 'maya_frac_3', speaker: 'MAYA', text: 'The asteroid has fragmented!' },
  { id: 'ari_frac_4', speaker: 'ARI', text: 'How many fragments?' },
  { id: 'leo_frac_5', speaker: 'LEO', text: "We're tracking multiple fragments. Their trajectories are diverging." },
  { id: 'ari_frac_6', speaker: 'ARI', text: 'Then we need to decide what to do next.' },
  { id: 'ari_frac_track', speaker: 'ARI', text: "Don't make another impact yet. Track every fragment." },
  { id: 'ari_frac_intercept', speaker: 'ARI', text: 'Prepare another interception mission.' },

  // BRANCH C: SAMPLE ANALYSIS (ORBITER-X)
  { id: 'mc_2c_1', speaker: 'MISSION_CONTROL', text: 'ORBITER-X has reached the asteroid.' },
  { id: 'maya_2c_2', speaker: 'MAYA', text: 'We need physical material before deciding how to defend Earth.' },
  { id: 'leo_2c_3', speaker: 'LEO', text: 'I am detecting two possible sampling locations.' },
  { id: 'ari_2c_4', speaker: 'ARI', text: 'Which locations?' },
  { id: 'leo_2c_5', speaker: 'LEO', text: 'One appears smooth and stable. The other contains loose, rocky material.' },
  { id: 'ari_c_smooth', speaker: 'ARI', text: 'Use the stable surface.' },
  { id: 'ari_c_rocky', speaker: 'ARI', text: 'Collect material from the rocky region.' },

  // STABLE SURFACE SAMPLE (LEVEL 3E)
  { id: 'mc_sm_1', speaker: 'MISSION_CONTROL', text: 'Sampling arm deployed.' },
  { id: 'leo_sm_2', speaker: 'LEO', text: 'Contact confirmed.' },
  { id: 'mc_sm_3', speaker: 'MISSION_CONTROL', text: 'Sample collected successfully.' },
  { id: 'maya_sm_4', speaker: 'MAYA', text: 'The sample appears relatively cohesive.' },
  { id: 'ari_sm_5', speaker: 'ARI', text: 'So the material may respond more predictably to an impact.' },
  { id: 'maya_sm_6', speaker: 'MAYA', text: 'We still have two possible defense strategies.' },
  { id: 'ari_sm_kinetic', speaker: 'ARI', text: 'Prepare a precision kinetic impact mission.' },
  { id: 'ari_sm_tractor', speaker: 'ARI', text: 'Use gradual gravitational deflection instead.' },

  // ROCKY REGION SAMPLE (LEVEL 3F)
  { id: 'mc_rk_1', speaker: 'MISSION_CONTROL', text: 'Sampling arm has reached the rocky region.' },
  { id: 'leo_rk_2', speaker: 'LEO', text: 'Sample collection complete.' },
  { id: 'maya_rk_3', speaker: 'MAYA', text: 'The material is highly fragmented.' },
  { id: 'ari_rk_4', speaker: 'ARI', text: 'So an impact could create even more fragments?' },
  { id: 'maya_rk_5', speaker: 'MAYA', text: 'Exactly.' },
  { id: 'leo_rk_6', speaker: 'LEO', text: 'We need to avoid creating a larger fragmentation problem.' },
  { id: 'ari_rk_7', speaker: 'ARI', text: 'Then we have two possible response strategies.' },
  { id: 'ari_rk_avoid', speaker: 'ARI', text: 'Do not strike it. Prepare a gravity tractor.' },
  { id: 'ari_rk_frag', speaker: 'ARI', text: 'If fragmentation is unavoidable, prepare interception systems for the resulting pieces.' }
];

console.log(`Generating audio for ${dialogueLines.length} lines...`);

// Batch all items into a single PowerShell script for maximum speed and efficiency
let psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
`;

for (const line of dialogueLines) {
  const wavPath = path.join(outDir, `${line.id}.wav`).replace(/\\/g, '/');
  // Configure voice settings:
  let voiceSelect = '';
  let rate = 0;
  if (line.speaker === 'MAYA') {
    voiceSelect = '$synth.SelectVoice("Microsoft Zira Desktop")';
    rate = 0;
  } else if (line.speaker === 'ARI') {
    voiceSelect = '$synth.SelectVoice("Microsoft David Desktop")';
    rate = -1; // Calm, deliberate commander pace
  } else if (line.speaker === 'LEO') {
    voiceSelect = '$synth.SelectVoice("Microsoft David Desktop")';
    rate = 1; // Agile flight specialist pace
  } else {
    // MISSION_CONTROL
    voiceSelect = '$synth.SelectVoice("Microsoft David Desktop")';
    rate = 0;
  }

  const escapedText = line.text.replace(/'/g, "''");
  psScript += `
${voiceSelect}
$synth.Rate = ${rate}
$synth.SetOutputToWaveFile('${wavPath}')
$synth.Speak('${escapedText}')
`;
}

psScript += `
$synth.Dispose()
Write-Host "ALL AUDIO GENERATION COMPLETE"
`;

const psPath = path.join(outDir, 'generate_batch.ps1').replace(/\\/g, '/');
fs.writeFileSync(psPath, psScript, 'utf8');

console.log('Executing batch synthesis in PowerShell via script file...');
execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { stdio: 'inherit' });

// Verify all files
let count = 0;
for (const line of dialogueLines) {
  const p = path.join(outDir, `${line.id}.wav`);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) {
    count++;
  } else {
    console.warn('Missing or small file:', line.id);
  }
}

console.log(`Verified ${count} / ${dialogueLines.length} audio files successfully generated.`);

// Clean up temporary script
try { fs.unlinkSync(psPath); } catch (e) {}
