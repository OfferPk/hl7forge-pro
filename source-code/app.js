/**
 * HL7Forge Pro - Web Application Interactive Controller
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var Engine = window.HL7ProtocolEngine;
  var Auditor = window.HL7SecurityAuditor;
  var Synthesizer = window.HL7ConfigSynthesizer;

  var currentEr7String = '';
  var currentMllpBytes = null;

  // Tab Navigation
  var tabButtons = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      tabContents.forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var targetId = btn.getAttribute('data-tab');
      var targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Tab 1: Message Studio Controls
  var msgTypeSelect = document.getElementById('builder-msg-type');
  var sendAppInput = document.getElementById('builder-send-app');
  var sendFacInput = document.getElementById('builder-send-fac');
  var recAppInput = document.getElementById('builder-rec-app');
  var recFacInput = document.getElementById('builder-rec-fac');
  var patientIdInput = document.getElementById('builder-patient-id');
  var patientNameInput = document.getElementById('builder-patient-name');
  var dobInput = document.getElementById('builder-dob');
  var sexSelect = document.getElementById('builder-sex');
  var patientClassSelect = document.getElementById('builder-patient-class');
  var oruFieldsDiv = document.getElementById('oru-fields');
  var loincInput = document.getElementById('builder-loinc');
  var obsValInput = document.getElementById('builder-obs-val');
  var unitsInput = document.getElementById('builder-units');

  var btnGenerateHl7 = document.getElementById('btn-generate-hl7');
  var btnExportPcap = document.getElementById('btn-export-mllp-pcap');
  var btnLoadVitalsPreset = document.getElementById('btn-load-vitals-preset');

  var rawEr7Input = document.getElementById('raw-er7-input');
  var btnDissectEr7 = document.getElementById('btn-dissect-er7');
  var dissectionTree = document.getElementById('dissection-tree');
  var packetLengthBadge = document.getElementById('packet-length-badge');
  var dissectionValidityBadge = document.getElementById('dissection-validity-badge');

  function toggleOruFields() {
    if (msgTypeSelect.value.indexOf('ORU') === 0) {
      oruFieldsDiv.style.display = 'block';
    } else {
      oruFieldsDiv.style.display = 'none';
    }
  }

  msgTypeSelect.addEventListener('change', toggleOruFields);

  function synthesizeCurrentMessage() {
    var isOru = msgTypeSelect.value.indexOf('ORU') === 0;

    var er7 = Engine.buildHl7Message({
      messageType: msgTypeSelect.value,
      sendingApp: sendAppInput.value || 'EPIC_EHR',
      sendingFacility: sendFacInput.value || 'MEMORIAL_HOSPITAL',
      receivingApp: recAppInput.value || 'LAB_SYS',
      receivingFacility: recFacInput.value || 'CENTRAL_PATHOLOGY',
      patientId: patientIdInput.value || 'MRN_98765432',
      patientName: patientNameInput.value || 'DOE^JOHN^A',
      dob: dobInput.value || '19840512',
      sex: sexSelect.value,
      patientClass: patientClassSelect.value,
      loincCode: isOru ? (loincInput.value.split('^')[0] || '8867-4') : '',
      loincDisplay: isOru ? (loincInput.value.split('^')[1] || 'Heart Rate') : '',
      observationValue: isOru ? (obsValInput.value || '78') : '',
      units: isOru ? (unitsInput.value || 'bpm') : ''
    });

    currentEr7String = er7;
    currentMllpBytes = Engine.wrapMllp(er7);
    updateDissection(er7);
    updateFhirSource(er7);
    updateAnonSource(er7);
  }

  function updateDissection(er7) {
    if (!er7) return;
    rawEr7Input.value = er7;
    packetLengthBadge.textContent = er7.length + ' Chars (' + currentMllpBytes.length + 'B MLLP)';

    var res = Engine.dissectHl7(er7);

    if (res.valid) {
      dissectionValidityBadge.className = 'badge badge-pass';
      dissectionValidityBadge.textContent = 'VALID HL7 v2.5.1';
    } else {
      dissectionValidityBadge.className = 'badge badge-fail';
      dissectionValidityBadge.textContent = 'MALFORMED / ERROR';
    }

    var treeHtml = '';
    if (res.metadata) {
      var m = res.metadata;
      treeHtml += '<div class="dissection-item"><span class="dissection-label">Message Type:</span><span class="dissection-value">' + (m.messageType || 'Unknown') + '</span></div>';
      treeHtml += '<div class="dissection-item"><span class="dissection-label">Sending App / Facility:</span><span class="dissection-value">' + (m.sendingApp || '-') + ' (' + (m.sendingFacility || '-') + ')</span></div>';
      treeHtml += '<div class="dissection-item"><span class="dissection-label">Receiving App / Facility:</span><span class="dissection-value">' + (m.receivingApp || '-') + ' (' + (m.receivingFacility || '-') + ')</span></div>';
      treeHtml += '<div class="dissection-item"><span class="dissection-label">Patient MRN:</span><span class="dissection-value">' + (m.patientId || '-') + '</span></div>';
      treeHtml += '<div class="dissection-item"><span class="dissection-label">Patient Name:</span><span class="dissection-value">' + (m.patientName || '-') + '</span></div>';
      if (m.assignedLocation) {
        treeHtml += '<div class="dissection-item"><span class="dissection-label">Assigned Location:</span><span class="dissection-value">' + m.assignedLocation + '</span></div>';
      }
      if (m.observations && m.observations.length > 0) {
        m.observations.forEach(function (obs, idx) {
          treeHtml += '<div class="dissection-item" style="background: rgba(16,185,129,0.05);"><span class="dissection-label">Observation #' + (idx + 1) + ':</span><span class="dissection-value">' + obs.identifier + ' = ' + obs.value + ' ' + obs.units + ' (' + obs.status + ')</span></div>';
        });
      }
    }

    if (res.segments) {
      treeHtml += '<div class="dissection-item"><span class="dissection-label">Segments Parsed:</span><span class="dissection-value">' + res.segmentCount + ' segments (' + res.segments.map(function(s){return s.segment;}).join(', ') + ')</span></div>';
    }

    if (res.error) {
      treeHtml += '<div class="dissection-item" style="color: var(--accent-red);"><span class="dissection-label">Error:</span><span>' + res.error + '</span></div>';
    }

    dissectionTree.innerHTML = treeHtml;
  }

  btnGenerateHl7.addEventListener('click', synthesizeCurrentMessage);

  btnDissectEr7.addEventListener('click', function () {
    var raw = rawEr7Input.value;
    currentEr7String = raw;
    currentMllpBytes = Engine.wrapMllp(raw);
    updateDissection(raw);
    updateFhirSource(raw);
    updateAnonSource(raw);
  });

  btnExportPcap.addEventListener('click', function () {
    if (!currentMllpBytes) synthesizeCurrentMessage();
    var pcapBytes = Engine.exportPcap([currentMllpBytes], false);
    var blob = new Blob([pcapBytes], { type: 'application/vnd.tcpdump.pcap' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'hl7-mllp-session.pcap';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  btnLoadVitalsPreset.addEventListener('click', function () {
    msgTypeSelect.value = 'ORU^R01^ORU_R01';
    toggleOruFields();
    loincInput.value = '8867-4^Heart Rate^LN';
    obsValInput.value = '72';
    unitsInput.value = 'bpm';
    synthesizeCurrentMessage();
  });

  // Tab 2: FHIR Converter
  var fhirSourceBox = document.getElementById('fhir-source-er7');
  var fhirOutputBox = document.getElementById('fhir-output-box');
  var btnTriggerConvert = document.getElementById('btn-trigger-convert');
  var btnCopyFhir = document.getElementById('btn-copy-fhir');

  function updateFhirSource(er7) {
    if (fhirSourceBox) fhirSourceBox.textContent = er7;
  }

  function executeFhirConversion() {
    try {
      var fhirJson = Engine.convertHl7ToFhir(currentEr7String);
      fhirOutputBox.textContent = JSON.stringify(fhirJson, null, 2);
    } catch (e) {
      fhirOutputBox.textContent = 'Translation Error: ' + e.message;
    }
  }

  btnTriggerConvert.addEventListener('click', executeFhirConversion);

  btnCopyFhir.addEventListener('click', function () {
    navigator.clipboard.writeText(fhirOutputBox.textContent);
    alert('Copied FHIR R4 JSON to clipboard.');
  });

  // Tab 3: Anonymizer Controls
  var anonSourceBox = document.getElementById('anon-source-box');
  var anonTargetBox = document.getElementById('anon-target-box');
  var btnRunAnon = document.getElementById('btn-run-anon');

  function updateAnonSource(er7) {
    if (anonSourceBox) anonSourceBox.textContent = er7;
  }

  function executeAnonymization() {
    var res = Engine.anonymizeHl7(currentEr7String);
    var text = '=== HIPAA SAFE HARBOR DE-IDENTIFICATION SUMMARY ===\n';
    text += 'Pseudonym Assigned: ' + res.pseudonym + '\n';
    text += 'Synthetic MRN: ' + res.pseudoId + '\n';
    text += 'HIPAA Safe Harbor Compliant: ' + res.hipaaSafeHarborCompliant + '\n\n';
    text += '=== SANITIZED HL7 ER7 STREAM ===\n';
    text += res.sanitizedEr7;
    anonTargetBox.textContent = text;
  }

  btnRunAnon.addEventListener('click', executeAnonymization);

  // Tab 4: Security Auditor Controls
  var auditScoreValue = document.getElementById('audit-score-value');
  var auditGradeValue = document.getElementById('audit-grade-value');
  var auditCriticalCount = document.getElementById('audit-critical-count');
  var auditResultsTbody = document.getElementById('audit-results-tbody');
  var btnRunAudit = document.getElementById('btn-run-audit');
  var btnLoadSecureProfile = document.getElementById('btn-load-secure-profile');
  var btnLoadVulnerableProfile = document.getElementById('btn-load-vulnerable-profile');

  function getAuditorProfileFromInputs() {
    var tlsVal = document.getElementById('audit-param-tls').value;
    var smartVal = document.getElementById('audit-param-smart').value === 'enforced';
    var mshVal = document.getElementById('audit-param-msh').value === 'strict';
    var vlanVal = document.getElementById('audit-param-vlan').value === 'isolated';
    var atnaVal = document.getElementById('audit-param-atna').value === 'active';

    return {
      tlsEnabled: tlsVal !== 'none',
      tlsVersion: tlsVal === 'none' ? '' : tlsVal,
      smartOnFhirEnabled: smartVal,
      granularScopesEnforced: smartVal,
      jwtSignatureValidated: smartVal,
      mshWhitelistingEnabled: mshVal,
      dropUnauthorizedFacilities: mshVal,
      anonymizationEnabled: true,
      strip18HipaaIdentifiers: true,
      pseudonymizePatientIds: true,
      iheAtnaLogging: atnaVal,
      logAllMessageTransactions: atnaVal,
      rateLimitMllp: true,
      maxMllpConnectionsPerSec: 20,
      msh10Tracking: true,
      dropDuplicateControlIds: true,
      vlanIsolation: vlanVal,
      ehrVlanId: 100,
      guestVlanId: 500,
      nftablesFirewallActive: true,
      blockUntrustedEndpoints: true,
      idsLoggingEnabled: true,
      dpiSuricataSignaturesActive: true
    };
  }

  function executeAudit() {
    var profile = getAuditorProfileFromInputs();
    var res = Auditor.auditDeployment(profile);

    auditScoreValue.textContent = res.score + '%';
    auditGradeValue.textContent = 'Grade: ' + res.grade + ' (' + res.complianceStatus + ')';
    auditCriticalCount.textContent = res.summary.criticalVulnerabilities;

    if (res.score >= 90) {
      auditScoreValue.style.color = 'var(--accent-green)';
    } else if (res.score >= 70) {
      auditScoreValue.style.color = 'var(--accent-amber)';
    } else {
      auditScoreValue.style.color = 'var(--accent-red)';
    }

    var tbodyHtml = '';
    res.findings.forEach(function (f) {
      var badgeClass = f.pass ? 'badge-pass' : 'badge-fail';
      tbodyHtml += '<tr>';
      tbodyHtml += '<td style="font-family: var(--font-mono); font-weight: 600;">' + f.id + '</td>';
      tbodyHtml += '<td><strong>' + f.title + '</strong><br><span style="font-size: 11px; color: var(--text-secondary);">' + f.detail + '</span></td>';
      tbodyHtml += '<td><span class="badge ' + badgeClass + '">' + (f.pass ? 'PASS' : f.severity) + '</span></td>';
      tbodyHtml += '</tr>';
    });

    auditResultsTbody.innerHTML = tbodyHtml;
  }

  btnRunAudit.addEventListener('click', executeAudit);

  btnLoadSecureProfile.addEventListener('click', function () {
    document.getElementById('audit-param-tls').value = 'TLSv1.3';
    document.getElementById('audit-param-smart').value = 'enforced';
    document.getElementById('audit-param-msh').value = 'strict';
    document.getElementById('audit-param-vlan').value = 'isolated';
    document.getElementById('audit-param-atna').value = 'active';
    executeAudit();
  });

  btnLoadVulnerableProfile.addEventListener('click', function () {
    document.getElementById('audit-param-tls').value = 'none';
    document.getElementById('audit-param-smart').value = 'disabled';
    document.getElementById('audit-param-msh').value = 'open';
    document.getElementById('audit-param-vlan').value = 'flat';
    document.getElementById('audit-param-atna').value = 'disabled';
    executeAudit();
  });

  // Tab 5: Synthesizer Outputs
  var nftablesBox = document.getElementById('nftables-output');
  var suricataBox = document.getElementById('suricata-output');

  function updateSynthesizerOutputs() {
    nftablesBox.textContent = Synthesizer.generateNftablesRules({
      mllpPort: 2575,
      fhirPort: 8443,
      allowPlaintext: false,
      clinicalInterface: 'eth0.100',
      guestInterface: 'eth1.500',
      maxConnectionRate: '20/second'
    });

    suricataBox.textContent = Synthesizer.generateSuricataRules({});
  }

  document.getElementById('btn-copy-nftables').addEventListener('click', function () {
    navigator.clipboard.writeText(nftablesBox.textContent);
    alert('Copied nftables rules to clipboard.');
  });

  document.getElementById('btn-copy-suricata').addEventListener('click', function () {
    navigator.clipboard.writeText(suricataBox.textContent);
    alert('Copied Suricata signatures to clipboard.');
  });

  // Tab 6: Simulator Controls
  var timelineDiv = document.getElementById('sim-timeline');

  function addTimelineEvent(time, title, desc, isErr) {
    var item = document.createElement('div');
    item.className = 'timeline-event' + (isErr ? ' err' : '');
    item.innerHTML = '<div class="timeline-time">' + time + '</div><div class="timeline-body"><h4>' + title + '</h4><p>' + desc + '</p></div>';
    timelineDiv.appendChild(item);
    timelineDiv.scrollTop = timelineDiv.scrollHeight;
  }

  document.getElementById('btn-sim-admission').addEventListener('click', function () {
    timelineDiv.innerHTML = '';
    addTimelineEvent('T+0.000s', 'EHR Admission Triggered', 'Emergency Department admits patient DOE^JOHN^A (MRN_98765432).');
    setTimeout(function () {
      addTimelineEvent('T+0.015s', 'HL7 ADT^A01 Dispatched', 'MLLP message framed with <VT> and dispatched to Interface Engine on TCP 2575.');
    }, 200);
    setTimeout(function () {
      addTimelineEvent('T+0.035s', 'EHR Gateway MSH Validation', 'MSH-3 (EPIC_EHR) and MSH-4 (MEMORIAL_HOSPITAL) validated against whitelist.');
    }, 400);
    setTimeout(function () {
      addTimelineEvent('T+0.050s', 'HL7 MSA^AA Acknowledgment', 'Integration engine returns Application Accept ACK with matching control ID.');
    }, 600);
  });

  document.getElementById('btn-sim-lab-result').addEventListener('click', function () {
    timelineDiv.innerHTML = '';
    addTimelineEvent('T+0.000s', 'LIS Lab Result Generated', 'Pathology analyzer completes telemetry: Heart Rate = 78 bpm (LOINC 8867-4).');
    setTimeout(function () {
      addTimelineEvent('T+0.020s', 'HL7 ORU^R01 Emitted', 'Message containing OBR and OBX segments sent to hospital router.');
    }, 200);
    setTimeout(function () {
      addTimelineEvent('T+0.045s', 'v2-to-FHIR R4 Transformation', 'Engine maps ORU^R01 to FHIR R4 Observation resource and writes to EHR FHIR store.');
    }, 400);
    setTimeout(function () {
      addTimelineEvent('T+0.065s', 'IHE ATNA Audit Logged', 'RFC 5424 Syslog record emitted: Patient Observation updated by LAB_SYS.');
    }, 600);
  });

  document.getElementById('btn-sim-rogue-feed').addEventListener('click', function () {
    timelineDiv.innerHTML = '';
    addTimelineEvent('T+0.000s', 'Rogue MLLP Connection Injected', 'Unauthorized device on hospital Wi-Fi attempts to send ADT^A08 patient update on port 2575.', true);
    setTimeout(function () {
      addTimelineEvent('T+0.005s', 'Linux nftables Ingress Drop', 'Packet dropped by healthcare_gw: IP not in @authorized_endpoints set.', true);
    }, 200);
    setTimeout(function () {
      addTimelineEvent('T+0.015s', 'Suricata Signature Alert SID 90014401', 'IDS flags unencrypted MLLP clinical stream attempt from unauthorized subnet.', true);
    }, 400);
    setTimeout(function () {
      addTimelineEvent('T+0.030s', 'Quarantine Action Triggered', 'Central security gateway blacklists rogue MAC address and alerts hospital SOC.', true);
    }, 600);
  });

  document.getElementById('btn-sim-clear').addEventListener('click', function () {
    timelineDiv.innerHTML = '';
  });

  // Initial runs
  synthesizeCurrentMessage();
  executeFhirConversion();
  executeAnonymization();
  executeAudit();
  updateSynthesizerOutputs();
});
