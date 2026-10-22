# HL7Forge Pro: Technical Architecture Specification

## 1\. System Overview

**HL7Forge Pro (v1.0.0)** is an enterprise healthcare interoperability engineering suite and DevSecOps compliance platform for **Health Level Seven (HL7 v2.x ER7)**, **HL7 FHIR R4 (Fast Healthcare Interoperability Resources)**, and **HIPAA / SMART on FHIR** cybersecurity compliance.

Modern healthcare institutions rely heavily on electronic health record systems (EHR/EMR such as Epic Systems, Oracle Cerner, and Meditech), laboratory information systems (LIS), pharmacy platforms, and regional Health Information Exchanges (e.g. US state HIEs, NHS England, and UAE Malaffi / Nabidh). While internal clinical workflows operate over legacy HL7 v2 pipe-and-hat delimiter messages (ER7) framed over TCP using the Minimal Lower Layer Protocol (MLLP), modern cloud applications, patient portals, and clinical AI algorithms require RESTful FHIR R4 JSON resources secured with SMART on FHIR OAuth 2.0.

Healthcare software engineers, hospital interface analysts, and medical AI developers face acute challenges parsing nested HL7 v2 fields, converting legacy message types (ADT, ORU, ORM) to standard FHIR resources, sanitizing Protected Health Information (PHI) under HIPAA Safe Harbor, and adhering to strict IHE ATNA audit logging standards.

HL7Forge Pro provides wire-level ER7 message synthesis, live segment tree dissection, bidirectional v2-to-FHIR R4 transformation, MLLP stream inspection, and automated HIPAA compliance auditing in a zero-dependency, self-contained architecture.

---

## 2\. HL7 v2.x ER7 Delimiter & Segment Architecture

### 2.1 The Delimiter Structure

HL7 v2 messages are text-based streams structured into segments separated by Carriage Return (`0x0D` / `\r`). Fields and nested data elements within a segment are partitioned by standard encoding characters defined in the MSH segment:

1. **Field Separator (`|`)**: Divides discrete fields within a segment.  
2. **Component Separator (`^`)**: Divides components within a field (e.g. `DOE^JOHN^A`).  
3. **Repetition Separator (`~`)**: Delineates repeating instances of a field.  
4. **Escape Character (`\`)**: Escapes reserved formatting characters.  
5. **Subcomponent Separator (`&`)**: Divides subcomponents within a component.

### 2.2 Core Clinical Segments

- **MSH (Message Header)**:  
  - `MSH-1`: Field Separator (`|`)  
  - `MSH-2`: Encoding Characters (`^~\&`)  
  - `MSH-3` & `MSH-4`: Sending Application & Sending Facility (e.g. `EPIC_EHR|MEMORIAL_HOSPITAL`)  
  - `MSH-5` & `MSH-6`: Receiving Application & Receiving Facility (e.g. `LAB_SYS|CENTRAL_PATHOLOGY`)  
  - `MSH-7`: Message Timestamp (`YYYYMMDDHHMMSS`)  
  - `MSH-9`: Message Type (e.g. `ADT^A01^ADT_A01` for admission, `ORU^R01^ORU_R01` for lab results)  
  - `MSH-10`: Message Control ID (unique identifier for transaction tracking and deduplication)  
  - `MSH-11`: Processing ID (`P` for Production, `T` for Training, `D` for Debug)  
  - `MSH-12`: Version ID (e.g. `2.5.1`)  
- **PID (Patient Identification)**:  
  - `PID-3`: Patient Identifier List (MRN, assigning authority)  
  - `PID-5`: Patient Name (`Family^Given^Middle^Prefix^Suffix`)  
  - `PID-7`: Date/Time of Birth (`YYYYMMDD`)  
  - `PID-8`: Administrative Sex (`M`, `F`, `O`, `U`)  
  - `PID-11`: Patient Address (`Street^Line2^City^State^PostalCode`)  
- **PV1 (Patient Visit)**:  
  - `PV1-2`: Patient Class (`I` Inpatient, `O` Outpatient, `E` Emergency)  
  - `PV1-3`: Assigned Patient Location (`PointOfCare^Room^Bed^Facility`)  
  - `PV1-7`: Attending Doctor (`ID^Family^Given^Degree`)  
- **OBR (Observation Request)**:  
  - `OBR-4`: Universal Service Identifier (e.g. LOINC code `8867-4^Heart Rate^LN`)  
- **OBX (Observation / Result)**:  
  - `OBX-2`: Value Type (`NM` Numeric, `ST` String, `TX` Text, `CE` Coded Entry)  
  - `OBX-3`: Observation Identifier (`Identifier^Text^NameOfCodingSystem`)  
  - `OBX-5`: Observation Value  
  - `OBX-6`: Units (`bpm`, `mg/dL`, `mmHg`)  
  - `OBX-11`: Observation Result Status (`F` Final, `P` Preliminary, `C` Corrected)

---

## 3\. Minimal Lower Layer Protocol (MLLP) Framing

Because TCP is a continuous byte stream, HL7 v2 messages are encapsulated within MLLP framing characters to delineate message boundaries:

\+------------+-------------------------------------+-------------------+

| Start Byte |          HL7 ER7 Payload            |     End Bytes     |

|   (0x0B)   | (MSH|^\~\\&|... \\r PID|1|... \\r ...)  |   (0x1C  0x0D)    |

|   \<VT\>     |                                     |    \<FS\>   \<CR\>    |

\+------------+-------------------------------------+-------------------+

- **Start Block**: Single octet `0x0B` (`Vertical Tab <VT>`).  
- **End Block**: Two octets: `0x1C` (`File Separator <FS>`) followed by `0x0D` (`Carriage Return <CR>`).  
- Default TCP Port: `2575` (standard MLLP) or `8443` (TLS-wrapped MLLP).

---

## 4\. HL7 v2 to FHIR R4 Bidirectional Transformation

HL7Forge Pro features an automated semantic mapper that converts legacy ER7 messages into standard FHIR Release 4 JSON models:

1. **ADT (Admission/Discharge/Transfer) \-\> FHIR `Patient`**:  
   - `PID-3` \-\> `Patient.identifier` (with system URI).  
   - `PID-5` \-\> `Patient.name` (`family`, `given`, `use="official"`).  
   - `PID-7` \-\> `Patient.birthDate` (`YYYY-MM-DD`).  
   - `PID-8` \-\> `Patient.gender` (`male`, `female`, `other`, `unknown`).  
   - `PID-11` \-\> `Patient.address` (`line`, `city`, `state`, `postalCode`).  
2. **ORU (Observation / Lab Result) \-\> FHIR `Observation` & `Bundle`**:  
   - Packaged as a FHIR `Bundle` with `type="transaction"`.  
   - `OBX-3` \-\> `Observation.code.coding` (mapped to LOINC / SNOMED CT terminology).  
   - `OBX-5` & `OBX-6` \-\> `Observation.valueQuantity` (`value`, `unit`, `system="http://unitsofmeasure.org"`).  
   - `OBX-11` \-\> `Observation.status` (`final`, `preliminary`).  
   - Linked to `Patient` resource via `Observation.subject.reference`.

---

## 5\. SMART on FHIR Security & HIPAA Compliance

1. **SMART on FHIR OAuth 2.0**:  
   - Mandates client authorization using OpenID Connect (OIDC) and OAuth 2.0 access tokens.  
   - Enforces granular scopes: `patient/Patient.read`, `patient/Observation.read`, `system/DiagnosticReport.write`.  
   - Token validation verifies asymmetric RS256/ES384 cryptographic signatures, expiration (`exp`), and audience (`aud`).  
2. **HIPAA Safe Harbor De-Identification (45 CFR § 164.514)**:  
   - Strips 18 direct identifiers: Patient Name (`PID-5`), MRN (`PID-3`), Date of Birth (`PID-7`), and Address (`PID-11`).  
   - Generates consistent pseudonyms (`ANON_xxxxxx^ANONYMIZED`) and synthetic MRNs, allowing research and clinical AI model training without risking civil money penalties.

---

## 6\. 10-Point HIPAA & SMART on FHIR Compliance Rubric

| ID | Control Description | Reference Standard | Weight | Target Metric |
| :---- | :---- | :---- | :---- | :---- |
| **HL7-SEC-01** | Transport Layer Security (TLS 1.3) | HIPAA 164.312(e) / NIST SP 800-52 | 15% | TLS 1.3 on MLLP 2575 & FHIR 8443 |
| **HL7-SEC-02** | SMART on FHIR OAuth 2.0 Scopes | ONC Cures Act / SMART Launch v2 | 15% | Asymmetric JWT validation & scopes |
| **HL7-SEC-03** | MSH-3/MSH-4 Facility Whitelisting | IHE ITI Technical Framework | 10% | Static sending facility whitelist |
| **HL7-SEC-04** | HIPAA Safe Harbor PHI Anonymization | HIPAA Privacy Rule 45 CFR 164.514 | 12% | Stripping 18 direct identifiers |
| **HL7-SEC-05** | IHE ATNA RFC 3881 Syslog Logging | IHE ITI TF-2 / HIPAA 164.312(b) | 10% | TLS Syslog for all transactions |
| **HL7-SEC-06** | MLLP Connection Rate Limiting | NIST SP 800-53 SC-5 | 8% | Max \<= 20 conn/s to prevent DoS |
| **HL7-SEC-07** | MSH-10 Monotonic Anti-Replay Guard | HL7 v2.5.1 Conformance | 8% | Drop duplicate Message Control IDs |
| **HL7-SEC-08** | Clinical VLAN Domain Segmentation | IEC 80001-1 / IEEE 802.1Q | 12% | EHR VLAN 100 \!= Guest VLAN 500 |
| **HL7-SEC-09** | Linux nftables Ingress Filtering | NIST SP 800-41 Gateway Defense | 8% | Block non-whitelisted IP subnets |
| **HL7-SEC-10** | Suricata Layer 7 Threat Detection | IHE ATNA / HIPAA Monitoring | 7% | L7 HL7 threat signatures active |

---

## 7\. Software Architecture

product\_144/

├── README.md

├── build/

│   ├── hl7forge-cli.py             \# Standalone DevSecOps CLI utility

│   └── hl7forge-pro-v1.0.0.zip     \# Full release distribution archive

├── documentation/

│   ├── ARCHITECTURE.md             \# In-depth technical architecture

│   ├── USER\_GUIDE.md               \# Operational guide & CLI reference

│   └── MONETIZATION\_AND\_MARKETING\_PLAYBOOK.md \# Commercial strategy & pricing

├── screenshots/

│   ├── hl7-studio-preview.svg      \# Visual Web Studio preview

│   └── hl7-architecture-diagram.svg \# Healthcare HIE enterprise architecture diagram

└── source-code/

    ├── app.js                      \# Interactive Web Studio application controller

    ├── hl7-config-synthesizer.js   \# nftables & Suricata rule generator

    ├── hl7-forge.css               \# High-contrast clinical UI styling

    ├── hl7-protocol-engine.js      \# Core encoder, decoder & PCAP engine

    ├── hl7-security-auditor.js     \# 10-point HIPAA & SMART on FHIR auditor

    └── index.html                  \# Web Studio user interface