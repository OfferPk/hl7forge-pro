/**
 * HL7Forge Pro - HIPAA & SMART on FHIR Healthcare Cybersecurity Auditor
 * 10-Point Zero-Trust Compliance and Hardening Engine for EHR Interface Engines and FHIR APIs
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HL7SecurityAuditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AUDIT_CATEGORIES = {
    ENCRYPTION: 'Transport Security & Encryption (TLS 1.3)',
    AUTH: 'SMART on FHIR OAuth 2.0 & Token Scopes',
    ACCESS_CONTROL: 'MSH Facility Whitelisting & Origin Guard',
    PRIVACY: 'HIPAA Safe Harbor PHI De-Identification',
    AUDIT_LOGGING: 'IHE ATNA & RFC 3881 Audit Trail',
    NETWORK_SEGMENTATION: 'VLAN Domain Isolation & Firewall Ingress',
    RESILIENCE: 'MLLP DoS Mitigation & Replay Protection',
    INSPECTION: 'L7 Deep Packet Inspection & Threat Detection'
  };

  /**
   * Evaluates an HL7 v2 / FHIR interface deployment profile
   * Returns a score (0-100), letter grade (A+ to F), compliance status, and remediation roadmap.
   */
  function auditDeployment(profile) {
    profile = profile || {};

    var rules = [
      {
        id: 'HL7-SEC-01',
        title: 'Transport Layer Security (TLS 1.3 on MLLP 2575 & FHIR HTTPS)',
        standard: 'HIPAA Security Rule 45 CFR 164.312(e) / NIST SP 800-52',
        category: AUDIT_CATEGORIES.ENCRYPTION,
        weight: 15,
        check: function (p) {
          if (p.tlsEnabled && (p.tlsVersion === 'TLSv1.3' || p.tlsVersion === '1.3')) {
            return { pass: true, detail: 'MLLP stream and FHIR REST API secured over TLS 1.3 with PFS cipher suites (AES-256-GCM / ChaCha20).' };
          }
          if (p.tlsEnabled && p.tlsVersion === 'TLSv1.2') {
            return { pass: false, severity: 'MEDIUM', detail: 'TLS 1.2 is active. Upgrade to TLS 1.3 for enhanced security and zero-RTT privacy.' };
          }
          return { pass: false, severity: 'CRITICAL', detail: 'Plaintext MLLP on TCP port 2575 without encryption. Clinical patient data and PHI are transmitted in cleartext.' };
        }
      },
      {
        id: 'HL7-SEC-02',
        title: 'SMART on FHIR OAuth 2.0 / OpenID Connect Granular Scopes',
        standard: 'ONC 21st Century Cures Act / SMART App Launch v2',
        category: AUDIT_CATEGORIES.AUTH,
        weight: 15,
        check: function (p) {
          if (p.smartOnFhirEnabled && p.granularScopesEnforced && p.jwtSignatureValidated) {
            return { pass: true, detail: 'SMART on FHIR OAuth2 active with asymmetric RS256/ES384 JWT signature verification and context-scoped permissions.' };
          }
          return { pass: false, severity: 'CRITICAL', detail: 'Missing or permissive FHIR API authentication. Unauthenticated clients can query patient resources.' };
        }
      },
      {
        id: 'HL7-SEC-03',
        title: 'MSH-3/MSH-4 Sending Application & Facility Whitelisting',
        standard: 'IHE ITI Technical Framework / Zero-Trust Architecture',
        category: AUDIT_CATEGORIES.ACCESS_CONTROL,
        weight: 10,
        check: function (p) {
          if (p.mshWhitelistingEnabled && p.dropUnauthorizedFacilities) {
            return { pass: true, detail: 'Strict MSH Sending Application and Facility validation table bound to verified interface endpoints.' };
          }
          return { pass: false, severity: 'HIGH', detail: 'Permissive MSH parsing. Rogue endpoints can inject fake ADT patient admission messages.' };
        }
      },
      {
        id: 'HL7-SEC-04',
        title: 'HIPAA Safe Harbor PHI De-Identification Pipeline',
        standard: 'HIPAA Privacy Rule 45 CFR 164.514 / GDPR Article 89',
        category: AUDIT_CATEGORIES.PRIVACY,
        weight: 12,
        check: function (p) {
          if (p.anonymizationEnabled && p.strip18HipaaIdentifiers && p.pseudonymizePatientIds) {
            return { pass: true, detail: 'Automated de-identification pipeline strips 18 direct HIPAA identifiers from PID/PV1 segments for research/AI exports.' };
          }
          return { pass: false, severity: 'CRITICAL', detail: 'Unsanitized export pipeline. Direct patient identifiers (Name, MRN, DOB, Address) exposed in analytics.' };
        }
      },
      {
        id: 'HL7-SEC-05',
        title: 'IHE ATNA RFC 3881 / RFC 5424 Syslog Audit Trail Emitter',
        standard: 'IHE ITI TF-2 / HIPAA 45 CFR 164.312(b)',
        category: AUDIT_CATEGORIES.AUDIT_LOGGING,
        weight: 10,
        check: function (p) {
          if (p.iheAtnaLogging && p.logAllMessageTransactions) {
            return { pass: true, detail: 'RFC 5424 TLS Syslog audit emitter records every message receipt, transmission, transformation, and query with user attribution.' };
          }
          return { pass: false, severity: 'HIGH', detail: 'Missing or incomplete audit trail. Inability to audit who accessed or modified patient records during forensic audits.' };
        }
      },
      {
        id: 'HL7-SEC-06',
        title: 'MLLP Connection Rate Limiting & DoS Storm Throttling',
        standard: 'NIST SP 800-53 SC-5 / ISO 27001',
        category: AUDIT_CATEGORIES.RESILIENCE,
        weight: 8,
        check: function (p) {
          if (p.rateLimitMllp && p.maxMllpConnectionsPerSec && p.maxMllpConnectionsPerSec <= 20) {
            return { pass: true, detail: 'MLLP connection rate limiting capped at ' + p.maxMllpConnectionsPerSec + ' conn/s per IP to prevent socket starvation.' };
          }
          return { pass: false, severity: 'MEDIUM', detail: 'Uncapped MLLP listener. Vulnerable to connection exhaustion attacks freezing hospital message routing.' };
        }
      },
      {
        id: 'HL7-SEC-07',
        title: 'Message Control ID (MSH-10) Monotonic Anti-Replay Guard',
        standard: 'HL7 v2.5.1 Conformance / ISO 21434 Sec 9',
        category: AUDIT_CATEGORIES.RESILIENCE,
        weight: 8,
        check: function (p) {
          if (p.msh10Tracking && p.dropDuplicateControlIds) {
            return { pass: true, detail: 'Stateful MSH-10 Message Control ID tracking active. Replayed ADT or order transactions immediately rejected with AR ack.' };
          }
          return { pass: false, severity: 'MEDIUM', detail: 'Stateless message processing. Duplicate orders or admission messages can be replayed.' };
        }
      },
      {
        id: 'HL7-SEC-08',
        title: 'Clinical VLAN (IEEE 802.1Q) Domain Segmentation',
        standard: 'IEC 80001-1 (Healthcare IT Networks) / HIPAA Security',
        category: AUDIT_CATEGORIES.NETWORK_SEGMENTATION,
        weight: 12,
        check: function (p) {
          if (p.vlanIsolation && p.ehrVlanId && p.guestVlanId && p.ehrVlanId !== p.guestVlanId) {
            return { pass: true, detail: 'EHR and integration engine isolated on VLAN ' + p.ehrVlanId + '; quarantined from general enterprise and guest Wi-Fi.' };
          }
          return { pass: false, severity: 'CRITICAL', detail: 'Flat hospital network topology. Clinical integration feeds share broadcast domains with guest Wi-Fi.' };
        }
      },
      {
        id: 'HL7-SEC-09',
        title: 'Linux nftables Healthcare Gateway Ingress Filtering',
        standard: 'NIST SP 800-41 / Healthcare Gateway Defense',
        category: AUDIT_CATEGORIES.NETWORK_SEGMENTATION,
        weight: 8,
        check: function (p) {
          if (p.nftablesFirewallActive && p.blockUntrustedEndpoints) {
            return { pass: true, detail: 'Linux nftables ingress policy blocks unverified subnets from accessing ports 2575 and 8443.' };
          }
          return { pass: false, severity: 'HIGH', detail: 'No host-level firewall on integration gateway. Open listening sockets accessible to all hospital subnets.' };
        }
      },
      {
        id: 'HL7-SEC-10',
        title: 'Suricata Layer 7 HL7 Threat Detection Signatures Active',
        standard: 'IHE ATNA / HIPAA Security Monitoring',
        category: AUDIT_CATEGORIES.INSPECTION,
        weight: 7,
        check: function (p) {
          if (p.idsLoggingEnabled && p.dpiSuricataSignaturesActive) {
            return { pass: true, detail: 'Suricata L7 HL7 parser active with real-time alerting on plaintext MLLP traffic, malformed MSH headers, and abnormal ADT floods.' };
          }
          return { pass: false, severity: 'MEDIUM', detail: 'No deep packet inspection for HL7/FHIR traffic. Zero-day clinical data manipulation attempts go undetected.' };
        }
      }
    ];

    var totalScore = 0;
    var maxScore = 0;
    var findings = [];
    var criticalCount = 0;
    var highCount = 0;
    var mediumCount = 0;
    var lowCount = 0;

    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      maxScore += r.weight;
      var outcome = r.check(profile);

      if (outcome.pass) {
        totalScore += r.weight;
      } else {
        if (outcome.severity === 'CRITICAL') criticalCount++;
        else if (outcome.severity === 'HIGH') highCount++;
        else if (outcome.severity === 'MEDIUM') mediumCount++;
        else if (outcome.severity === 'LOW') lowCount++;
      }

      findings.push({
        id: r.id,
        title: r.title,
        standard: r.standard,
        category: r.category,
        weight: r.weight,
        pass: outcome.pass,
        severity: outcome.severity || 'NONE',
        detail: outcome.detail
      });
    }

    var percentage = Math.round((totalScore / maxScore) * 100);
    var grade = 'F';
    if (percentage >= 95) grade = 'A+';
    else if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    var complianceStatus = (percentage >= 85 && criticalCount === 0) ? 'COMPLIANT' : 'NON_COMPLIANT';

    return {
      score: percentage,
      grade: grade,
      complianceStatus: complianceStatus,
      summary: {
        totalRules: rules.length,
        passedRules: rules.length - (criticalCount + highCount + mediumCount + lowCount),
        criticalVulnerabilities: criticalCount,
        highVulnerabilities: highCount,
        mediumVulnerabilities: mediumCount,
        lowVulnerabilities: lowCount
      },
      findings: findings,
      remediationSteps: generateRemediationRoadmap(findings)
    };
  }

  function generateRemediationRoadmap(findings) {
    var roadmap = [];
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      if (!f.pass) {
        var fix = 'Apply clinical interface hardening.';
        if (f.id === 'HL7-SEC-01') fix = 'Enforce TLS 1.3 wrapping on MLLP port 2575 and mandate HTTPS on FHIR REST endpoint.';
        else if (f.id === 'HL7-SEC-02') fix = 'Deploy SMART on FHIR OAuth 2.0 authorization server checking patient-scoped scopes.';
        else if (f.id === 'HL7-SEC-03') fix = 'Configure static MSH-3/MSH-4 Sending Application & Facility whitelist on interface gateway.';
        else if (f.id === 'HL7-SEC-04') fix = 'Enable automated HIPAA Safe Harbor de-identification pipeline to strip 18 direct identifiers.';
        else if (f.id === 'HL7-SEC-05') fix = 'Deploy RFC 5424 TLS Syslog audit forwarder conforming to IHE ATNA profile.';
        else if (f.id === 'HL7-SEC-06') fix = 'Configure connection rate limiter (max 20 conn/s per IP) on MLLP listening socket.';
        else if (f.id === 'HL7-SEC-07') fix = 'Enable stateful MSH-10 cache to reject duplicate or replayed message control IDs.';
        else if (f.id === 'HL7-SEC-08') fix = 'Isolate EHR integration feeds on clinical VLAN 100 with zero access from guest subnets.';
        else if (f.id === 'HL7-SEC-09') fix = 'Deploy nftables firewall rules dropping non-whitelisted IP traffic targeting ports 2575 and 8443.';
        else if (f.id === 'HL7-SEC-10') fix = 'Install Suricata Layer 7 HL7 threat detection signatures on hospital security gateway.';

        roadmap.push({
          ruleId: f.id,
          severity: f.severity,
          action: fix
        });
      }
    }
    return roadmap;
  }

  return {
    AUDIT_CATEGORIES: AUDIT_CATEGORIES,
    auditDeployment: auditDeployment
  };
}));
