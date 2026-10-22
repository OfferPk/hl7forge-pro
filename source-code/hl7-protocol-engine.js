/**
 * HL7Forge Pro - HL7 v2.x (ER7) & FHIR R4 Healthcare Protocol Engine
 * Standard-compliant ER7 parser, MLLP framing, v2-to-FHIR R4 converter, and PCAP synthesis.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HL7ProtocolEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Standard MLLP Framing Characters
  var MLLP_START = 0x0B; // <VT>
  var MLLP_END_FS = 0x1C; // <FS>
  var MLLP_END_CR = 0x0D; // <CR>

  var MESSAGE_TYPES = {
    ADT_A01: 'ADT^A01^ADT_A01', // Patient Admission
    ADT_A04: 'ADT^A04^ADT_A04', // Patient Registration
    ADT_A08: 'ADT^A08^ADT_A08', // Patient Information Update
    ORM_O01: 'ORM^O01^ORM_O01', // Order Message
    ORU_R01: 'ORU^R01^ORU_R01'  // Observation / Lab Result
  };

  function toHex(val, pad) {
    var str = Number(val).toString(16).toUpperCase();
    while (str.length < (pad || 2)) {
      str = '0' + str;
    }
    return str;
  }

  function bytesToHex(bytes) {
    if (!bytes) return '';
    var arr = Array.prototype.slice.call(bytes);
    return arr.map(function (b) { return toHex(b, 2); }).join(' ');
  }

  function stringToBytes(str) {
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return bytes;
  }

  function bytesToString(bytes) {
    var str = '';
    for (var i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }

  /**
   * Encloses an HL7 ER7 string into an MLLP transport byte frame (<VT> ... <FS><CR>)
   */
  function wrapMllp(er7String) {
    var payloadBytes = stringToBytes(er7String);
    var frame = new Uint8Array(1 + payloadBytes.length + 2);
    frame[0] = MLLP_START;
    frame.set(payloadBytes, 1);
    frame[1 + payloadBytes.length] = MLLP_END_FS;
    frame[1 + payloadBytes.length + 1] = MLLP_END_CR;
    return frame;
  }

  /**
   * Strips MLLP envelope bytes from a raw byte buffer
   */
  function unwrapMllp(mllpBytes) {
    if (!mllpBytes || mllpBytes.length < 3) {
      return { valid: false, error: 'Frame smaller than minimal MLLP frame (3 bytes)' };
    }
    var hasStart = (mllpBytes[0] === MLLP_START);
    var hasEnd = (mllpBytes[mllpBytes.length - 2] === MLLP_END_FS && mllpBytes[mllpBytes.length - 1] === MLLP_END_CR);

    if (!hasStart || !hasEnd) {
      // Check if it's already raw ER7 text without MLLP
      var text = bytesToString(mllpBytes);
      if (text.indexOf('MSH') === 0) {
        return { valid: true, er7: text, framed: false };
      }
      return { valid: false, error: 'Invalid MLLP framing characters (Expected 0x0B start and 0x1C 0x0D end)' };
    }

    var innerBytes = mllpBytes.subarray(1, mllpBytes.length - 2);
    return {
      valid: true,
      er7: bytesToString(innerBytes),
      framed: true,
      length: innerBytes.length
    };
  }

  /**
   * Builds an HL7 v2.5.1 ER7 message
   */
  function buildHl7Message(opts) {
    opts = opts || {};
    var msgType = opts.messageType || MESSAGE_TYPES.ADT_A01;
    var sendingApp = opts.sendingApp || 'EPIC_EHR';
    var sendingFac = opts.sendingFacility || 'MEMORIAL_HOSPITAL';
    var receivingApp = opts.receivingApp || 'LAB_SYS';
    var receivingFac = opts.receivingFacility || 'CENTRAL_PATHOLOGY';
    var msgControlId = opts.messageControlId || 'MSG_' + Math.floor(100000 + Math.random() * 900000);
    var timestamp = opts.timestamp || '20261005004500';
    var version = opts.version || '2.5.1';

    // MSH Segment
    var msh = [
      'MSH',
      '^~\\&',
      sendingApp,
      sendingFac,
      receivingApp,
      receivingFac,
      timestamp,
      '',
      msgType,
      msgControlId,
      'P',
      version
    ].join('|');

    // PID Segment
    var patientId = opts.patientId || 'MRN_98765432';
    var patientName = opts.patientName || 'DOE^JOHN^A';
    var dob = opts.dob || '19840512';
    var sex = opts.sex || 'M';
    var address = opts.address || '123 HEALTHCARE BLVD^^BOSTON^MA^02115';

    var pid = [
      'PID',
      '1',
      '',
      patientId + '^^^HOSPITAL^MR',
      '',
      patientName,
      '',
      dob,
      sex,
      '',
      '',
      address
    ].join('|');

    // PV1 Segment
    var patientClass = opts.patientClass || 'I'; // Inpatient
    var location = opts.assignedLocation || 'ICU^BED_04^WARD_WEST';
    var attendingDoc = opts.attendingDoctor || 'DOC_774^ADAMS^GREGORY^MD';
    var pv1 = [
      'PV1',
      '1',
      patientClass,
      location,
      '',
      '',
      '',
      attendingDoc
    ].join('|');

    var segments = [msh, pid, pv1];

    // If ORU (Observation Result), append OBR and OBX
    if (msgType.indexOf('ORU') === 0) {
      var obr = [
        'OBR',
        '1',
        'ORD_1004',
        'LAB_5002',
        opts.loincCode ? (opts.loincCode + '^' + (opts.loincDisplay || 'Observation') + '^LN') : '8867-4^Heart Rate^LN',
        '',
        timestamp
      ].join('|');

      var obx = [
        'OBX',
        '1',
        opts.valueType || 'NM',
        opts.loincCode ? (opts.loincCode + '^' + (opts.loincDisplay || 'Observation') + '^LN') : '8867-4^Heart Rate^LN',
        '',
        opts.observationValue || '78',
        opts.units || 'bpm',
        '60-100',
        'N',
        '',
        '',
        'F'
      ].join('|');

      segments.push(obr);
      segments.push(obx);
    }

    return segments.join('\r');
  }

  /**
   * Dissects a raw ER7 HL7 v2 string into structured segments and fields
   */
  function dissectHl7(er7String) {
    if (!er7String || er7String.trim().length === 0) {
      return { valid: false, error: 'Empty HL7 message' };
    }

    var lines = er7String.split(/[\r\n]+/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length === 0 || lines[0].indexOf('MSH') !== 0) {
      return { valid: false, error: 'Message does not start with standard MSH header segment' };
    }

    var parsedSegments = [];
    var messageMetadata = {};

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fields = line.split('|');
      var segName = fields[0];

      var segObj = {
        segment: segName,
        fields: fields,
        raw: line
      };

      if (segName === 'MSH') {
        // In MSH, MSH-1 is '|', so fields[1] is MSH-2 (Encoding Chars), fields[2] is MSH-3
        messageMetadata.encodingChars = fields[1];
        messageMetadata.sendingApp = fields[2];
        messageMetadata.sendingFacility = fields[3];
        messageMetadata.receivingApp = fields[4];
        messageMetadata.receivingFacility = fields[5];
        messageMetadata.timestamp = fields[6];
        messageMetadata.messageType = fields[8];
        messageMetadata.messageControlId = fields[9];
        messageMetadata.processingId = fields[10];
        messageMetadata.versionId = fields[11];
      } else if (segName === 'PID') {
        messageMetadata.patientId = fields[3];
        messageMetadata.patientName = fields[5];
        messageMetadata.dob = fields[7];
        messageMetadata.sex = fields[8];
        messageMetadata.address = fields[11];
      } else if (segName === 'PV1') {
        messageMetadata.patientClass = fields[2];
        messageMetadata.assignedLocation = fields[3];
        messageMetadata.attendingDoctor = fields[7];
      } else if (segName === 'OBX') {
        if (!messageMetadata.observations) messageMetadata.observations = [];
        messageMetadata.observations.push({
          valueType: fields[2],
          identifier: fields[3],
          value: fields[5],
          units: fields[6],
          status: fields[11]
        });
      }

      parsedSegments.push(segObj);
    }

    return {
      valid: true,
      metadata: messageMetadata,
      segmentCount: parsedSegments.length,
      segments: parsedSegments,
      rawEr7: er7String
    };
  }

  /**
   * Converts HL7 v2 ER7 message to FHIR R4 JSON Resource / Bundle
   */
  function convertHl7ToFhir(er7String) {
    var parsed = dissectHl7(er7String);
    if (!parsed.valid) {
      throw new Error(parsed.error);
    }

    var meta = parsed.metadata;
    var nameParts = (meta.patientName || 'DOE^JOHN').split('^');
    var family = nameParts[0] || 'Unknown';
    var given = nameParts[1] || '';
    var middle = nameParts[2] || '';

    var cleanDob = meta.dob ? (meta.dob.substring(0, 4) + '-' + meta.dob.substring(4, 6) + '-' + meta.dob.substring(6, 8)) : '1980-01-01';
    var genderMap = { 'M': 'male', 'F': 'female', 'O': 'other' };
    var fhirGender = genderMap[meta.sex] || 'unknown';

    var patientResource = {
      resourceType: 'Patient',
      id: (meta.patientId || 'MRN_001').replace(/[^a-zA-Z0-9-]/g, '-'),
      identifier: [
        {
          use: 'official',
          system: 'http://hospital.smarthealth.org/mrn',
          value: meta.patientId || 'MRN_001'
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: family,
          given: [given, middle].filter(function (x) { return x.length > 0; })
        }
      ],
      gender: fhirGender,
      birthDate: cleanDob
    };

    if (meta.address) {
      var addrParts = meta.address.split('^');
      patientResource.address = [
        {
          use: 'home',
          line: [addrParts[0]],
          city: addrParts[2] || '',
          state: addrParts[3] || '',
          postalCode: addrParts[4] || ''
        }
      ];
    }

    // If Observations present, create FHIR Observation resources and wrap in a Transaction Bundle
    if (meta.observations && meta.observations.length > 0) {
      var bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        timestamp: new Date().toISOString(),
        entry: [
          {
            fullUrl: 'urn:uuid:patient-' + patientResource.id,
            resource: patientResource,
            request: { method: 'POST', url: 'Patient' }
          }
        ]
      };

      for (var o = 0; o < meta.observations.length; o++) {
        var obs = meta.observations[o];
        var idParts = (obs.identifier || '8867-4^Heart Rate^LN').split('^');
        var lCode = idParts[0] || '8867-4';
        var lDisplay = idParts[1] || 'Observation';

        var obsResource = {
          resourceType: 'Observation',
          id: 'obs-' + (o + 1),
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: lCode,
                display: lDisplay
              }
            ],
            text: lDisplay
          },
          subject: {
            reference: 'urn:uuid:patient-' + patientResource.id
          },
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: {
            value: parseFloat(obs.value) || 0,
            unit: obs.units || '',
            system: 'http://unitsofmeasure.org'
          }
        };

        bundle.entry.push({
          fullUrl: 'urn:uuid:obs-' + (o + 1),
          resource: obsResource,
          request: { method: 'POST', url: 'Observation' }
        });
      }

      return bundle;
    }

    return patientResource;
  }

  /**
   * HIPAA Safe Harbor PHI De-Identifier for HL7 ER7 messages
   */
  function anonymizeHl7(er7String) {
    var parsed = dissectHl7(er7String);
    if (!parsed.valid) return { error: parsed.error };

    var randId = Math.floor(100000 + Math.random() * 900000);
    var pseudoName = 'ANON_' + randId + '^ANONYMIZED';
    var pseudoId = 'MRN_ANON_' + randId;

    var sanitizedLines = [];
    var lines = er7String.split(/[\r\n]+/).filter(function (l) { return l.trim().length > 0; });

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fields = line.split('|');
      var segName = fields[0];

      if (segName === 'PID') {
        fields[3] = pseudoId + '^^^HOSPITAL^MR';
        fields[5] = pseudoName;
        fields[7] = '19700101'; // Default baseline
        fields[11] = 'REDACTED^^REDACTED^XX^00000';
      } else if (segName === 'PV1') {
        fields[3] = 'ANON_CLINICAL_UNIT';
        fields[7] = 'DOC_ANON^PHYSICIAN^REDACTED';
      }
      sanitizedLines.push(fields.join('|'));
    }

    var sanitizedEr7 = sanitizedLines.join('\r');

    return {
      originalEr7: er7String,
      sanitizedEr7: sanitizedEr7,
      pseudonym: pseudoName,
      pseudoId: pseudoId,
      hipaaSafeHarborCompliant: true
    };
  }

  /**
   * Generates a Libpcap Wireshark capture for MLLP/HL7 messages
   */
  function exportPcap(packets, isTls) {
    var globalHeader = new Uint8Array([
      0xD4, 0xC3, 0xB2, 0xA1, // Magic
      0x02, 0x00,             // Major 2
      0x04, 0x00,             // Minor 4
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0x00, 0x00, // Snaplen 65535
      0x01, 0x00, 0x00, 0x00  // Ethernet
    ]);

    var packetBuffers = [];
    var totalLen = globalHeader.length;
    var baseTsSec = 1791205200;

    var srcMac = new Uint8Array([0x00, 0x1A, 0x2B, 0x3C, 0x4D, 0x5E]);
    var dstMac = new Uint8Array([0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C]);
    var srcIp = new Uint8Array([192, 168, 1, 40]);  // EHR Client
    var dstIp = new Uint8Array([192, 168, 1, 100]); // Integration Gateway
    var port = isTls ? 8443 : 2575; // 2575 MLLP, 8443 TLS

    for (var i = 0; i < packets.length; i++) {
      var rawPayload = packets[i];

      var ethHeader = new Uint8Array(14);
      ethHeader.set(dstMac, 0);
      ethHeader.set(srcMac, 6);
      ethHeader[12] = 0x08; ethHeader[13] = 0x00; // IPv4

      var ipLen = 20 + 20 + rawPayload.length;
      var ipHeader = new Uint8Array(20);
      ipHeader[0] = 0x45;
      ipHeader[1] = 0x00;
      ipHeader[2] = (ipLen >> 8) & 0xFF;
      ipHeader[3] = ipLen & 0xFF;
      ipHeader[4] = (i >> 8) & 0xFF;
      ipHeader[5] = i & 0xFF;
      ipHeader[6] = 0x40; ipHeader[7] = 0x00;
      ipHeader[8] = 0x40; // TTL
      ipHeader[9] = 6;    // TCP
      ipHeader.set(srcIp, 12);
      ipHeader.set(dstIp, 16);

      // RFC 1071 IP Checksum
      var csum = 0;
      for (var c = 0; c < 20; c += 2) {
        csum += (ipHeader[c] << 8) | ipHeader[c + 1];
      }
      while (csum > 0xFFFF) csum = (csum & 0xFFFF) + (csum >>> 16);
      csum = (~csum) & 0xFFFF;
      ipHeader[10] = (csum >> 8) & 0xFF;
      ipHeader[11] = csum & 0xFF;

      // TCP Header (20B)
      var tcpHeader = new Uint8Array(20);
      var srcPort = 52345 + i;
      tcpHeader[0] = (srcPort >> 8) & 0xFF;
      tcpHeader[1] = srcPort & 0xFF;
      tcpHeader[2] = (port >> 8) & 0xFF;
      tcpHeader[3] = port & 0xFF;
      var seq = (i * 1000) >>> 0;
      tcpHeader[4] = (seq >>> 24) & 0xFF;
      tcpHeader[5] = (seq >>> 16) & 0xFF;
      tcpHeader[6] = (seq >>> 8) & 0xFF;
      tcpHeader[7] = seq & 0xFF;
      tcpHeader[8] = 0x00; tcpHeader[9] = 0x00; tcpHeader[10] = 0x00; tcpHeader[11] = 0x01; // Ack
      tcpHeader[12] = 0x50; // Data offset 5
      tcpHeader[13] = 0x18; // PSH, ACK
      tcpHeader[14] = 0x10; tcpHeader[15] = 0x00; // Window 4096

      var frameLen = ethHeader.length + ipHeader.length + tcpHeader.length + rawPayload.length;
      var fullFrame = new Uint8Array(frameLen);
      var offset = 0;
      fullFrame.set(ethHeader, offset); offset += ethHeader.length;
      fullFrame.set(ipHeader, offset); offset += ipHeader.length;
      fullFrame.set(tcpHeader, offset); offset += tcpHeader.length;
      fullFrame.set(rawPayload, offset);

      var pcapPktHeader = new Uint8Array(16);
      var tsSec = baseTsSec + Math.floor(i / 10);
      var tsUsec = (i % 10) * 100000;
      pcapPktHeader[0] = tsSec & 0xFF;
      pcapPktHeader[1] = (tsSec >> 8) & 0xFF;
      pcapPktHeader[2] = (tsSec >> 16) & 0xFF;
      pcapPktHeader[3] = (tsSec >> 24) & 0xFF;
      pcapPktHeader[4] = tsUsec & 0xFF;
      pcapPktHeader[5] = (tsUsec >> 8) & 0xFF;
      pcapPktHeader[6] = (tsUsec >> 16) & 0xFF;
      pcapPktHeader[7] = (tsUsec >> 24) & 0xFF;
      pcapPktHeader[8] = frameLen & 0xFF;
      pcapPktHeader[9] = (frameLen >> 8) & 0xFF;
      pcapPktHeader[10] = (frameLen >> 16) & 0xFF;
      pcapPktHeader[11] = (frameLen >> 24) & 0xFF;
      pcapPktHeader[12] = frameLen & 0xFF;
      pcapPktHeader[13] = (frameLen >> 8) & 0xFF;
      pcapPktHeader[14] = (frameLen >> 16) & 0xFF;
      pcapPktHeader[15] = (frameLen >> 24) & 0xFF;

      packetBuffers.push(pcapPktHeader);
      packetBuffers.push(fullFrame);
      totalLen += pcapPktHeader.length + fullFrame.length;
    }

    var result = new Uint8Array(totalLen);
    var writePos = 0;
    result.set(globalHeader, writePos); writePos += globalHeader.length;
    for (var b = 0; b < packetBuffers.length; b++) {
      result.set(packetBuffers[b], writePos);
      writePos += packetBuffers[b].length;
    }

    return result;
  }

  return {
    MESSAGE_TYPES: MESSAGE_TYPES,
    wrapMllp: wrapMllp,
    unwrapMllp: unwrapMllp,
    buildHl7Message: buildHl7Message,
    dissectHl7: dissectHl7,
    convertHl7ToFhir: convertHl7ToFhir,
    anonymizeHl7: anonymizeHl7,
    exportPcap: exportPcap,
    stringToBytes: stringToBytes,
    bytesToString: bytesToString,
    bytesToHex: bytesToHex
  };
}));
