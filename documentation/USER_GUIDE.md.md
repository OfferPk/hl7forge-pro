# HL7Forge Pro: User & Operational Guide

## 1\. Quickstart: Web Studio

HL7Forge Pro runs entirely client-side in modern web browsers without server runtimes, databases, or cloud dependencies.

### Launching the Web Studio

Open `source-code/index.html` directly in your browser:

\# On Linux / macOS:

open source-code/index.html

\# Or start a local static server:

python3 \-m http.server 8080 \--directory source-code

### Navigating the Studio

1. **Message Studio & Segment Inspector**:  
   - Choose an HL7 Message Type (e.g. `ADT^A01 Patient Admission`, `ORU^R01 Observation Result`).  
   - Configure Sending/Receiving Applications and Facilities (e.g. `EPIC_EHR`, `MEMORIAL_HOSPITAL`).  
   - Enter Patient MRN, Name, Date of Birth, Sex, and assigned hospital location.  
   - For `ORU^R01`, enter LOINC test codes (e.g. `8867-4^Heart Rate^LN`) and telemetry values.  
   - Click **Synthesize HL7 Message** to generate the raw ER7 stream and segment tree dissection.  
   - Click **Export MLLP PCAP** to generate a `.pcap` capture file.  
2. **HL7 to FHIR R4 Converter**:  
   - Click **Translate to FHIR R4** to instantly transform the ER7 message into standard FHIR R4 JSON resources (`Patient` resource or `Bundle` with `Observation`).  
   - Click **Copy FHIR JSON** to paste directly into REST client tools (Postman, curl).  
3. **HIPAA PHI De-Identification**:  
   - Click **Execute HIPAA Safe Harbor De-Identification** to redact patient identifiers (PID-5 Name, PID-3 MRN, PID-7 DOB, PID-11 Address) and generate safe research datasets.  
4. **HIPAA & SMART on FHIR Cybersecurity Auditor**:  
   - Configure hospital interface security controls (TLS version, SMART on FHIR authorization, MSH facility whitelisting, clinical VLAN isolation, IHE ATNA logging).  
   - Click **Re-run Security Audit** to compute the real-time score (0–100), letter grade (A+ to F), and remediation roadmap.  
   - Use the **Load Secure HIE** (Grade A+) or **Load Insecure Legacy** (Grade F) buttons for instant benchmarking.  
5. **Gateway Firewall & IDS**:  
   - Copy auto-generated Linux `nftables` ingress filtering scripts and Suricata Layer 7 HL7 threat signatures.  
6. **Clinical Workflow Simulator**:  
   - Execute interactive visual timeline simulations:  
     - **Simulate Patient Admission (ADT^A01)**: Demonstrates EHR admission and MLLP ACK handshake.  
     - **Simulate Lab Result (ORU^R01) & FHIR**: Shows lab result dispatch and real-time FHIR R4 conversion.  
     - **Simulate Rogue Injection Attack**: Demonstrates firewall drop and IDS alerting when untrusted devices attempt message injection.

---

## 2\. Command-Line Interface (CLI) Manual

The standalone Python CLI is located at `build/hl7forge-cli.py`. It requires Python 3.8+ with standard libraries only.

### 2.1 Synthesizing HL7 v2 Messages (`build-msg`)

\# Synthesize an ADT^A01 Patient Admission Message

python3 build/hl7forge-cli.py build-msg \--type "ADT^A01^ADT\_A01" \--send-app EPIC\_EHR \--patient-name "DOE^JOHN^A"

\# Synthesize an ORU^R01 Lab Observation Message wrapped in MLLP

python3 build/hl7forge-cli.py build-msg \--type "ORU^R01^ORU\_R01" \--mllp \--out observation\_mllp.bin

### 2.2 Dissecting Raw HL7 Messages (`dissect`)

\# Dissect a raw ER7 string

python3 build/hl7forge-cli.py dissect \--er7 "MSH\|^\~\\\\&\|EPIC\_EHR\|MEMORIAL\_HOSPITAL\|LAB\_SYS\|CENTRAL\_PATHOLOGY\|20261005004500\|\|ADT^A01^ADT\_A01\|MSG\_001\|P\|2.5.1\\\\rPID\|1\|\|MRN\_98765432^^^HOSPITAL^MR\|\|DOE^JOHN^A"

\# Dissect an MLLP-framed file

python3 build/hl7forge-cli.py dissect \--file observation\_mllp.bin

### 2.3 Converting HL7 v2 to FHIR R4 JSON (`to-fhir`)

python3 build/hl7forge-cli.py to-fhir \--er7 "MSH\|^\~\\\\&\|EPIC\_EHR\|MEMORIAL\_HOSPITAL\|LAB\_SYS\|CENTRAL\_PATHOLOGY\|20261005004500\|\|ADT^A01^ADT\_A01\|MSG\_001\|P\|2.5.1\\\\rPID\|1\|\|MRN\_98765432^^^HOSPITAL^MR\|\|DOE^JOHN^A\|\|19840512\|M"

### 2.4 De-Identifying Patient PHI (`anonymize`)

python3 build/hl7forge-cli.py anonymize \--er7 "MSH\|^\~\\\\&\|EPIC\_EHR\|HOSPITAL\|LAB\|PATH\|20261005\|\|ADT^A01\|MSG01\|P\|2.5.1\\\\rPID\|1\|\|MRN12345\|\|SMITH^ALICE\|\|19750315\|F\|\|\|456 MAIN ST"

### 2.5 Executing HIPAA & SMART on FHIR Security Audits (`audit`)

\# Audit default secure profile

python3 build/hl7forge-cli.py audit

\# Audit custom profile with strict CI/CD exit gating

python3 build/hl7forge-cli.py audit \--profile custom-profile.json \--strict

### 2.6 Generating Wireshark PCAPs (`export-pcap`)

\# Export standard MLLP capture (Port 2575\)

python3 build/hl7forge-cli.py export-pcap \--out hl7-capture.pcap

\# Export secure TLS capture (Port 8443\)

python3 build/hl7forge-cli.py export-pcap \--out hl7-tls-capture.pcap \--tls

---

## 3\. Wireshark Capture Analysis

Generated PCAP captures conform to standard Libpcap 2.4 format:

1. Open `hl7-capture.pcap` in Wireshark.  
2. Apply display filter `tcp.port == 2575` or `hl7`.  
3. Wireshark parses:  
   - MLLP Start Block: `0x0B`  
   - MSH Segment: Sending App `EPIC_EHR`, Facility `MEMORIAL_HOSPITAL`  
   - Message Type: `ADT^A01^ADT_A01`  
   - MLLP End Block: `0x1C 0x0D`